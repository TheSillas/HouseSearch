#!/usr/bin/env node
/**
 * Assemble la version publiée : un seul fichier HTML autonome, sans build ni
 * réseau, qui reproduit le comparateur pour le faire essayer ou circuler.
 *
 *   node scripts/build-artefact.mjs [fichierDeSortie]
 *
 * Le moteur embarqué est `scripts/artefact/moteur.mjs`, dont `src/lib/artefact.test.ts`
 * vérifie qu'il classe exactement comme l'application.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { dilater } from "./lib/jeu-compact.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTEFACT = path.join(RACINE, "scripts", "artefact");

const sortie = path.resolve(
  process.argv[2] ??
    path.join(
      "C:",
      "Users",
      "alexa",
      "AppData",
      "Local",
      "Temp",
      "claude",
      "C--Users-alexa-Desktop-Git-OuVivre",
      "3dee9704-2310-4ac2-b097-1498b2366d88",
      "scratchpad",
      "ou-vivre.html",
    ),
);

/**
 * Le jeu de données part dans un `<script>` : une chaîne contenant `</script>`
 * ou `<!--` refermerait la balise. On neutralise donc tout `<`.
 */
function inlinerJson(valeur) {
  return JSON.stringify(valeur).replace(/</g, "\\u003c");
}

// Une seule région existe pour l'instant ; l'artefact la reprend telle quelle.
// Si plusieurs régions coexistent un jour, ce script devra en choisir une
// (argument de ligne de commande) plutôt que de la figer ici.
const REGION_SLUG = "metropole-lyon";

async function main() {
  // Le jeu sur disque est au format compact (voir build-dataset.mjs) : dilaté ici.
  const compact = JSON.parse(
    await readFile(path.join(RACINE, "data", "dist", `${REGION_SLUG}.json`), "utf8"),
  );
  const jeu = { zone: compact.zone, genereLe: compact.genereLe, communes: dilater(compact) };

  // Le moteur est un module ES ; concaténé en script classique, ses `export`
  // n'ont plus lieu d'être et ses symboles deviennent des variables de portée
  // globale, sur lesquelles la vue s'appuie.
  const moteur = (await readFile(path.join(ARTEFACT, "moteur.mjs"), "utf8")).replace(
    /^export /gm,
    "",
  );
  const vue = await readFile(path.join(ARTEFACT, "vue.mjs"), "utf8");
  const modele = await readFile(path.join(ARTEFACT, "modele.html"), "utf8");

  const html = modele
    .replace("/*__DONNEES__*/", `const JEU = ${inlinerJson(jeu)};`)
    .replace("/*__MOTEUR__*/", moteur)
    .replace("/*__VUE__*/", vue);

  for (const marqueur of ["__DONNEES__", "__MOTEUR__", "__VUE__"]) {
    if (html.includes(marqueur)) throw new Error(`Marqueur ${marqueur} non remplacé`);
  }

  await mkdir(path.dirname(sortie), { recursive: true });
  await writeFile(sortie, html, "utf8");

  const octets = Buffer.byteLength(html, "utf8");
  console.log(`${path.relative(RACINE, sortie) || sortie}`);
  console.log(`  ${(octets / 1024 / 1024).toFixed(2)} Mo · ${jeu.communes.length} communes`);
  if (octets > 15 * 1024 * 1024) {
    console.error("  Au-delà de la limite de 16 Mo d'un artefact.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
