#!/usr/bin/env node
/**
 * Écoles — résultats aux examens (DEPP), agrégés par commune d'implantation,
 * pour toutes les communes.
 *
 *   node scripts/importer-ecoles-depp.mjs [--dossier <cache>]
 *
 * Sources (data.education.gouv.fr, session 2025) :
 *  - IVAC collèges `fr-en-indicateurs-valeur-ajoutee-colleges` : candidats, taux de
 *    réussite et valeur ajoutée au DNB, série générale ; la commune vient de
 *    l'annuaire de l'éducation (UAI → code commune) ;
 *  - IVAL lycées `fr-en-indicateurs-de-resultat-des-lycees-gt_v2` et `…-pro_v2` :
 *    présents, taux de réussite et valeur ajoutée au baccalauréat, toutes séries.
 *
 * Règle, celle des premières extractions (retrouvée à l'identique sur Ambérieu-en-
 * Bugey et Bourg-en-Bresse) : moyenne des établissements implantés sur la commune
 * pondérée par les candidats (DNB) ou les présents (bac) ; la valeur ajoutée est
 * moyennée de même sur les seuls établissements où elle est publiée. Une commune
 * sans collège ou sans lycée évalué garde des champs absents — jamais 0, jamais une
 * valeur départementale. Ce n'est PAS un indicateur de secteur scolaire de résidence.
 *
 * Complète `data/raw/<région>/ecoles.json` (produit par importer-insee.mjs) : les
 * dénombrements BPE y restent, les champs DEPP sont remplacés pour toutes les communes.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const args = process.argv.slice(2);
const CACHE = path.join(
  args.includes("--dossier") ? path.resolve(args[args.indexOf("--dossier") + 1]) : path.join(RACINE, ".cache-insee"),
  "depp",
);
const SESSION = "2025";
const API = "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets";
const JEUX = {
  colleges: {
    id: "fr-en-indicateurs-valeur-ajoutee-colleges",
    filtre: `refine=session:${SESSION}`,
    page: "https://data.education.gouv.fr/explore/dataset/fr-en-indicateurs-valeur-ajoutee-colleges/",
  },
  lyceesGt: {
    id: "fr-en-indicateurs-de-resultat-des-lycees-gt_v2",
    filtre: `refine=annee:${SESSION}`,
    page: "https://data.education.gouv.fr/explore/dataset/fr-en-indicateurs-de-resultat-des-lycees-gt_v2/",
  },
  lyceesPro: {
    id: "fr-en-indicateurs-de-resultat-des-lycees-pro_v2",
    filtre: `refine=annee:${SESSION}`,
    page: "https://data.education.gouv.fr/explore/dataset/fr-en-indicateurs-de-resultat-des-lycees-pro_v2/",
  },
  annuaire: {
    id: "fr-en-annuaire-education",
    filtre: `select=identifiant_de_l_etablissement,code_commune&refine=type_etablissement:Coll%C3%A8ge`,
    page: "https://data.education.gouv.fr/explore/dataset/fr-en-annuaire-education/",
  },
};

const num = (s) => {
  if (s === undefined || s === null || s === "" || s === "NA") return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** CSV `;` d'Opendatasoft : guillemets doublés, champs multilignes possibles. */
function lireCsv(texte) {
  const lignes = [];
  let champ = "";
  let ligne = [];
  let q = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (q) {
      if (ch === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i += 1;
        } else q = false;
      } else champ += ch;
    } else if (ch === '"') q = true;
    else if (ch === ";") {
      ligne.push(champ);
      champ = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texte[i + 1] === "\n") i += 1;
      ligne.push(champ);
      champ = "";
      if (ligne.length > 1 || ligne[0] !== "") lignes.push(ligne);
      ligne = [];
    } else champ += ch;
  }
  if (champ !== "" || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  const entete = lignes[0].map((k) => k.replace(/^﻿/, ""));
  return lignes.slice(1).map((l) => Object.fromEntries(entete.map((k, i) => [k, l[i] ?? ""])));
}

async function charger(cle) {
  await mkdir(CACHE, { recursive: true });
  const jeu = JEUX[cle];
  const chemin = path.join(CACHE, `${cle}-${SESSION}.csv`);
  if (!existsSync(chemin)) {
    const url = `${API}/${jeu.id}/exports/csv?${jeu.filtre}&delimiter=%3B&use_labels=false`;
    console.log(`Téléchargement ${cle}…`);
    const reponse = await fetch(url, { headers: { "user-agent": "ou-vivre/1.0" } });
    if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
    await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
  }
  return lireCsv(await readFile(chemin, "utf8"));
}

/** Moyenne pondérée arrondie au centième, sur les seules lignes où la valeur est publiée. */
function ponderee(lignes, poids, valeur) {
  let somme = 0;
  let total = 0;
  for (const l of lignes) {
    const p = poids(l);
    const v = valeur(l);
    if (p === null || p <= 0 || v === null) continue;
    somme += p * v;
    total += p;
  }
  return total > 0 ? Math.round((somme / total) * 100) / 100 : null;
}

