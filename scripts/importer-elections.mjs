#!/usr/bin/env node
/**
 * Historique électoral — résultats officiels du ministère de l'Intérieur et
 * Répertoire national des élus, pour toutes les communes.
 *
 *   node scripts/importer-elections.mjs [--dossier <cache>]
 *
 * Fichiers nationaux (data.gouv.fr), les mêmes que la première extraction :
 *  - municipales 2026, résultats par commune, 1er et 2nd tour ; candidatures du
 *    1er tour pour les noms des têtes de liste (vides dans le fichier de résultats) ;
 *  - Répertoire national des élus, fichier des maires (version du 11 août 2026) ;
 *  - européennes 2024, résultats définitifs par commune ;
 *  - présidentielle 2022, 1er et 2nd tour, résultats par commune (fichiers latin1).
 *
 * Tout est repris tel que publié : libellés, nuances, voix, pourcentages. Aucun
 * qualificatif, aucune couleur. Pour une commune née d'une fusion postérieure au
 * scrutin de 2022, le résultat est reconstitué en additionnant les communes
 * fusionnées (mouvements du Code officiel géographique) et signalé comme tel.
 *
 * Écrit `data/raw/<région>/elections.json` au schéma consommé par build-dataset.mjs.
 */
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const args = process.argv.slice(2);
const CACHE = path.join(
  args.includes("--dossier") ? path.resolve(args[args.indexOf("--dossier") + 1]) : path.join(RACINE, ".cache-insee"),
  "elections",
);

const JEUX = [
  {
    usage: "municipales 2026 - 1er tour",
    nom: "Municipales 2026 - Resultats - Communes_2026-03-20.csv",
    urlPage: "https://www.data.gouv.fr/datasets/elections-municipales-2026-resultats-du-premier-tour",
    urlRessource:
      "https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260320-164339/municipales-2026-resultats-communes-2026-03-20.csv",
    licence: "lov2",
  },
  {
    usage: "municipales 2026 - 2nd tour",
    nom: "Municipales 2026 - Resultats - Communes_2026-03-23_16h14.csv",
    urlPage: "https://www.data.gouv.fr/datasets/elections-municipales-2026-resultats-du-second-tour",
    urlRessource:
      "https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-scond-tour/20260323-180124/municipales-2026-resultats-communes-2026-03-23-16h14.csv",
    licence: "lov2",
  },
  {
    usage: "noms des tetes de liste au 1er tour (colonnes 'Nom candidat N' vides dans le fichier de resultats T1)",
    nom: "Municipales 2026 - Candidatures France entiere - Tour 1",
    urlPage: "https://www.data.gouv.fr/datasets/elections-municipales-2026-listes-candidates-au-premier-tour",
    urlRessource:
      "https://static.data.gouv.fr/resources/elections-municipales-2026-listes-candidates-au-premier-tour/20260313-152615/municipales-2026-candidatures-france-entiere-tour-1-2026-03-13.csv",
    licence: "lov2",
  },
  {
    usage: "nom du maire en fonction",
    nom: "Repertoire national des elus - elus-maire-mai.csv",
    urlPage: "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1",
    urlRessource: "https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/20260811-155100/elus-maire-mai.csv",
    licence: "lov2",
  },
  {
    usage: "europeennes 2024",
    nom: "Resultats definitifs par commune - europeennes 2024",
    urlPage: "https://www.data.gouv.fr/datasets/resultats-des-elections-europeennes-du-9-juin-2024",
    urlRessource:
      "https://static.data.gouv.fr/resources/resultats-des-elections-europeennes-du-9-juin-2024/20240613-154634/resultats-definitifs-par-commune.csv",
    licence: "lov2",
  },
  {
    usage: "presidentielle 2022 - 1er tour",
    nom: "resultats-par-niveau-subcom-t1-france-entiere.txt",
    urlPage: "https://www.data.gouv.fr/datasets/election-presidentielle-des-10-avril-et-24-avril-2022-resultats-du-1er-tour",
    urlRessource:
      "https://static.data.gouv.fr/resources/election-presidentielle-des-10-avril-et-24-avril-2022-resultats-du-1er-tour/20220411-110616/resultats-par-niveau-subcom-t1-france-entiere.txt",
    licence: "lov2",
  },
  {
    usage: "presidentielle 2022 - 2nd tour",
    nom: "resultats-par-niveau-subcom-t2-france-entiere.txt",
    urlPage: "https://www.data.gouv.fr/datasets/election-presidentielle-des-10-et-24-avril-2022-resultats-du-second-tour",
    urlRessource:
      "https://static.data.gouv.fr/resources/election-presidentielle-des-10-et-24-avril-2022-resultats-du-second-tour/20220425-100403/resultats-par-niveau-subcom-t2-france-entiere.txt",
    licence: "lov2",
  },
];
const MVT_COG = {
  url: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_mvt_commune_2025.csv",
  fichier: "mvt-communes-2025.csv",
};
const DATES = { mun_t1: "2026-03-15", mun_t2: "2026-03-22", eur: "2024-06-09", pres_t1: "2022-04-10", pres_t2: "2022-04-24" };

