import { nomDepartement } from "./departements";
import type { Commune } from "./types";

/**
 * Filtre de localisation : un ensemble de départements choisis (vide =
 * aucune restriction, tout le monde est comparé). Contrairement aux filtres
 * de valeur (`filtres.ts`), il ne porte pas sur une mesure mais sur
 * `commune.departement` — présent sur chaque commune, sans mesure à chercher.
 *
 * Comme les filtres de valeur, il ne change jamais le référentiel de
 * positions (« devance X % des villes comparées ») : il ne fait que retirer
 * des communes de l'affichage, jamais du calcul de comparaison.
 */
export type FiltreDepartements = string[];

export interface DepartementDisponible {
  code: string;
  nom: string;
  nbCommunes: number;
}

/** Départements présents dans le jeu de communes, triés par nom. */
export function departementsDisponibles(communes: Commune[]): DepartementDisponible[] {
  const compte = new Map<string, number>();
  for (const c of communes) compte.set(c.departement, (compte.get(c.departement) ?? 0) + 1);
  return [...compte.entries()]
    .map(([code, nbCommunes]) => ({ code, nom: nomDepartement(code), nbCommunes }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export function appliquerFiltreDepartements(
  communes: Commune[],
  departements: FiltreDepartements,
): Commune[] {
  if (departements.length === 0) return communes;
  const retenus = new Set(departements);
  return communes.filter((c) => retenus.has(c.departement));
}

// ------------------------------------------------------------------------ URL

/** Voyage dans l'URL séparément des poids et des filtres de valeur. */
export const PARAM_DEPARTEMENTS = "dep";

export function encoderDepartements(departements: FiltreDepartements): string {
  return departements.join(",");
}

export function decoderDepartements(brut: string | string[] | undefined | null): FiltreDepartements {
  if (typeof brut !== "string" || brut === "") return [];
  return brut.split(",").filter(Boolean);
}
