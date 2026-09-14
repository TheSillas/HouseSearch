#!/usr/bin/env node
/**
 * Référentiel des communes — toutes les communes de chaque département
 * métropolitain, sans seuil de population.
 *
 *   node scripts/importer-referentiel.mjs [--departement 01]
 *
 * Pour chaque dossier `data/raw/<région>/` existant, lit le code département
 * dans le `referentiel.json` présent, interroge geo.api.gouv.fr (découpage
 * administratif et populations légales de l'INSEE) et réécrit le référentiel
 * avec l'ensemble des communes du département. Aucun champ n'est inventé : une
 * commune sans population publiée est écartée et signalée.
 *
 * Le schéma de chaque commune est celui déjà consommé par build-dataset.mjs :
 * nom, codeInsee, population, anneePopulation, departement, epci « Nom (SIREN) »,
 * codesPostaux, lat/lon (centre de la commune), surfaceKm2.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const CHAMPS = "nom,code,codesPostaux,population,centre,mairie,surface,epci,departement,region";
// Millésime des populations légales servies par geo.api.gouv.fr au moment de
// l'import : vérifié sur Ambérieu-en-Bugey (15 934 hab.), identique au
// référentiel précédent.
const ANNEE_POPULATION = 2023;

const args = process.argv.slice(2);
const seulement = args.includes("--departement") ? args[args.indexOf("--departement") + 1] : null;

async function lireJson(chemin) {
  return JSON.parse(await readFile(chemin, "utf8"));
}

async function communesDuDepartement(code) {
  const url = `https://geo.api.gouv.fr/departements/${code}/communes?fields=${CHAMPS}`;
  const reponse = await fetch(url, { headers: { "user-agent": "ou-vivre/1.0 (import référentiel)" } });
  if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
  return { url, communes: await reponse.json() };
}

function convertir(c) {
  const point = c.centre?.coordinates ?? c.mairie?.coordinates;
  const commune = {
    nom: c.nom,
    codeInsee: c.code,
    population: c.population,
    anneePopulation: ANNEE_POPULATION,
    departement: c.departement.code,
  };
  if (c.epci) commune.epci = `${c.epci.nom} (${c.epci.code})`;
  if (c.codesPostaux?.length) commune.codesPostaux = c.codesPostaux;
  if (point) {
    commune.lat = Math.round(point[1] * 1e4) / 1e4;
    commune.lon = Math.round(point[0] * 1e4) / 1e4;
  }
  if (typeof c.surface === "number") commune.surfaceKm2 = Math.round(c.surface) / 100;
  return commune;
}

async function main() {
  const dossiers = (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory());
  const consulteLe = new Date().toISOString().slice(0, 10);
  let total = 0;
  const ecartees = [];

  for (const dossier of dossiers) {
    const chemin = path.join(RAW, dossier.name, "referentiel.json");
    let ancien;
    try {
      ancien = await lireJson(chemin);
    } catch {
      continue;
    }
    const code = ancien.communes?.[0]?.departement;
    if (!code) {
      console.warn(`${dossier.name} : code département introuvable, ignoré.`);
      continue;
    }
    if (seulement && code !== seulement) continue;

    const { url, communes } = await communesDuDepartement(code);
    const gardees = [];
    for (const c of communes) {
      if (typeof c.population !== "number") {
        ecartees.push(`${c.code} ${c.nom} (population non publiée)`);
        continue;
      }
      gardees.push(convertir(c));
    }
    gardees.sort((a, b) => a.codeInsee.localeCompare(b.codeInsee));

    const nomDepartement = communes[0]?.departement?.nom ?? ancien.zone.replace(/\s*\(.*\)\s*$/, "");
    const jeu = {
      zone: nomDepartement,
      source: {
        ...ancien.source,
        nom: "Découpage administratif communal et populations légales",
        producteur: "INSEE via geo.api.gouv.fr",
        url: "https://geo.api.gouv.fr/",
        annee: String(ANNEE_POPULATION),
        consulteLe,
      },
      methode:
        `REFERENTIEL : toutes les communes du département ${code} (${nomDepartement}), ` +
        `sans seuil de population — ${gardees.length} communes. URL appelée : ${url}. ` +
        `Population municipale (populations légales ${ANNEE_POPULATION}) ; coordonnées = centre ` +
        `de la commune ; surface convertie des hectares en km². Une commune sans population ` +
        `publiée est écartée, jamais complétée.`,
      communes: gardees,
    };
    await writeFile(chemin, `${JSON.stringify(jeu, null, 2)}\n`, "utf8");
    total += gardees.length;
    console.log(`${dossier.name.padEnd(26)} ${code}  ${String(gardees.length).padStart(4)} communes (avant : ${ancien.communes.length})`);
  }

  console.log(`\n${total} communes au total.`);
  if (ecartees.length) console.log(`Écartées (${ecartees.length}) : ${ecartees.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
