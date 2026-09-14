import type { Mesure } from "./types";
import type { Position } from "./scoring";

/**
 * Espace fine insécable (U+202F) : séparateur de milliers et liant nombre/unité
 * en français.
 *
 * Construite depuis son point de code plutôt qu'écrite en clair : le caractère
 * ne survit pas à toutes les chaînes d'édition, et une espace ordinaire laisse
 * « 3 200 €/m² » se couper en fin de ligne.
 */
const NBSP = String.fromCharCode(0x202f);

export function nombre(valeur: number, decimales = 0): string {
  return (
    valeur
      .toLocaleString("fr-FR", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
      })
      // « \s » couvre déjà l'espace ordinaire, l'insécable et la fine insécable,
      // dont Intl se sert selon les versions.
      .replace(/\s/g, NBSP)
  );
}

/** Chiffre brut avec son unité, tel qu'il doit apparaître à l'écran. */
export function valeurMesure(mesure: Mesure): string {
  if (mesure.valeur === null) {
    if (mesure.statut === "secret_statistique" || mesure.statut === "seuil_diffusion") return "Non publié";
    if (mesure.statut === "sans_objet") return "Sans objet";
    if (mesure.statut === "echantillon_insuffisant") return "Échantillon trop faible";
    return "Non disponible";
  }
  const brut = nombre(mesure.valeur, mesure.decimales ?? 0);
  const n = mesure.signe && mesure.valeur > 0 ? `+${brut}` : brut;
  if (!mesure.unite) return n;
  return n + NBSP + mesure.unite;
}

/** Au-delà de ce seuil, taire les ex-æquo rendrait la phrase trompeuse. */
const SEUIL_EX_AEQUO = 0.1;

/**
 * Phrase de comparaison, cœur du parti pris produit : jamais « 8/10 », toujours
 * « moins cher que 72 % des autres villes comparées ».
 *
 * Elle repose sur des **décomptes réels de communes**, pas sur le rang milieu
 * qui sert au tri. Sans cela, une commune sans gare — à égalité avec la moitié
 * du jeu — s'annoncerait « moins bien desservie que 74 % des autres villes »,
 * un chiffre que rien dans les données ne soutient.
 *
 * « des autres villes » et non « des villes » : une commune ne se compare pas à
 * elle-même, sans quoi 100 % serait faux pour celle qui arrive en tête.
 */
export function phraseComparative(mesure: Mesure, position: Position | null): string | null {
  if (!position || mesure.valeur === null || mesure.comparable === false) return null;

  const { devancees, devancantes, exAequo, autres } = position;
  if (autres < 1) return null;
  const part = (n: number) => Math.round((n / autres) * 100);

  if (devancees === 0 && devancantes === 0) {
    return `même valeur que les ${autres} autres villes comparées`;
  }

  const devance = devancees >= devancantes;
  const pourcentage = part(devance ? devancees : devancantes);
  if (pourcentage === 0) return null;

  const verbe = devance ? mesure.comparatif.mieux : mesure.comparatif.pire;
  const phrase = `${verbe} ${pourcentage}${NBSP}% des autres villes comparées`;

  return exAequo / autres >= SEUIL_EX_AEQUO
    ? `${phrase}, à égalité avec ${part(exAequo)}${NBSP}%`
    : phrase;
}

export function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function slugifier(nom: string): string {
  return (
    nom
      .normalize("NFD")
      // Marques combinatoires laissées par la décomposition : « è » devient
      // « e » suivi d'un accent, qu'on retire.
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[’']/gu, "-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}
