#!/usr/bin/env node
/**
 * MapLibre GL charge son traitement des données (GeoJSON, tuiles) dans un
 * worker séparé, résolu via `import.meta.url` depuis l'intérieur du paquet.
 * Turbopack ne réécrit pas cette URL correctement (elle arrive vide côté
 * navigateur, et le worker ne démarre jamais — aucune erreur, juste une
 * source qui ne se charge jamais). Le contournement documenté est de servir
 * ce fichier soi-même et de pointer `setWorkerUrl()` dessus (voir
 * CarteFrance.tsx) : ce script copie le fichier fourni par le paquet dans
 * `public/`, pour qu'il reste synchronisé à chaque installation/build plutôt
 * que d'être copié à la main une fois puis oublié.
 *
 * Le worker importe lui-même `./maplibre-gl-shared.mjs` (import relatif) :
 * les deux fichiers doivent vivre côte à côte à la racine servie, sans quoi
 * le worker échoue à se charger — silencieusement, sans erreur côté page.
 */
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(RACINE, "node_modules", "maplibre-gl", "dist");
const PUBLIC = path.join(RACINE, "public");

for (const fichier of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(DIST, fichier), path.join(PUBLIC, fichier));
  console.log(`Copié : public/${fichier}`);
}
