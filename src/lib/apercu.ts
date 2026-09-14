import { appliquerCouverture } from "./couverture";
import { appliquerFiltres, calculerBornes, type BorneFiltre, type Filtres } from "./filtres";
import {
  appliquerFiltreDepartements,
  departementsDisponibles,
  type DepartementDisponible,
  type FiltreDepartements,
} from "./localisation";
import { communesDepuisNoyau, type Noyau } from "./noyau";
import { appliquerRepere, encoderRepere, poidsEffectifs, type Repere } from "./repere";
import { classer, construireReferentiel, type LigneClassement, type Poids, type Referentiel } from "./scoring";
import type { CritereId } from "./types";

/** Lignes de classement rendues d'un coup ; « Afficher plus » en ajoute autant. */
export const PAGE_CLASSEMENT = 30;

/**
 * Ce que la page d'accueil embarque pour s'afficher tout de suite, avant que
 * le noyau national (34 746 communes) n'arrive à côté : le classement demandé
 * par l'URL, déjà calculé côté serveur avec exactement les mêmes fonctions que
 * le navigateur, les positions des seules communes affichées, les bornes des
 * filtres et la liste des départements. Le premier rendu est donc juste et
 * complet — un lien partagé montre le bon classement sans script — et le
 * navigateur, une fois le noyau chargé, reprend le calcul sans rien changer
 * à l'écran.
 */
export interface Apercu {
  /** Empreinte du noyau que le navigateur doit charger pour prendre le relais. */
  empreinte: string;
  nbCommunes: number;
  lignes: LigneClassement[];
  /** Taille du classement complet (au-delà des lignes embarquées). */
  nbClassees: number;
  exclues: { horsLocalisation: number; sousCouverture: number; sansDonnee: number; horsPlage: number };
  /** Positions des seules communes embarquées : ce qu'il faut pour dessiner leurs barres. */
  referentiel: Referentiel;
  bornes: Partial<Record<CritereId, BorneFiltre>>;
  departements: DepartementDisponible[];
}

export interface Reglages {
  poids: Poids;
  filtres: Filtres;
  departements: FiltreDepartements;
  couverture: number;
  repere?: Repere | null;
}

/**
 * Référentiels mémorisés par noyau et par repère : un repère change la mesure
 * Proximité de toutes les communes, donc le référentiel. Les derniers repères
 * demandés sont gardés, les plus anciens oubliés.
 */
const MEMO_MAX = 8;
const memoReferentiels = new Map<string, { noyau: Noyau; referentiel: Referentiel; bornes: Partial<Record<CritereId, BorneFiltre>> }>();
let memoDepartements: { noyau: Noyau; departements: DepartementDisponible[] } | null = null;

export function construireApercu(noyau: Noyau, reglages: Reglages): Apercu {
  const repere = reglages.repere ?? null;
  const communes = repere ? appliquerRepere(communesDepuisNoyau(noyau), repere) : communesDepuisNoyau(noyau);
  const cle = `${noyau.empreinte}|${repere ? encoderRepere(repere) : ""}`;
  let memo = memoReferentiels.get(cle);
  if (!memo || memo.noyau !== noyau) {
    memo = { noyau, referentiel: construireReferentiel(communes), bornes: calculerBornes(communes) };
    memoReferentiels.set(cle, memo);
    if (memoReferentiels.size > MEMO_MAX) memoReferentiels.delete(memoReferentiels.keys().next().value!);
  }
  if (memoDepartements?.noyau !== noyau) {
    memoDepartements = { noyau, departements: departementsDisponibles(communes) };
  }
  const referentiel = memo.referentiel;
  const poids = poidsEffectifs(reglages.poids, repere);

  // Même enchaînement que Comparateur.tsx : localisation, couverture, plages.
  const localisees = appliquerFiltreDepartements(communes, reglages.departements);
  const couvertes = appliquerCouverture(localisees, referentiel, poids, reglages.couverture);
  const filtrees = appliquerFiltres(couvertes.communes, reglages.filtres, memo.bornes);
  const classement = classer(filtrees.communes, referentiel, poids);
  const lignes = classement.slice(0, PAGE_CLASSEMENT);

  const restreint: Referentiel = { positions: {}, positionsCriteres: {} };
  for (const ligne of lignes) {
    const code = ligne.commune.codeInsee;
    restreint.positions[code] = referentiel.positions[code];
    restreint.positionsCriteres[code] = referentiel.positionsCriteres[code];
  }

  return {
    empreinte: noyau.empreinte,
    nbCommunes: communes.length,
    lignes,
    nbClassees: classement.length,
    exclues: {
      horsLocalisation: communes.length - localisees.length,
      sousCouverture: couvertes.ecartees,
      sansDonnee: filtrees.sansDonnee,
      horsPlage: filtrees.horsPlage,
    },
    referentiel: restreint,
    bornes: memo.bornes,
    departements: memoDepartements.departements,
  };
}
