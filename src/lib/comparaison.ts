import type { Sens } from "./types";

/**
 * Comparaison côte à côte : de deux à six communes, désignées par leur slug
 * dans l'URL (`/comparer?communes=biarritz,anglet`), pour que la comparaison
 * se partage comme le classement. Aucun état ailleurs que dans l'adresse.
 */
export const PARAM_COMPARAISON = "communes";
export const MIN_COMPARAISON = 2;
export const MAX_COMPARAISON = 6;

const SLUG = /^[a-z0-9-]{1,80}$/;

/** Slugs valides, dédoublonnés, dans l'ordre, au plus `MAX_COMPARAISON`. */
export function decoderSlugs(brut: string | string[] | undefined | null): string[] {
  if (typeof brut !== "string") return [];
  const vus = new Set<string>();
  for (const part of brut.split(",")) {
    const slug = part.trim();
    if (SLUG.test(slug)) vus.add(slug);
    if (vus.size >= MAX_COMPARAISON) break;
  }
  return [...vus];
}

export function lienComparaison(slugs: string[]): string {
  const retenus = [...new Set(slugs)].slice(0, MAX_COMPARAISON);
  return retenus.length ? `/comparer?${PARAM_COMPARAISON}=${retenus.join(",")}` : "/comparer";
}

/**
 * Parmi des valeurs comparées, lesquelles sont les plus favorables selon le
 * sens de la mesure (plus bas = mieux pour un prix, plus haut = mieux pour un
 * taux de réussite). Les ex-æquo sont tous retenus ; une valeur absente ne
 * l'est jamais. Rien n'est marqué quand une seule commune est renseignée :
 * être « la meilleure » face à personne ne veut rien dire.
 */
export function plusFavorables(valeurs: (number | null)[], sens: Sens): boolean[] {
  const presentes = valeurs.filter((v): v is number => v !== null);
  if (presentes.length < 2) return valeurs.map(() => false);
  const cible = sens === "bas" ? Math.min(...presentes) : Math.max(...presentes);
  return valeurs.map((v) => v !== null && v === cible);
}
