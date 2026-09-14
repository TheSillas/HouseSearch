import { existsSync, readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

import { dilater, type JeuCompact } from "./jeu-compact";
import type { Noyau } from "./noyau";
import type { Commune } from "./types";

/**
 * Accès aux fichiers de données, côté serveur uniquement.
 *
 * Le jeu n'est plus importé statiquement : à l'échelle de la France entière
 * (34 746 communes), l'ensemble pèse plus de cent mégaoctets et n'a rien à
 * faire dans un bundle. Deux niveaux, tous deux produits par les scripts :
 *
 *  - `data/dist/noyau.json` — toutes les communes, seulement les mesures du
 *    classement, en colonnes (voir noyau.ts). Chargé une fois par processus.
 *  - `data/dist/<région>.json` — le jeu complet d'un département (toutes les
 *    mesures, précisions, sources, historiques, scrutins), lu à la demande
 *    quand une fiche s'ouvre, puis gardé en mémoire pour les suivantes.
 *
 * Ajouter une région : un dossier `data/raw/<slug>/`, `build-dataset.mjs <slug>`,
 * puis `build-noyau.mjs`. Rien à toucher ici.
 */
const DIST = path.join(process.cwd(), "data", "dist");

// Mémoire par fichier, invalidée si le fichier change sur disque : un jeu
// reconstruit pendant que le serveur de dev tourne est repris sans redémarrage
// (un `stat` par accès, négligeable). Le même objet est rendu tant que le
// fichier ne bouge pas — les mémorisations en aval (communes, référentiel)
// s'appuient sur cette identité.
const memoFichiers = new Map<string, { mtimeMs: number; valeur: unknown }>();

/**
 * Chemin réellement lu pour un fichier du jeu. Le dépôt ne transporte que les
 * `.gz` : les 97 départements pèsent 379 Mo en clair, 32 Mo compressés, et une
 * fonction Vercel plafonne à 250 Mo. Le `.json` en clair, s'il est là, l'emporte
 * — c'est la sortie fraîche de `build-dataset.mjs`, que le serveur de dev doit
 * reprendre sans attendre une recompression.
 */
function cheminDe(fichier: string): string {
  const clair = path.join(DIST, fichier);
  return existsSync(clair) ? clair : `${clair}.gz`;
}

function lireMemo<T>(fichier: string, convertir: (texte: string) => T): T {
  const chemin = cheminDe(fichier);
  const { mtimeMs } = statSync(chemin);
  const memo = memoFichiers.get(fichier);
  if (memo && memo.mtimeMs === mtimeMs) return memo.valeur as T;
  const octets = readFileSync(chemin);
  const texte = (chemin.endsWith(".gz") ? gunzipSync(octets) : octets).toString("utf8");
  const valeur = convertir(texte);
  memoFichiers.set(fichier, { mtimeMs, valeur });
  return valeur;
}

/** Chemin du noyau pré-compressé, servi tel quel par la route `/donnees/noyau`. */
export function cheminNoyauGz(): string {
  return path.join(DIST, "noyau.json.gz");
}

export function chargerNoyau(): Noyau {
  return lireMemo("noyau.json", (texte) => JSON.parse(texte) as Noyau);
}

/** Slug de région → communes dilatées. Une région chargée reste en mémoire. */
export function chargerRegion(slug: string): Commune[] {
  return lireMemo(`${slug}.json`, (texte) => dilater(JSON.parse(texte) as JeuCompact));
}

/** Code département → slug de région, d'après le noyau. */
export function regionDuDepartement(departement: string): string | undefined {
  return chargerNoyau().zones.find((z) => z.departement === departement)?.slug;
}

/** Toutes les communes de toutes les régions, complètes. Coûteux : réservé aux scripts et tests. */
export function chargerToutesLesCommunes(): Commune[] {
  return chargerNoyau().zones.flatMap((z) => chargerRegion(z.slug));
}