// ------------------------------------------------------------------ utilitaires

/** Découpe une ligne CSV `;` où certains champs sont entre guillemets doublés. */
function decouper(ligne, separateur = ";") {
  const champs = [];
  let courant = "";
  let q = false;
  for (let i = 0; i < ligne.length; i++) {
    const ch = ligne[i];
    if (q) {
      if (ch === '"') {
        if (ligne[i + 1] === '"') {
          courant += '"';
          i += 1;
        } else q = false;
      } else courant += ch;
    } else if (ch === '"') q = true;
    else if (ch === separateur) {
      champs.push(courant);
      courant = "";
    } else courant += ch;
  }
  champs.push(courant);
  return champs.map((c) => c.replace(/^﻿/, "").trim());
}
const entier = (s) => {
  if (s === undefined || s === null || s === "") return null;
  const n = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const pct = (s) => {
  if (s === undefined || s === null || s === "") return null;
  const n = Number(String(s).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const normaliser = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function assurer(jeu, nomFichier, url) {
  await mkdir(CACHE, { recursive: true });
  const chemin = path.join(CACHE, nomFichier);
  if (!existsSync(chemin)) {
    console.log(`Téléchargement ${nomFichier}…`);
    const reponse = await fetch(url, { headers: { "user-agent": "ou-vivre/1.0" } });
    if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
    await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
  }
  return chemin;
}

/** Lit un CSV `;` en flux ; `surLigne(valeurs, index)` reçoit chaque ligne de données. */
async function lireCsv(chemin, surLigne, encodage = "utf8", separateur = ";") {
  const rl = createInterface({ input: createReadStream(chemin, { encoding: encodage }) });
  let idx = null;
  let entete = null;
  for await (const ligne of rl) {
    if (!ligne.trim()) continue;
    const v = decouper(ligne, separateur);
    if (!idx) {
      entete = v;
      idx = Object.fromEntries(entete.map((k, i) => [k, i]));
      continue;
    }
    surLigne(v, idx, entete);
  }
}

// --------------------------------------------------------- scrutins de liste

/**
 * Lit les colonnes répétées « … N » d'un fichier de résultats par liste (municipales,
 * européennes) : statistiques du bureau et listes classées par voix décroissantes.
 */
function lireResultatsListes(v, idx, entete, options) {
  const listes = [];
  for (let n = 1; ; n++) {
    const iLib = idx[`Libellé de liste ${n}`];
    if (iLib === undefined) break;
    const libelle = v[iLib];
    if (!libelle) continue;
    const l = {
      nuance: v[idx[`Nuance liste ${n}`]] || null,
      libelleListe: libelle,
      voix: entier(v[idx[`Voix ${n}`]]),
      pctExprimes: pct(v[idx[`% Voix/exprimés ${n}`]]),
    };
    if (options.sieges) {
      const iS = idx[`Sièges au CM ${n}`] ?? idx[`Sièges ${n}`];
      l.siegesCM = iS !== undefined ? entier(v[iS]) : null;
    }
    if (options.candidat) {
      const nom = v[idx[`Nom candidat ${n}`]];
      const prenom = v[idx[`Prénom candidat ${n}`]];
      if (nom) {
        l.teteDeListe = `${prenom ?? ""} ${nom}`.trim();
        l.teteDeListeSource = "resultats";
      }
    }
    listes.push(l);
  }
  listes.sort((a, b) => (b.voix ?? -1) - (a.voix ?? -1));
  listes.forEach((l, i) => (l.rang = i + 1));
  const stats = {
    inscrits: entier(v[idx.Inscrits]),
    votants: entier(v[idx.Votants]),
    abstentions: entier(v[idx.Abstentions]),
    exprimes: entier(v[idx.Exprimés]),
    blancs: entier(v[idx.Blancs]),
    nuls: entier(v[idx.Nuls]),
    participationPct: pct(v[idx["% Votants"]]),
    abstentionPct: pct(v[idx["% Abstentions"]]),
    nbListes: listes.length,
    listes,
  };
  return stats;
}

// ------------------------------------------------------------ présidentielle

/** Fichiers 2022 (latin1) : dept + commune sur 3 chiffres, puis groupes de 7 colonnes par candidat. */
function lirePresidentielle(v, idx, entete) {
  const dept = v[idx["Code du département"]];
  const com = v[idx["Code de la commune"]];
  if (!dept || !com || dept.length > 2) return null;
  const code = `${dept}${com.padStart(3, "0")}`;
  const debut = entete.indexOf("N°Panneau");
  const candidats = [];
  for (let i = debut; i + 4 < v.length; i += 7) {
    const nom = v[i + 2];
    if (!nom) continue;
    candidats.push({ nom, prenom: v[i + 3], voix: entier(v[i + 4]) ?? 0, pctExprimes: pct(v[i + 6]) });
  }
  return {
    code,
    inscrits: entier(v[idx.Inscrits]),
    votants: entier(v[idx.Votants]),
    abstentions: entier(v[idx.Abstentions]),
    exprimes: entier(v[idx["Exprimés"]]),
    blancs: entier(v[idx.Blancs]),
    nuls: entier(v[idx.Nuls]),
    candidats,
  };
}

/** Additionne plusieurs communes de 2022 (fusion postérieure) ; pourcentages recalculés sur le total. */
function agregerPresidentielle(lignes) {
  const somme = (cle) => lignes.reduce((n, l) => n + (l[cle] ?? 0), 0);
  const parCandidat = new Map();
  for (const l of lignes) {
    for (const c of l.candidats) {
      const cle = `${c.nom}|${c.prenom}`;
      const e = parCandidat.get(cle) ?? { nom: c.nom, prenom: c.prenom, voix: 0 };
      e.voix += c.voix ?? 0;
      parCandidat.set(cle, e);
    }
  }
  const exprimes = somme("exprimes");
  const inscrits = somme("inscrits");
  const votants = somme("votants");
  const candidats = [...parCandidat.values()].map((c) => ({
    ...c,
    pctExprimes: exprimes ? Math.round((c.voix / exprimes) * 10000) / 100 : null,
  }));
  return {
    inscrits,
    votants,
    abstentions: somme("abstentions"),
    exprimes,
    blancs: somme("blancs"),
    nuls: somme("nuls"),
    participationPct: inscrits ? Math.round((votants / inscrits) * 10000) / 100 : null,
    abstentionPct: inscrits ? Math.round(((inscrits - votants) / inscrits) * 10000) / 100 : null,
    candidats,
  };
}

function finaliserPresidentielle(lignes, maxi) {
  const p = lignes.length === 1 ? { ...lignes[0] } : agregerPresidentielle(lignes);
  if (lignes.length === 1) {
    p.participationPct = p.inscrits ? Math.round((p.votants / p.inscrits) * 10000) / 100 : null;
    p.abstentionPct = p.inscrits ? Math.round((p.abstentions / p.inscrits) * 10000) / 100 : null;
  }
  const candidats = [...p.candidats].sort((a, b) => b.voix - a.voix).map((c, i) => ({ rang: i + 1, ...c }));
  return { ...p, candidats: candidats.slice(0, maxi), nbCandidats: candidats.length };
}

// ----------------------------------------------------------------------- main

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

  const fichiers = {};
  for (const jeu of JEUX) fichiers[jeu.usage] = await assurer(jeu, path.basename(jeu.urlRessource), jeu.urlRessource);
  const cheminMvt = await assurer(null, MVT_COG.fichier, MVT_COG.url);

  // Municipales : résultats des deux tours.
  const munT1 = new Map();
  const munT2 = new Map();
  await lireCsv(fichiers["municipales 2026 - 1er tour"], (v, idx, entete) => {
    const code = v[idx["Code commune"]];
    if (codes.has(code)) munT1.set(code, lireResultatsListes(v, idx, entete, { sieges: true, candidat: true }));
  });
  await lireCsv(fichiers["municipales 2026 - 2nd tour"], (v, idx, entete) => {
    const code = v[idx["Code commune"]];
    if (codes.has(code)) munT2.set(code, lireResultatsListes(v, idx, entete, { sieges: true, candidat: true }));
  });
  console.log(`Municipales : ${munT1.size} communes au 1er tour, ${munT2.size} au second.`);

  // Têtes de liste (candidatures du 1er tour) : commune + libellé de liste → « Prénom NOM ».
  const tetes = new Map();
  await lireCsv(fichiers[JEUX[2].usage], (v, idx) => {
    if (v[idx["Tête de liste"]] !== "OUI") return;
    const code = v[idx["Code circonscription"]];
    if (!codes.has(code)) return;
    const libelle = v[idx["Libellé de la liste"]];
    tetes.set(`${code}|${normaliser(libelle)}`, `${v[idx["Prénom sur le bulletin de vote"]]} ${v[idx["Nom sur le bulletin de vote"]]}`.trim());
  });
  console.log(`Têtes de liste : ${tetes.size}.`);

  // Maires.
  const maires = new Map();
  await lireCsv(fichiers["nom du maire en fonction"], (v, idx) => {
    const code = v[idx["Code de la commune"]];
    if (!codes.has(code)) return;
    maires.set(code, {
      nom: v[idx["Nom de l'élu"]],
      prenom: v[idx["Prénom de l'élu"]],
      dateDebutMandat: v[idx["Date de début du mandat"]] || null,
      dateDebutFonction: v[idx["Date de début de la fonction"]] || null,
      categorieSocioPro: v[idx["Libellé de la catégorie socio-professionnelle"]] || null,
    });
  });
  console.log(`Maires : ${maires.size}.`);

  // Européennes 2024.
  const eur = new Map();
  await lireCsv(fichiers["europeennes 2024"], (v, idx, entete) => {
    const code = v[idx["Code commune"]];
    if (codes.has(code)) eur.set(code, lireResultatsListes(v, idx, entete, { sieges: false, candidat: false }));
  });
  console.log(`Européennes : ${eur.size} communes.`);

  // Présidentielle 2022 : lignes 2022 par code, puis rattachement des fusions.
  const presT1 = new Map();
  const presT2 = new Map();
  for (const [usage, cible] of [["presidentielle 2022 - 1er tour", presT1], ["presidentielle 2022 - 2nd tour", presT2]]) {
    await lireCsv(
      fichiers[usage],
      (v, idx, entete) => {
        const p = lirePresidentielle(v, idx, entete);
        if (p) cible.set(p.code, p);
      },
      "latin1",
    );
  }
  // Fusions postérieures au 24 avril 2022 : COM_AV absorbée par COM_AP.
  const absorbees = new Map(); // code actuel → codes de 2022 à additionner
  // Le fichier des mouvements du COG est en virgules.
  await lireCsv(
    cheminMvt,
    (v, idx) => {
      if (v[idx.MOD] !== "32" || v[idx.TYPECOM_AP] !== "COM" || v[idx.DATE_EFF] <= DATES.pres_t2) return;
      const ap = v[idx.COM_AP];
      const av = v[idx.COM_AV];
      if (!codes.has(ap) || av === ap) return;
      (absorbees.get(ap) ?? absorbees.set(ap, new Set()).get(ap)).add(av);
    },
    "utf8",
    ",",
  );
  const lignesPres = (carte, code) => {
    const lignes = [];
    const sources = [];
    if (carte.has(code)) {
      lignes.push(carte.get(code));
      sources.push(code);
    }
    for (const av of absorbees.get(code) ?? []) {
      if (carte.has(av)) {
        lignes.push(carte.get(av));
        sources.push(av);
      }
    }
    return { lignes, sources };
  };
  console.log(`Présidentielle : ${presT2.size} communes de 2022, ${absorbees.size} communes actuelles issues d'une fusion depuis.`);

  const consulteLe = new Date().toISOString().slice(0, 10);
  let total = 0;
  let avecMun = 0;
  let avecMaire = 0;
  let agregees = 0;
  const nuancesModele = path.join(RAW, "ain", "nuances.json");
  for (const region of regions) {
    const communes = {};
    for (const c of region.communes) {
      const code = c.codeInsee;
      const sortie = { nom: c.nom };
      const t1 = munT1.get(code);
      const t2 = munT2.get(code);
      const ecrireTour = (prefixe, t, date) => {
        sortie[`${prefixe}date`] = t ? date : null;
        for (const k of ["inscrits", "votants", "abstentions", "exprimes", "blancs", "nuls", "participationPct", "abstentionPct", "nbListes"]) {
          sortie[`${prefixe}${k}`] = t ? t[k] : null;
        }
        sortie[`${prefixe}listes`] = t
          ? t.listes.map((l) => {
              const tete = l.teteDeListe ?? tetes.get(`${code}|${normaliser(l.libelleListe)}`);
              const liste = { rang: l.rang, nuance: l.nuance, libelleListe: l.libelleListe };
              if (tete) {
                liste.teteDeListe = tete;
                liste.teteDeListeSource = l.teteDeListeSource ?? "candidatures";
              }
              liste.voix = l.voix;
              liste.pctExprimes = l.pctExprimes;
              liste.siegesCM = l.siegesCM;
              return liste;
            })
          : null;
      };
      const maire = maires.get(code);
      if (maire) {
        sortie.maire_nom = maire.nom;
        sortie.maire_prenom = maire.prenom;
        sortie.maire_dateDebutMandat = maire.dateDebutMandat;
        sortie.maire_dateDebutFonction = maire.dateDebutFonction;
        sortie.maire_categorieSocioPro = maire.categorieSocioPro;
        avecMaire += 1;
      }
      if (t1 || t2) {
        const tourDecisif = t2 ? 2 : 1;
        const decisif = t2 ?? t1;
        const tete1 = decisif.listes[0];
        sortie.mun2026_nuanceListeArriveeEnTete = tete1?.nuance ?? null;
        sortie.mun2026_tourDecisif = tourDecisif;
        sortie.mun2026_dateTourDecisif = tourDecisif === 2 ? DATES.mun_t2 : DATES.mun_t1;
        ecrireTour("mun2026_t1_", t1, DATES.mun_t1);
        ecrireTour("mun2026_t2_", t2, DATES.mun_t2);
        sortie.mun2026_t2_statut = t2 ? null : "conseil_municipal_elu_au_premier_tour";
        if (maire && tete1) {
          const teteNom = normaliser(sortie[`mun2026_t${tourDecisif}_listes`][0]?.teteDeListe ?? "");
          const nomMaire = normaliser(maire.nom);
          const prenomMaire = normaliser(maire.prenom);
          sortie.maire_estTeteDeListeArriveeEnTete =
            teteNom.length > 0 && teteNom.includes(nomMaire) && (prenomMaire === "" || teteNom.includes(prenomMaire.split(" ")[0]));
        } else if (maire) {
          sortie.maire_estTeteDeListeArriveeEnTete = false;
        }
        avecMun += 1;
      }
      const e = eur.get(code);
      sortie.eur2024_date = e ? DATES.eur : null;
      for (const k of ["inscrits", "votants", "abstentions", "exprimes", "blancs", "nuls", "participationPct", "abstentionPct", "nbListes"]) {
        sortie[`eur2024_${k}`] = e ? e[k] : null;
      }
      // Les cinq premières listes seulement (38 en présence) : c'est ce que la fiche affiche, le total reste dans nbListes.
      sortie.eur2024_listes = e
        ? e.listes.slice(0, 5).map((l) => ({ rang: l.rang, nuance: l.nuance, libelleListe: l.libelleListe, voix: l.voix, pctExprimes: l.pctExprimes }))
        : null;

      for (const [tour, carte, date, maxi] of [["t1", presT1, DATES.pres_t1, 5], ["t2", presT2, DATES.pres_t2, 2]]) {
        const { lignes, sources } = lignesPres(carte, code);
        const p = lignes.length ? finaliserPresidentielle(lignes, maxi) : null;
        sortie[`pres2022_${tour}_date`] = p ? date : null;
        for (const k of ["inscrits", "votants", "abstentions", "exprimes", "blancs", "nuls", "participationPct", "abstentionPct", "nbCandidats"]) {
          sortie[`pres2022_${tour}_${k}`] = p ? p[k] : null;
        }
        sortie[`pres2022_${tour}_candidats`] = p ? p.candidats : null;
        if (tour === "t2" && sources.length > 1) {
          sortie.pres2022_agregeDepuis = sources;
          agregees += 1;
        }
      }
      communes[code] = sortie;
      total += 1;
    }
    await writeFile(
      path.join(region.dossier, "elections.json"),
      JSON.stringify(
        {
          source: {
            jeux: JEUX,
            producteur: "Ministère de l'Intérieur (résultats électoraux, Répertoire national des élus)",
            url: "https://www.data.gouv.fr/",
            methode:
              "Fichiers nationaux lus en flux ; libellés, nuances, voix et pourcentages repris tels que publiés. Têtes de liste des municipales prises dans le fichier des candidatures du 1er tour (colonnes vides dans les résultats). Le maire n'hérite de la nuance de la liste arrivée en tête que s'il en était la tête de liste. Présidentielle 2022 : pour une commune née d'une fusion postérieure au scrutin, addition des communes fusionnées (mouvements du COG 2025), signalée par pres2022_agregeDepuis.",
            consulteLe,
          },
          communes,
        },
        null,
        1,
      ),
      "utf8",
    );
    // La grille des nuances est nationale : chaque région en a une copie.
    const cibleNuances = path.join(region.dossier, "nuances.json");
    if (!existsSync(cibleNuances) && existsSync(nuancesModele)) await copyFile(nuancesModele, cibleNuances);
  }
  console.log(`${total} communes écrites : ${avecMun} avec des municipales, ${avecMaire} avec un maire, ${agregees} présidentielles reconstituées après fusion.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
