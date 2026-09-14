#!/usr/bin/env node
/**
 * Risques naturels et technologiques — Géorisques (ministère de la Transition
 * écologique, DGPR), pour toutes les communes.
 *
 *   node scripts/importer-risques.mjs [--dossier <cache>] [--sans-api]
 *
 * Deux jeux, tous deux publiés par Géorisques :
 *
 *  - l'export national de la base GASPAR (zip, ~8 Mo, rejoué à chaque
 *    publication) : arrêtés de reconnaissance de l'état de catastrophe
 *    naturelle depuis 1982 (catnat), plans de prévention des risques naturels,
 *    miniers et technologiques (pprn, pprm, pprt) et risques recensés dans les
 *    dossiers départementaux (ddrm_risq) ;
 *  - l'API Géorisques, par lots de vingt codes INSEE (sa limite), pour la zone
 *    de sismicité réglementaire (1 à 5, décret de 2010) et le potentiel radon
 *    (catégories 1 à 3, cartographie IRSN/ASN). Les réponses sont mises en
 *    cache : ~1 750 appels par indicateur la première fois, aucun ensuite.
 *
 * Communes fusionnées : GASPAR conserve des lignes au code de l'ancienne
 * commune. Elles sont rattachées à la commune actuelle par les mouvements du
 * Code officiel géographique (fusions, MOD 31 à 34) ; la liste des codes
 * rattachés est conservée pour l'afficher.
 *
 * Aucun chiffre n'est estimé : une commune sans arrêté a 0 arrêté (la base est
 * nationale et exhaustive), une commune absente de la réponse de l'API reste
 * null pour l'indicateur concerné.
 *
 * Écrit `data/raw/<région>/risques.json`.
 */
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const args = process.argv.slice(2);
const CACHE = args.includes("--dossier") ? path.resolve(args[args.indexOf("--dossier") + 1]) : path.join(RACINE, ".cache-insee");
const SANS_API = args.includes("--sans-api");

const GASPAR = {
  page: "https://www.georisques.gouv.fr/donnees/bases-de-donnees/base-gaspar",
  zip: "https://files.georisques.fr/GASPAR/gaspar.zip",
  dossier: "gaspar",
};
const API = "https://www.georisques.gouv.fr/api/v1";
const LOT_API = 20; // « Le nombre de codes Insee à traiter ne doit pas dépasser 20. »
const PARALLELE = 4;
const MVT_COG = {
  url: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_mvt_commune_2025.csv",
  fichier: "mvt-communes-2025.csv",
};

const ZONES_SISMIQUES = { 1: "très faible", 2: "faible", 3: "modérée", 4: "moyenne", 5: "forte" };

// ------------------------------------------------------------------ outils

async function telecharger(url, chemin, libelle) {
  if (existsSync(chemin)) return chemin;
  await mkdir(path.dirname(chemin), { recursive: true });
  console.log(`Téléchargement ${libelle}…`);
  const reponse = await fetch(url, { headers: { "user-agent": "ou-vivre/1.0" }, redirect: "follow" });
  if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
  await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
  return chemin;
}

async function dezipper(zip, dossier) {
  await mkdir(dossier, { recursive: true });
  const { execSync } = await import("node:child_process");
  try {
    execSync(`unzip -o -q "${zip}" -d "${dossier}"`, { stdio: "ignore" });
  } catch {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${zip}' -DestinationPath '${dossier}'"`, {
      stdio: "ignore",
    });
  }
}

/** Le fichier GASPAR dont le nom commence par `prefixe` (le nom porte la date d'export). */
async function fichierGaspar(dossier, prefixe) {
  const noms = (await readdir(dossier)).filter((n) => n.startsWith(prefixe) && n.endsWith(".csv")).sort();
  if (!noms.length) throw new Error(`Aucun fichier ${prefixe}*.csv dans ${dossier}`);
  const nom = noms[noms.length - 1];
  const date = nom.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  return { chemin: path.join(dossier, nom), date };
}

/** Découpe une ligne CSV (séparateur donné, guillemets doublés). */
function decouper(ligne, sep) {
  const champs = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (ligne[i + 1] === '"') {
          courant += '"';
          i++;
        } else entreGuillemets = false;
      } else courant += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === sep) {
      champs.push(courant);
      courant = "";
    } else courant += c;
  }
  champs.push(courant);
  return champs;
}

/** Les fichiers GASPAR sont en latin-1 ; on le vérifie plutôt que de le supposer. */
async function encodageDe(chemin) {
  const fd = await readFile(chemin);
  const extrait = fd.subarray(0, Math.min(fd.length, 4_000_000));
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(extrait);
    return "utf8";
  } catch {
    return "latin1";
  }
}