async function main() {
  const [colleges, gt, pro, annuaire] = await Promise.all([
    charger("colleges"),
    charger("lyceesGt"),
    charger("lyceesPro"),
    charger("annuaire"),
  ]);
  const communeParUai = new Map(annuaire.map((a) => [a.identifiant_de_l_etablissement, a.code_commune]));
  console.log(`${colleges.length} collèges, ${gt.length} lycées GT, ${pro.length} lycées pro, ${communeParUai.size} UAI dans l'annuaire.`);

  const collegesParCommune = new Map();
  let sansCommune = 0;
  for (const c of colleges) {
    const code = communeParUai.get(c.uai);
    if (!code) {
      sansCommune += 1;
      continue;
    }
    (collegesParCommune.get(code) ?? collegesParCommune.set(code, []).get(code)).push(c);
  }
  if (sansCommune) console.warn(`${sansCommune} collèges sans commune dans l'annuaire, ignorés.`);
  const lyceesParCommune = new Map();
  for (const [voie, lignes] of [["GT", gt], ["PRO", pro]]) {
    for (const l of lignes) {
      const code = l.code_commune;
      if (!code) continue;
      (lyceesParCommune.get(code) ?? lyceesParCommune.set(code, []).get(code)).push({ ...l, voie });
    }
  }

  const regions = (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  let avecDnb = 0;
  let avecBac = 0;
  let total = 0;
  for (const region of regions) {
    const chemin = path.join(RAW, region, "ecoles.json");
    let fichier;
    try {
      fichier = JSON.parse(await readFile(chemin, "utf8"));
    } catch {
      continue;
    }
    for (const [code, commune] of Object.entries(fichier.communes)) {
      total += 1;
      for (const k of Object.keys(commune)) {
        if (/Dnb|Bac$|Bac_|^va|Bac/.test(k)) delete commune[k];
      }
      const cols = (collegesParCommune.get(code) ?? []).filter((c) => num(c.nb_candidats_g) > 0);
      if (cols.length) {
        commune.tauxReussiteDnb = ponderee(cols, (c) => num(c.nb_candidats_g), (c) => num(c.taux_de_reussite_g));
        commune.tauxReussiteDnb_maille =
          "commune (moyenne ponderee des colleges implantes sur la commune ; ce n'est PAS le secteur scolaire de residence)";
        commune.vaDnb = ponderee(cols, (c) => num(c.nb_candidats_g), (c) => num(c.va_du_taux_de_reussite_g));
        commune.nbCandidatsDnb = cols.reduce((n, c) => n + num(c.nb_candidats_g), 0);
        commune.nbCollegesEvaluesDnb = cols.length;
        if (commune.tauxReussiteDnb !== null) avecDnb += 1;
      }
      const lycees = (lyceesParCommune.get(code) ?? []).filter((l) => num(l.presents_total) > 0);
      if (lycees.length) {
        commune.tauxReussiteBac = ponderee(lycees, (l) => num(l.presents_total), (l) => num(l.taux_reu_total));
        commune.tauxReussiteBac_maille =
          "commune (moyenne ponderee des lycees implantes sur la commune ; le bassin de recrutement est bien plus large)";
        commune.vaBac = ponderee(lycees, (l) => num(l.presents_total), (l) => num(l.va_reu_total));
        commune.nbPresentsBac = lycees.reduce((n, l) => n + num(l.presents_total), 0);
        // Un lycée polyvalent figure dans les deux jeux (GT et pro) sous le même UAI : un seul établissement.
        commune.nbLyceesEvaluesBac = new Set(lycees.map((l) => l.uai)).size;
        const voies = [...new Set(lycees.map((l) => l.voie))].sort();
        commune.voiesBacEvaluees = voies.join("+");
        if (commune.tauxReussiteBac !== null) avecBac += 1;
      }
    }
    fichier.source = {
      ...fichier.source,
      nom: "Base permanente des équipements (BPE) 2025, fichier de dénombrement général des équipements par commune (DS_BPE_CSV_FR) ; Annuaire de l'éducation ; IVAC collèges session 2025 (réussite au DNB) et IVAL lycées GT + PRO session 2025 (réussite au baccalauréat)",
      producteur: "INSEE (BPE) et Ministère de l'Éducation nationale / DEPP (annuaire, IVAC, IVAL)",
      annee: "Dénombrement au 1er janvier 2025 ; résultats : session 2025",
      consulteLe: new Date().toISOString().slice(0, 10),
    };
    fichier.methodologie = fichier.methodologie.replace(
      /Résultats aux examens \(DEPP[^]*$/,
      `Résultats aux examens (DEPP, jeux ${JEUX.colleges.id}, ${JEUX.lyceesGt.id} et ${JEUX.lyceesPro.id}, session ${SESSION}) pour toutes les communes : ` +
        "DNB = moyenne des taux de réussite (série générale) des collèges implantés sur la commune, pondérée par le nombre de candidats, commune connue par l'annuaire de l'éducation (UAI) ; " +
        "bac = moyenne des lycées GT et professionnels implantés sur la commune, pondérée par les présents, toutes séries ; valeur ajoutée moyennée de même sur les établissements où elle est publiée. " +
        "Toute commune sans collège ou lycée évalué garde ces champs absents, jamais 0 ni une valeur départementale. Aucun indicateur officiel de résultats scolaires n'existe à la maille communale : ces valeurs sont une agrégation dérivée des établissements implantés, pas un indicateur de secteur scolaire.",
    );
    await writeFile(chemin, JSON.stringify(fichier, null, 1), "utf8");
  }
  console.log(`${total} communes : ${avecDnb} avec un taux DNB, ${avecBac} avec un taux bac.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
