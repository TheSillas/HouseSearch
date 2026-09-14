#!/usr/bin/env node
/**
 * Transports — gare de voyageurs la plus proche de chaque commune.
 *
 *   node scripts/importer-gares.mjs [--dossier <cache>]
 *
 * Source : « Gares de voyageurs » du réseau ferré national (SNCF Réseau, via
 * data.gouv.fr), un fichier national de ~2 800 gares avec leur position et
 * leur commune. Pour chaque commune du référentiel, on retient la gare de
 * distance minimale à vol d'oiseau (haversine, rayon 6 371 km) depuis le point
 * central de la commune, sans se limiter au département : la gare la plus
 * proche d'une commune frontalière est souvent dans le département voisin.
 *
 * Écrit `data/raw/<région>/transports-gare-proche.json` au schéma déjà consommé
 * par build-dataset.mjs : { nom, gare, distanceM, dansLaCommune, communeGare }.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const args = process.argv.slice(2);
const CACHE = args.includes("--dossier")
  ? path.resolve(args[args.indexOf("--dossier") + 1])
  : path.join(RACINE, ".cache-insee");

const GARES = {
  url: "https://www.data.gouv.fr/api/1/datasets/r/cbacca02-6925-4a46-aab6-7194debbb9b7",
  page: "https://www.data.gouv.fr/datasets/gares-de-voyageurs/",
  fichier: "gares-de-voyageurs.csv",
};

const nettoyer = (s) => s.replace(/^﻿/, "").replace(/^"|"$/g, "").trim();

async function chargerGares() {
  await mkdir(CACHE, { recursive: true });
  const chemin = path.join(CACHE, GARES.fichier);
  if (!existsSync(chemin)) {
    const reponse = await fetch(GARES.url, { headers: { "user-agent": "ou-vivre/1.0" } });
    if (!reponse.ok) throw new Error(`${GARES.url} → HTTP ${reponse.status}`);
    await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
  }
  const lignes = (await readFile(chemin, "utf8")).split(/\r?\n/).filter(Boolean);
  const entete = lignes[0].split(";").map(nettoyer);
  const iNom = entete.indexOf("Nom_Gare");
  const iPos = entete.indexOf("Position géographique");
  const iCommune = entete.indexOf("Code commune");
  if (iNom < 0 || iPos < 0 || iCommune < 0) throw new Error(`Colonnes inattendues : ${entete.join(" | ")}`);
  const gares = [];
  for (const ligne of lignes.slice(1)) {
    const v = ligne.split(";").map(nettoyer);
    const [lat, lon] = v[iPos].split(",").map((x) => Number(x.trim()));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    gares.push({ nom: v[iNom], lat, lon, codeCommune: v[iCommune].padStart(5, "0") });
  }
  return gares;
}

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function main() {
  const gares = await chargerGares();
  console.log(`${gares.length} gares de voyageurs.`);

  const regions = [];
  const nomParCode = new Map();
  for (const d of (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    try {
      const referentiel = JSON.parse(await readFile(path.join(RAW, d.name, "referentiel.json"), "utf8"));
      regions.push({ dossier: path.join(RAW, d.name), communes: referentiel.communes ?? [] });
      for (const c of referentiel.communes ?? []) nomParCode.set(c.codeInsee, c.nom);
    } catch {
      /* dossier sans référentiel */
    }
  }

  const consulteLe = new Date().toISOString().slice(0, 10);
  let total = 0;
  let sansPoint = 0;
  for (const region of regions) {
    const communes = {};
    for (const c of region.communes) {
      if (typeof c.lat !== "number" || typeof c.lon !== "number") {
        sansPoint += 1;
        continue;
      }
      let meilleure = null;
      let dMin = Infinity;
      for (const g of gares) {
        const d = haversine(c.lat, c.lon, g.lat, g.lon);
        if (d < dMin) {
          dMin = d;
          meilleure = g;
        }
      }
      if (!meilleure) continue;
      communes[c.codeInsee] = {
        nom: c.nom,
        gare: meilleure.nom,
        distanceM: Math.round(dMin),
        dansLaCommune: meilleure.codeCommune === c.codeInsee,
        communeGare: nomParCode.get(meilleure.codeCommune) ?? meilleure.codeCommune,
      };
      total += 1;
    }
    await writeFile(
      path.join(region.dossier, "transports-gare-proche.json"),
      JSON.stringify(
        {
          source: {
            nom: "Gares de voyageurs du réseau ferré national",
            producteur: "SNCF Gares & Connexions",
            url: GARES.url,
            page: GARES.page,
            // Flux vivant sans millésime annuel : la date de téléchargement fait foi.
            annee: consulteLe.slice(0, 4),
            licence: "ODbL",
            consulteLe,
          },
          methodologie:
            `Distance à vol d'oiseau (haversine, rayon 6 371 km) entre le point central de la commune ` +
            `(geo.api.gouv.fr) et chacune des ${gares.length} gares du fichier national ; la gare de ` +
            `distance minimale est retenue, sans restriction au département. Toutes les gares de ` +
            `voyageurs comptent, quelle que soit leur desserte.`,
          caveats: [
            "Distance à vol d'oiseau, pas un temps de trajet ni une distance routière.",
            "Le fichier ne dit rien de la fréquence des trains : une halte à deux arrêts par jour compte comme une grande gare.",
          ],
          communes,
        },
        null,
        1,
      ),
      "utf8",
    );
  }
  console.log(`${total} communes renseignées${sansPoint ? `, ${sansPoint} sans coordonnées` : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