async function lireCsv(chemin, sep, surLigne) {
  const encoding = await encodageDe(chemin);
  const rl = createInterface({ input: createReadStream(chemin, { encoding }) });
  let idx = null;
  let n = 0;
  for await (const brute of rl) {
    const ligne = brute.replace(/^﻿/, "");
    if (!ligne.trim()) continue;
    const v = decouper(ligne, sep);
    if (!idx) {
      idx = Object.fromEntries(v.map((k, i) => [k.trim(), i]));
      continue;
    }
    surLigne(v, idx);
    n++;
  }
  return n;
}

const compter = (carte, cle, poste) => {
  const c = carte.get(cle) ?? carte.set(cle, new Map()).get(cle);
  c.set(poste, (c.get(poste) ?? 0) + 1);
};
const enListe = (carteEffectifs) =>
  [...(carteEffectifs ?? new Map()).entries()]
    .filter(([, effectif]) => effectif > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .map(([libelle, effectif]) => ({ libelle, effectif }));

// ----------------------------------------------------------- API Géorisques

async function appelerApi(point, codes) {
  const url = `${API}/${point}?code_insee=${codes.join(",")}&page_size=${LOT_API}`;
  for (let essai = 0; essai < 5; essai++) {
    try {
      const reponse = await fetch(url, { headers: { accept: "application/json", "user-agent": "ou-vivre/1.0" } });
      if (reponse.status === 429 || reponse.status >= 500) throw new Error(`HTTP ${reponse.status}`);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const json = await reponse.json();
      if (!Array.isArray(json.data)) throw new Error(json.message ?? "réponse sans data");
      return json.data;
    } catch (e) {
      if (essai === 4) throw new Error(`${url} : ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** essai));
    }
  }
  return [];
}

/**
 * Interroge un point de l'API pour tous les codes manquants du cache, par
 * lots de vingt, quatre lots à la fois ; `extraire(entree)` donne la valeur
 * à garder. Le cache est réécrit régulièrement pour survivre à une coupure.
 */
async function collecterApi(point, codes, extraire) {
  const chemin = path.join(CACHE, "georisques", `${point}.json`);
  await mkdir(path.dirname(chemin), { recursive: true });
  const cache = existsSync(chemin) ? JSON.parse(await readFile(chemin, "utf8")) : {};
  const manquants = [...codes].filter((c) => !(c in cache));
  if (!manquants.length) {
    console.log(`${point} : ${Object.keys(cache).length} communes en cache.`);
    return cache;
  }
  if (SANS_API) {
    console.log(`${point} : ${manquants.length} communes hors cache, API non appelée (--sans-api).`);
    return cache;
  }
  const lots = [];
  for (let i = 0; i < manquants.length; i += LOT_API) lots.push(manquants.slice(i, i + LOT_API));
  console.log(`${point} : ${manquants.length} communes à interroger, ${lots.length} appels…`);
  let faits = 0;
  let depuisEcriture = 0;
  const ecrire = () => writeFile(chemin, JSON.stringify(cache), "utf8");
  const travailleur = async () => {
    while (lots.length) {
      const lot = lots.shift();
      const data = await appelerApi(point, lot);
      const vus = new Map(data.map((d) => [String(d.code_insee), extraire(d)]));
      for (const code of lot) cache[code] = vus.has(code) ? vus.get(code) : null;
      faits++;
      depuisEcriture++;
      if (depuisEcriture >= 50) {
        depuisEcriture = 0;
        await ecrire();
        process.stdout.write(`\r  ${faits}/${faits + lots.length} appels`);
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLELE }, travailleur));
  await ecrire();
  console.log(`\r  ${faits} appels faits, ${Object.keys(cache).length} communes en cache.`);
  return cache;
}

// ------------------------------------------------------------------- pilote

async function main() {
  const regions = [];
  const codes = new Set();
  for (const d of (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    try {
      const referentiel = JSON.parse(await readFile(path.join(RAW, d.name, "referentiel.json"), "utf8"));
      regions.push({ dossier: path.join(RAW, d.name), communes: referentiel.communes ?? [] });
      for (const c of referentiel.communes ?? []) codes.add(c.codeInsee);
    } catch {
      /* dossier sans référentiel */
    }
  }
  console.log(`${codes.size} communes dans ${regions.length} régions.`);

  // --- GASPAR
  const zip = await telecharger(GASPAR.zip, path.join(CACHE, "gaspar.zip"), "de l'export GASPAR (~8 Mo)");
  const dossier = path.join(CACHE, GASPAR.dossier);
  if (!existsSync(dossier) || !(await readdir(dossier)).some((n) => n.startsWith("catnat_gaspar"))) await dezipper(zip, dossier);
  const catnat = await fichierGaspar(dossier, "catnat_gaspar");
  const pprn = await fichierGaspar(dossier, "pprn_gaspar");
  const pprm = await fichierGaspar(dossier, "pprm_gaspar");
  const pprt = await fichierGaspar(dossier, "pprt_gaspar");
  const ddrm = await fichierGaspar(dossier, "ddrm_risq_gaspar");
  const dateExport = catnat.date;
  console.log(`Export GASPAR du ${dateExport}.`);

  // --- Rattachement des anciens codes (fusions) à la commune actuelle.
  const cheminMvt = await telecharger(MVT_COG.url, path.join(CACHE, MVT_COG.fichier), "des mouvements du COG");
  const successeur = new Map(); // ancien code → code de la commune qui l'a absorbé
  await lireCsv(cheminMvt, ",", (v, idx) => {
    if (!["31", "32", "33", "34"].includes(v[idx.MOD]) || v[idx.TYPECOM_AP] !== "COM" || v[idx.TYPECOM_AV] !== "COM") return;
    const av = v[idx.COM_AV];
    const ap = v[idx.COM_AP];
    if (av !== ap) successeur.set(av, ap);
  });
  const rattaches = new Map(); // code actuel → anciens codes effectivement rencontrés
  const actuel = (code) => {
    if (codes.has(code)) return code;
    let c = code;
    for (let i = 0; i < 6 && successeur.has(c); i++) {
      c = successeur.get(c);
      if (codes.has(c)) {
        (rattaches.get(c) ?? rattaches.set(c, new Set()).get(c)).add(code);
        return c;
      }
    }
    return null;
  };

  // --- Catastrophes naturelles : une reconnaissance = (arrêté, risque, période).
  const reconnaissances = new Map(); // code → Set de clés
  const parRisque = new Map(); // code → Map(libellé risque → effectif)
  const derniere = new Map(); // code → { annee, risque }
  let lignesCatnat = 0;
  let horsChamp = 0;
  const cles = new Set();
  await lireCsv(catnat.chemin, ";", (v, idx) => {
    lignesCatnat++;
    const code = actuel(v[idx.code_commune]);
    if (!code) {
      horsChamp++;
      return;
    }
    const risque = v[idx.lib_risque_jo].trim();
    const debut = v[idx.date_debut].slice(0, 10);
    const cle = `${code}|${v[idx.id_gaspar]}|${v[idx.num_risque_jo]}|${debut}|${v[idx.date_fin].slice(0, 10)}`;
    if (cles.has(cle)) return; // même reconnaissance vue sous un autre code d'une commune fusionnée
    cles.add(cle);
    (reconnaissances.get(code) ?? reconnaissances.set(code, new Set()).get(code)).add(cle);
    compter(parRisque, code, risque);
    const annee = Number(v[idx.date_publication_jo].slice(0, 4)) || Number(debut.slice(0, 4));
    const d = derniere.get(code);
    if (!d || annee > d.annee) derniere.set(code, { annee, risque });
  });
  console.log(`catnat : ${lignesCatnat} lignes, ${cles.size} reconnaissances sur ${reconnaissances.size} communes, ${horsChamp} lignes hors champ (outre-mer, codes inconnus).`);

  // --- Plans de prévention approuvés (sous-état « Approuvé »), par type de risque.
  const lirePpr = async (fichier) => {
    const approuves = new Map(); // code → Set(code procédure)
    const risques = new Map(); // code → Map(libellé risque → effectif)
    await lireCsv(fichier.chemin, ";", (v, idx) => {
      if (v[idx["LIBELLE SOUS-ETAT"]] !== "Approuvé") return;
      const code = actuel(v[idx["CODE INSEE COMMUNE"]]);
      if (!code) return;
      const procedure = v[idx["CODE PROCEDURE"]];
      const s = approuves.get(code) ?? approuves.set(code, new Set()).get(code);
      if (s.has(procedure)) return;
      s.add(procedure);
      compter(risques, code, v[idx["LIBELLE RISQUE 2"]].trim() || v[idx["LIBELLE RISQUE 1"]].trim());
    });
    return { approuves, risques };
  };
  const ppn = await lirePpr(pprn);
  const ppm = await lirePpr(pprm);
  const ppt = await lirePpr(pprt);
  console.log(`PPR approuvés : ${ppn.approuves.size} communes (naturels), ${ppm.approuves.size} (miniers), ${ppt.approuves.size} (technologiques).`);

  // --- Risques recensés dans le dossier départemental (niveau à deux chiffres).
  const recenses = new Map(); // code → Set(libellé)
  await lireCsv(ddrm.chemin, ";", (v, idx) => {
    if (v[idx.num_risque].trim().length !== 2) return;
    const code = actuel(v[idx.cod_commune]);
    if (!code) return;
    (recenses.get(code) ?? recenses.set(code, new Set()).get(code)).add(v[idx.lib_risque].trim());
  });
  console.log(`DDRM : ${recenses.size} communes avec des risques recensés.`);

  // --- API : zone sismique et potentiel radon.
  const sismique = await collecterApi("zonage_sismique", codes, (d) => Number(d.code_zone) || null);
  const radon = await collecterApi("radon", codes, (d) => Number(d.classe_potentiel) || null);

  // --- Vérification contre une valeur publique connue : Biarritz sur Géorisques.
  const b = "64122";
  const attendu = { catnat: 17, sismique: 3, radon: 2 };
  const obtenu = { catnat: reconnaissances.get(b)?.size ?? 0, sismique: sismique[b] ?? null, radon: radon[b] ?? null };
  for (const k of Object.keys(attendu)) {
    if (obtenu[k] !== attendu[k] && !(SANS_API && k !== "catnat" && obtenu[k] === null)) {
      throw new Error(`Vérification Biarritz : ${k} = ${obtenu[k]}, attendu ${attendu[k]} (Géorisques, fiche commune).`);
    }
  }
  console.log(`Vérification Biarritz : ${obtenu.catnat} reconnaissances CatNat, zone sismique ${obtenu.sismique}, radon ${obtenu.radon} — conforme à Géorisques.`);

  // --- Écriture par région.
  const consulteLe = new Date().toISOString().slice(0, 10);
  const annee = String(dateExport?.slice(0, 4) ?? new Date().getFullYear());
  let total = 0;
  for (const region of regions) {
    const communes = {};
    for (const c of region.communes) {
      const code = c.codeInsee;
      const d = derniere.get(code);
      communes[code] = {
        nom: c.nom,
        catnat: reconnaissances.get(code)?.size ?? 0,
        catnatParRisque: enListe(parRisque.get(code)),
        catnatDerniere: d ? { annee: d.annee, risque: d.risque } : null,
        pprnApprouves: ppn.approuves.get(code)?.size ?? 0,
        pprnRisques: enListe(ppn.risques.get(code)),
        pprmApprouves: ppm.approuves.get(code)?.size ?? 0,
        pprtApprouves: ppt.approuves.get(code)?.size ?? 0,
        risquesRecenses: recenses.has(code) ? [...recenses.get(code)].sort((a, b2) => a.localeCompare(b2, "fr")) : null,
        zoneSismique: sismique[code] ?? null,
        zoneSismiqueLibelle: sismique[code] ? ZONES_SISMIQUES[sismique[code]] ?? null : null,
        radon: radon[code] ?? null,
        codesRattaches: rattaches.has(code) ? [...rattaches.get(code)].sort() : undefined,
      };
      total++;
    }
    await writeFile(
      path.join(region.dossier, "risques.json"),
      JSON.stringify(
        {
          source: {
            nom: `Géorisques — base GASPAR (export national du ${dateExport}), zonage sismique réglementaire et potentiel radon`,
            nomCourt: `Géorisques ${annee}`,
            producteur: "Ministère de la Transition écologique (DGPR), BRGM, ASN",
            url: GASPAR.page,
            annee,
            licence: "Licence Ouverte / Etalab 2.0",
            consulteLe,
          },
          methodologie:
            `Reconnaissances de l'état de catastrophe naturelle depuis 1982 (base GASPAR, export du ${dateExport}) : une reconnaissance par arrêté, par type de risque et par période d'événement, telles que publiées au Journal officiel, avec la répartition par type de risque et la plus récente. ` +
            "Plans de prévention des risques naturels, miniers et technologiques comptés lorsque la procédure est approuvée (sous-état GASPAR « Approuvé »), par type de risque. Risques recensés dans le dossier départemental des risques majeurs (DDRM), au niveau des grandes familles. " +
            "Zone de sismicité réglementaire (1 très faible à 5 forte, décret n° 2010-1255) et potentiel radon des formations géologiques (catégories 1 à 3, cartographie IRSN) lus sur l'API Géorisques, commune par commune. " +
            "Pour une commune née d'une fusion, les lignes GASPAR restées au code d'une ancienne commune lui sont rattachées (mouvements du Code officiel géographique) ; les codes rattachés sont indiqués.",
          caveats: [
            "Un arrêté de catastrophe naturelle constate qu'un événement a touché la commune et ouvre l'indemnisation : il ne dit ni l'ampleur des dégâts ni la part du territoire concernée.",
            "La sécheresse (retrait-gonflement des argiles) pèse lourd depuis les années 2010 : une commune très reconnue l'est souvent pour ce seul risque.",
            "La zone de sismicité et le potentiel radon sont des classements réglementaires par commune, pas des mesures locales ; un bâtiment peut être plus ou moins exposé selon sa construction.",
            "Un plan de prévention approuvé signale un risque connu et encadré, pas un risque plus grand qu'ailleurs.",
          ],
          communes,
        },
        null,
        1,
      ),
      "utf8",
    );
  }
  console.log(`${total} communes écrites, ${rattaches.size} avec des lignes rattachées depuis une ancienne commune.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
