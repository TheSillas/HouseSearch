#!/usr/bin/env node
/**
 * Commerces et services — tous les équipements de la Base permanente des
 * équipements (INSEE, BPE 2025) par commune, et les gammes d'équipements de
 * l'INSEE qui servent à les lire.
 *
 *   node scripts/importer-equipements.mjs [--dossier <cache>]
 *
 * La BPE dénombre 236 types d'équipements par commune (commerces, services,
 * enseignement, santé, transports, sports, loisirs, culture, tourisme). L'INSEE
 * en tire trois « gammes » selon la fréquence d'implantation : proximité (26
 * types ou regroupements, présents dans le plus grand nombre de communes),
 * intermédiaire (48) et supérieure (61). Une commune qui possède au moins la
 * moitié des types d'une gamme en est un « pôle » au sens de l'INSEE.
 *
 * Écrit `data/raw/<région>/equipements.json` : la composition des gammes 2025
 * (fichier INSEE `BPE_gammes_equipements_2025.xlsx`) et, par commune, le nombre
 * d'équipements de chaque type (un type sans ligne vaut zéro : la BPE est
 * exhaustive).
 */
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const args = process.argv.slice(2);
const CACHE = args.includes("--dossier") ? path.resolve(args[args.indexOf("--dossier") + 1]) : path.join(RACINE, ".cache-insee");

const BPE = {
  page: "https://www.insee.fr/fr/statistiques/8217527",
  zip: "https://www.insee.fr/fr/statistiques/fichier/8217527/DS_BPE_CSV_FR.zip",
  dossier: "bpe",
  fichier: "DS_BPE_2025_data.csv",
};
const GAMMES = {
  page: "https://www.insee.fr/fr/statistiques/8217535?sommaire=8217537",
  url: "https://www.insee.fr/fr/statistiques/fichier/8217535/BPE_gammes_equipements_2025.xlsx",
  fichier: "gammes2025.xlsx",
};
const ANNEE = "2025";
const nettoyer = (s) => s.replace(/^"|"$/g, "");

async function telecharger(url, chemin) {
  console.log(`Téléchargement ${path.basename(chemin)}…`);
  const reponse = await fetch(url, { headers: { "user-agent": "ou-vivre/1.0" } });
  if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
  await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
}

/** Composition des gammes : type → { regroupement, libelle, gamme } et regroupement → libellé. */
async function lireGammes() {
  const chemin = path.join(CACHE, GAMMES.fichier);
  if (!existsSync(chemin)) await telecharger(GAMMES.url, chemin);
  const wb = XLSX.readFile(chemin);
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const types = {};
  const regroupements = {};
  const NOMS = { "Gamme de proximité": "proximite", "Gamme intermédiaire": "intermediaire", "Gamme supérieure": "superieure", "Hors Gamme": "hors" };
  for (const l of lignes) {
    if (l.length < 9 || !/^[A-G]\d{3}$/.test(String(l[2]))) continue;
    const gamme = NOMS[l[4]];
    if (!gamme) continue;
    const regroupement = String(l[0]);
    types[l[2]] = { regroupement, libelle: titre(String(l[3])), gamme, sousDomaine: String(l[6]), domaine: String(l[8]) };
    regroupements[regroupement] ??= { libelle: titre(String(l[1])), gamme, types: [] };
    regroupements[regroupement].types.push(String(l[2]));
  }
  return { types, regroupements };
}

/** « BOULANGERIE-PÂTISSERIE » → « Boulangerie-pâtisserie » : les libellés INSEE sont en capitales. */
function titre(s) {
  const bas = s.toLowerCase().replace(/’/g, "'");
  return bas.charAt(0).toUpperCase() + bas.slice(1);
}

async function lireBpe(codes) {
  const chemin = path.join(CACHE, BPE.dossier, BPE.fichier);
  if (!existsSync(chemin)) {
    throw new Error(`${chemin} absent : lancer d'abord importer-insee.mjs, qui télécharge et décompresse la BPE.`);
  }
  const rl = createInterface({ input: createReadStream(chemin, { encoding: "utf8" }) });
  let idx = null;
  const out = new Map();
  for await (const ligne of rl) {
    const v = ligne.split(";").map(nettoyer);
    if (!idx) {
      idx = Object.fromEntries(v.map((k, i) => [k, i]));
      continue;
    }
    if (v[idx.GEO_OBJECT] !== "COM" || v[idx.BPE_MEASURE] !== "FACILITIES" || v[idx.TIME_PERIOD] !== ANNEE) continue;
    const code = v[idx.GEO];
    if (!codes.has(code)) continue;
    const type = v[idx.FACILITY_TYPE];
    if (!/^[A-G]\d{3}$/.test(type)) continue;
    const n = Number(v[idx.OBS_VALUE]);
    if (!Number.isFinite(n) || n <= 0) continue;
    (out.get(code) ?? out.set(code, {}).get(code))[type] = n;
  }
  return out;
}

async function main() {
  await mkdir(CACHE, { recursive: true });
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
  const gammes = await lireGammes();
  const nb = (g) => Object.values(gammes.regroupements).filter((r) => r.gamme === g).length;
  console.log(`Gammes 2025 : ${nb("proximite")} de proximité, ${nb("intermediaire")} intermédiaires, ${nb("superieure")} supérieures.`);
  const bpe = await lireBpe(codes);
  console.log(`BPE : ${bpe.size} communes avec au moins un équipement.`);

  const consulteLe = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const region of regions) {
    const communes = {};
    for (const c of region.communes) {
      communes[c.codeInsee] = { nom: c.nom, types: bpe.get(c.codeInsee) ?? {} };
      total += 1;
    }
    await writeFile(
      path.join(region.dossier, "equipements.json"),
      JSON.stringify(
        {
          source: {
            nom: "Base permanente des équipements (BPE) 2025, fichier de dénombrement général des équipements par commune (DS_BPE_CSV_FR) ; composition des gammes d'équipements 2025",
            nomCourt: "BPE 2025",
            producteur: "INSEE",
            url: BPE.page,
            urlGammes: GAMMES.page,
            annee: "2025",
            licence: "Licence Ouverte / Etalab 2.0",
            consulteLe,
          },
          methodologie:
            "Dénombrement des équipements implantés sur la commune au 1er janvier 2025, tous types (DS_BPE_CSV_FR, lignes GEO_OBJECT = COM, BPE_MEASURE = FACILITIES). La BPE étant exhaustive, un type sans ligne vaut zéro. " +
            "Les gammes sont celles de l'INSEE pour 2025 (BPE_gammes_equipements_2025.xlsx) : un type ou regroupement de la gamme est « présent » si la commune en compte au moins un ; le nombre de types présents sur le total de la gamme est le seul chiffre qui classe.",
          caveats: [
            "Un équipement est compté dans sa commune d'implantation : un supermarché à la sortie du bourg voisin n'apparaît pas ici.",
            "La BPE compte des établissements, pas leur taille ni leurs horaires : une supérette et un hypermarché sont un équipement chacun.",
            "Les gammes de l'INSEE mesurent la diversité de l'offre, pas sa qualité.",
          ],
          gammes,
          communes,
        },
        null,
        0,
      ),
      "utf8",
    );
  }
  console.log(`${total} communes écrites.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
