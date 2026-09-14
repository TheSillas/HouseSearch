"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  alignerComparaison,
  basculer,
  basculerComparaison,
  CLE_SELECTION,
  lireSelection,
  retirer,
  type CommuneReperable,
  type Selection,
} from "./selection";

/**
 * Le magasin de « Ma sélection » : une valeur partagée par tous les composants
 * qui l'affichent (étoiles, bandeau), gardée dans le navigateur et relue d'un
 * onglet à l'autre. Côté serveur et pendant l'hydratation, la sélection est
 * vide : le premier rendu ne dépend jamais du stockage, il n'y a donc aucun
 * écart entre la page servie et la page hydratée.
 */
const VIDE: Selection = [];
let etat: Selection | null = null;
const auditeurs = new Set<() => void>();

function charger(): Selection {
  if (etat === null) {
    try {
      etat = lireSelection(window.localStorage.getItem(CLE_SELECTION));
    } catch {
      etat = VIDE;
    }
  }
  return etat;
}

function emettre() {
  for (const a of auditeurs) a();
}

function definir(suivante: Selection) {
  etat = suivante;
  try {
    window.localStorage.setItem(CLE_SELECTION, JSON.stringify(suivante));
  } catch {
    /* stockage indisponible : la sélection vit le temps de la page */
  }
  emettre();
}

function souscrire(cb: () => void) {
  auditeurs.add(cb);
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE_SELECTION) {
      etat = null;
      emettre();
    }
  };
  window.addEventListener("storage", surStockage);
  return () => {
    auditeurs.delete(cb);
    window.removeEventListener("storage", surStockage);
  };
}

export function useSelection() {
  const selection = useSyncExternalStore(souscrire, charger, () => VIDE);
  const etoiler = useCallback((commune: CommuneReperable) => definir(basculer(charger(), commune)), []);
  const cocher = useCallback((codeInsee: string) => definir(basculerComparaison(charger(), codeInsee)), []);
  const enlever = useCallback((codeInsee: string) => definir(retirer(charger(), codeInsee)), []);
  const aligner = useCallback((communes: CommuneReperable[]) => definir(alignerComparaison(charger(), communes)), []);
  return { selection, etoiler, cocher, enlever, aligner };
}
