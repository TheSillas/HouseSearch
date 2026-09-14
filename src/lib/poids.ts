import { CRITERES, POIDS_MAX, POIDS_MIN, POIDS_PAR_DEFAUT } from "./criteres";
import type { Poids } from "./scoring";

/**
 * Les poids tiennent dans un seul paramètre d'URL, dans l'ordre des critères.
 *
 * Le décodage est partagé entre le serveur et le client : la page lit `?p=`
 * au rendu pour que le classement servi soit déjà le bon, et le composant
 * réécrit le paramètre quand un curseur bouge.
 */
export const PARAM_POIDS = "p";

export function encoderPoids(poids: Poids): string {
  return CRITERES.map((c) => poids[c.id] ?? 0).join("-");
}

export function decoderPoids(brut: string | string[] | undefined | null): Poids | null {
  if (typeof brut !== "string") return null;
  const parts = brut.split("-");
  // Un lien partagé avant l'ajout d'un critère porte moins de valeurs : les
  // critères qu'il ne connaissait pas prennent leur poids par défaut, plutôt
  // que d'invalider tout le réglage.
  if (parts.length < 1 || parts.length > CRITERES.length) return null;
  const poids = { ...POIDS_PAR_DEFAUT } as Poids;
  for (const [i, part] of parts.entries()) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < POIDS_MIN || n > POIDS_MAX) return null;
    poids[CRITERES[i].id] = n;
  }
  // Un critère sans curseur ne pèse jamais, même si un ancien lien lui donnait un poids.
  for (const c of CRITERES) if (c.curseur === false) poids[c.id] = 0;
  return poids;
}

export function estParDefaut(poids: Poids): boolean {
  return encoderPoids(poids) === encoderPoids(POIDS_PAR_DEFAUT);
}
