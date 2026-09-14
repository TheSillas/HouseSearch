import { CRITERES } from "./criteres";
import { mesureVedetteStructurelle } from "./mesures";
import type { Commune, CritereId, Sens } from "./types";

/**
 * Filtres à valeur : en plus des curseurs de priorité (qui pondèrent le
 * classement), l'utilisateur peut fixer une plage — un budget maximal, un
 * temps de trajet maximal — qui exclut purement et simplement les communes
 * hors plage, quel que soit le poids réglé par ailleurs.
 *
 * Chaque filtre porte sur la mesure structurellement vedette du critère (le
 * même chiffre que celui affiché en tête de chaque carte), jamais sur la
 * moyenne pondérée qui sert au classement : un filtre doit rester lisible en
 * un coup d'œil comme « le prix est entre X et Y », pas comme une abstraction.
 */
export type Filtres = Partial<Record<CritereId, { min: number; max: number }>>;

export interface BorneFiltre {
  critere: CritereId;
  /** Identifiant de la mesure filtrée, pour aller chercher sa valeur par commune. */
  mesureId: string;
  mesureLibelle: string;
  unite: string;
  decimales: number;
  sens: Sens;
  min: number;
  max: number;
}

/**
 * Le libellé court d'une mesure (`libelleCourt`) est pensé pour une colonne de
 * classement, toujours lue à côté des trois autres critères — « Violences »
 * s'y comprend par position (à côté de « Prix », « Réussite brevet »...).
 * Isolé dans le panneau de filtres, sans ce voisinage, il ne dit plus ce qu'il
 * règle. On ne réécrit ici que les libellés qui restent ambigus une fois
 * seuls ; les autres gardent leur `libelleCourt`.
 */
const LIBELLE_FILTRE: Partial<Record<CritereId, string>> = {
  immobilier: "Prix immobilier",
  securite: "Violences hors du foyer",
  ecoles: "Écoles",
  sante: "Médecins",
  quotidien: "Commerces & services",
  fiscalite: "Taxe foncière",
  proximite: "Distance au repère",
  risques: "Catastrophes naturelles reconnues",
  climat: "Ensoleillement",
};

/**
 * Unité affichée sous une plage quand celle de la mesure, lue seule, ne dit pas
 * ce qu'on compte : « 11 – 26 sur 26 » devient « 11 – 26 sur 26 types ».
 */
const UNITE_FILTRE: Partial<Record<CritereId, (unite: string) => string>> = {
  quotidien: (unite) => `${unite} types`,
};

/**
 * Bornes réelles observées dans le jeu de données, par critère.
 *
 * Un critère est absent du résultat quand sa mesure vedette n'a pas assez de
 * valeurs distinctes pour qu'une plage ait un sens (toutes égales, ou presque
 * toutes manquantes) : mieux vaut ne pas proposer de filtre que d'en proposer
 * un qui ne filtre jamais rien.
 */
export function calculerBornes(communes: Commune[]): Partial<Record<CritereId, BorneFiltre>> {
  const bornes: Partial<Record<CritereId, BorneFiltre>> = {};

  for (const critere of CRITERES) {
    // Un critère sans curseur ne se filtre pas non plus : il se lit sur la fiche.
    if (critere.curseur === false) continue;
    let mesureRef: ReturnType<typeof mesureVedetteStructurelle>;
    const valeurs: number[] = [];

    for (const commune of communes) {
      const mesure = mesureVedetteStructurelle(commune.criteres[critere.id]?.mesures ?? []);
      if (mesure && !mesureRef) mesureRef = mesure;
      if (mesure?.valeur !== null && mesure?.valeur !== undefined) valeurs.push(mesure.valeur);
    }

    if (!mesureRef || valeurs.length < 2) continue;
    // Bornes arrondies au pas du curseur (vers l'extérieur) : un <input type="range">
    // dont `max` n'est pas un multiple du pas voit sa valeur corrigée par le
    // navigateur, ce qui créait un écart d'hydratation entre serveur et client.
    const decimales = mesureRef.decimales ?? 0;
    const facteur = 10 ** decimales;
    const min = Math.floor(Math.min(...valeurs) * facteur) / facteur;
    const max = Math.ceil(Math.max(...valeurs) * facteur) / facteur;
    if (min === max) continue;

    bornes[critere.id] = {
      critere: critere.id,
      mesureId: mesureRef.id,
      mesureLibelle: LIBELLE_FILTRE[critere.id] ?? mesureRef.libelleCourt ?? mesureRef.libelle,
      unite: UNITE_FILTRE[critere.id]?.(mesureRef.unite) ?? mesureRef.unite,
      decimales,
      sens: mesureRef.sens,
      min,
      max,
    };
  }

  return bornes;
}

