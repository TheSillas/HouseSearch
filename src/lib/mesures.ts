import type { Mesure } from "./types";

/**
 * Chiffre mis en avant pour un critère : sur une ligne de classement, sur une
 * carte, ou pour définir ce qu'un filtre à valeur règle.
 *
 * La mesure vedette prime, mais seulement si elle est renseignée : trois
 * communes n'ont aucun collège évalué au brevet, et afficher « Non disponible »
 * alors qu'un autre chiffre classant existe donnerait à tort l'impression que
 * le critère n'a pas été pris en compte pour elles. Une petite commune peut
 * aussi voir ses indicateurs classants masqués par le secret statistique tout
 * en ayant un indicateur secondaire renseigné (ex. Étrelles, Ille-et-Vilaine) :
 * mieux vaut ce chiffre-là que « Non disponible » alors qu'une donnée existe.
 */
export function mesureVedette(mesures: Mesure[]): Mesure | undefined {
  const renseignee = (m: Mesure) => m.valeur !== null;
  return (
    mesures.find((m) => m.vedette && renseignee(m)) ??
    mesures.find((m) => m.classante && renseignee(m)) ??
    mesures.find(renseignee) ??
    mesures.find((m) => m.vedette) ??
    mesures[0]
  );
}

/**
 * La mesure structurellement désignée comme vedette pour un critère, quelle
 * que soit sa valeur (y compris `null`).
 *
 * Diffère de `mesureVedette` : celle-ci peut retomber sur une autre mesure si
 * la vedette est absente pour *l'affichage*, ce qui ferait varier, d'une
 * commune à l'autre, la grandeur qu'un filtre à valeur est censé régler. Un
 * filtre doit toujours porter sur le même identifiant de mesure pour toutes
 * les communes.
 */
export function mesureVedetteStructurelle(mesures: Mesure[]): Mesure | undefined {
  return mesures.find((m) => m.vedette);
}

/**
 * La mesure dont on lit la *position* (barre, phrase comparative) à côté du
 * chiffre vedette. C'est la vedette elle-même quand elle est comparable ; sinon
 * — un décompte brut d'établissements, qui ne se compare pas entre un village
 * et une ville — la première mesure classante renseignée du critère, celle qui
 * a réellement servi au classement (ex. la densité pour 10 000 habitants).
 */
export function mesurePosition(mesures: Mesure[], vedette = mesureVedette(mesures)): Mesure | undefined {
  if (!vedette) return undefined;
  if (vedette.comparable !== false && vedette.valeur !== null) return vedette;
  return mesures.find((m) => m.classante && m.comparable !== false && m.valeur !== null) ?? vedette;
}
