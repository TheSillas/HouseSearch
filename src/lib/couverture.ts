import { CRITERES } from "./criteres";
import type { Poids, Referentiel } from "./scoring";
import type { Commune } from "./types";

/**
 * Couverture : une commune n'est classée que si elle est renseignée sur les
 * critères que l'utilisateur a activés (curseur au-dessus de zéro).
 *
 * À l'échelle de la France entière, des milliers de petites communes n'ont de
 * données que sur une partie des critères : les prix ou la délinquance ne sont
 * pas publiés partout. Le classement retire déjà un critère absent du calcul ;
 * sans garde-fou, un village classé sur quatre critères devancerait une ville
 * complète sur six, sans que rien ne le dise. La règle est donc simple et
 * visible : tout critère qui compte pour vous doit être renseigné — avec une
 * tolérance réglable (nombre de critères manquants acceptés). Les communes
 * écartées restent sur la carte et consultables : elles ne sont pas classées,
 * elles ne sont pas cachées. Un critère à zéro n'est jamais exigé.
 */
export const TOLERANCE_PAR_DEFAUT = 0;
export const TOLERANCE_MAX = CRITERES.length - 1;

/** Critères activés (poids > 0) sur lesquels la commune n'a aucune position. */
export function criteresManquants(referentiel: Referentiel, poids: Poids, codeInsee: string): number {
  const positions = referentiel.positionsCriteres[codeInsee];
  let n = 0;
  for (const critere of CRITERES) {
    if ((poids[critere.id] ?? 0) <= 0) continue;
    if (!positions?.[critere.id]) n += 1;
  }
  return n;
}

export interface ResultatCouverture {
  communes: Commune[];
  /** Communes écartées parce qu'il leur manque plus de critères activés que la tolérance. */
  ecartees: number;
}

export function appliquerCouverture(
  communes: Commune[],
  referentiel: Referentiel,
  poids: Poids,
  tolerance: number,
): ResultatCouverture {
  const retenues = communes.filter((c) => criteresManquants(referentiel, poids, c.codeInsee) <= tolerance);
  return { communes: retenues, ecartees: communes.length - retenues.length };
}

// ------------------------------------------------------------------------ URL

export const PARAM_COUVERTURE = "c";

export function encoderCouverture(tolerance: number): string {
  return String(tolerance);
}

/** Absent ou invalide : la valeur par défaut. */
export function decoderCouverture(brut: string | string[] | undefined | null): number {
  const texte = Array.isArray(brut) ? brut[0] : brut;
  if (!texte) return TOLERANCE_PAR_DEFAUT;
  const n = Number.parseInt(texte, 10);
  if (!Number.isInteger(n) || n < 0 || n > TOLERANCE_MAX) return TOLERANCE_PAR_DEFAUT;
  return n;
}