/** Un filtre ne compte comme actif que s'il resserre réellement la borne réelle. */
export function filtresActifs(
  filtres: Filtres,
  bornes: Partial<Record<CritereId, BorneFiltre>>,
): CritereId[] {
  return CRITERES.map((c) => c.id).filter((id) => {
    const f = filtres[id];
    const b = bornes[id];
    if (!f || !b) return false;
    return f.min > b.min || f.max < b.max;
  });
}

export interface ResultatFiltrage {
  communes: Commune[];
  /** Communes retirées parce qu'elles n'ont pas de valeur sur un critère filtré actif. */
  sansDonnee: number;
  /** Communes retirées parce que leur valeur tombe hors de la plage choisie. */
  horsPlage: number;
}

/**
 * Applique les filtres actifs à la liste de communes.
 *
 * Une commune sans donnée sur un critère filtré est retirée (on ne peut pas
 * confirmer qu'elle respecte la contrainte), jamais retenue par défaut : c'est
 * la même prudence que pour le classement, appliquée à l'exclusion plutôt qu'à
 * la pondération.
 */
export function appliquerFiltres(
  communes: Commune[],
  filtres: Filtres,
  bornes: Partial<Record<CritereId, BorneFiltre>>,
): ResultatFiltrage {
  const actifs = filtresActifs(filtres, bornes);
  if (actifs.length === 0) return { communes, sansDonnee: 0, horsPlage: 0 };

  let sansDonnee = 0;
  let horsPlage = 0;

  const retenues = communes.filter((commune) => {
    for (const id of actifs) {
      const borne = bornes[id]!;
      const f = filtres[id]!;
      const mesure = commune.criteres[id]?.mesures.find((m) => m.id === borne.mesureId);
      if (!mesure || mesure.valeur === null) {
        sansDonnee += 1;
        return false;
      }
      if (mesure.valeur < f.min || mesure.valeur > f.max) {
        horsPlage += 1;
        return false;
      }
    }
    return true;
  });

  return { communes: retenues, sansDonnee, horsPlage };
}

// ------------------------------------------------------------------------ URL

/**
 * Les filtres voyagent dans un second paramètre d'URL, séparé des priorités :
 * un segment vide par critère non filtré, `min_max` sinon, dans l'ordre des
 * critères — symétrique à `poids.ts`.
 */
export const PARAM_FILTRES = "f";

export function encoderFiltres(filtres: Filtres): string {
  return CRITERES.map((c) => {
    const f = filtres[c.id];
    return f ? `${f.min}_${f.max}` : "";
  }).join(",");
}

export function decoderFiltres(brut: string | string[] | undefined | null): Filtres {
  if (typeof brut !== "string" || brut === "") return {};
  const parts = brut.split(",");
  if (parts.length !== CRITERES.length) return {};

  const filtres: Filtres = {};
  parts.forEach((part, i) => {
    if (!part) return;
    const [minS, maxS] = part.split("_");
    const min = Number(minS);
    const max = Number(maxS);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return;
    filtres[CRITERES[i].id] = { min, max };
  });
  return filtres;
}

export function estFiltresVides(filtres: Filtres): boolean {
  return Object.keys(filtres).length === 0;
}
