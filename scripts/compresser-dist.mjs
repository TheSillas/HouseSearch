/**
 * data/dist/<région>.json  ->  data/dist/<région>.json.gz
 *
 * Seuls les `.gz` voyagent : le dépôt et le paquet de la fonction Vercel ne
 * peuvent pas porter les 379 Mo du jeu en clair (plafond de 250 Mo par
 * fonction), quand les mêmes données tiennent en 32 Mo compressées. `regions.ts`
 * lit le `.json` en clair s'il est présent — la sortie fraîche de
 * `build-dataset.mjs`, en développement — et retombe sur le `.gz` sinon.
 *
 * Idempotent : un `.gz` plus récent que sa source est laissé tel quel.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { readdir, stat, rename } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(RACINE, "data", "dist");

async function mtime(chemin) {
  try {
    return (await stat(chemin)).mtimeMs;
  } catch {
    return null;
  }
}

const fichiers = (await readdir(DIST)).filter((f) => f.endsWith(".json")).sort();
let compresses = 0;
let octetsClair = 0;
let octetsGz = 0;

for (const fichier of fichiers) {
  const source = path.join(DIST, fichier);
  const cible = `${source}.gz`;
  const [tSource, tCible] = await Promise.all([mtime(source), mtime(cible)]);
  if (tCible !== null && tCible >= tSource) {
    octetsClair += (await stat(source)).size;
    octetsGz += (await stat(cible)).size;
    continue;
  }
  // Écriture via un temporaire : une interruption ne laisse pas derrière elle
  // un .gz tronqué que la lecture prendrait pour valide.
  const temporaire = `${cible}.partiel`;
  await pipeline(createReadStream(source), createGzip({ level: 9 }), createWriteStream(temporaire));
  await rename(temporaire, cible);
  compresses += 1;
  octetsClair += (await stat(source)).size;
  octetsGz += (await stat(cible)).size;
  console.log(`  ${fichier} → ${(((await stat(cible)).size / 1024 / 1024) * 1).toFixed(1)} Mo`);
}

const mo = (o) => (o / 1024 / 1024).toFixed(0);
console.log(
  `${fichiers.length} fichiers (${compresses} recompressés) : ${mo(octetsClair)} Mo → ${mo(octetsGz)} Mo`,
);
