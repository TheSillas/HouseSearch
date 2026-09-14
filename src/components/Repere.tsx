"use client";

import { RechercheCommune } from "./RechercheCommune";
import type { Repere as ReperePoint } from "@/lib/repere";
import type { Commune } from "@/lib/types";

/**
 * Le repère personnel, dans la case libre de la grille des curseurs, à côté
 * de « Proximité » : une commune cherchée par son nom, ou un point posé sur la
 * carte. Tant qu'aucun repère n'est choisi, le curseur voisin est inerte et
 * l'intitulé le dit.
 */
export function Repere({
  repere,
  communes,
  placement,
  onChoisirCommune,
  onDemanderPlacement,
  onRetirer,
}: {
  repere: ReperePoint | null;
  communes: Commune[];
  /** Mode « cliquer sur la carte pour poser le repère » armé. */
  placement: boolean;
  onChoisirCommune: (codeInsee: string) => void;
  onDemanderPlacement: () => void;
  onRetirer: () => void;
}) {
  return (
    <div aria-labelledby="titre-repere" role="group">
      <div className="flex items-baseline justify-between gap-3">
        <span id="titre-repere" className={`text-[14px] font-medium ${repere ? "text-texte" : "text-texte-faible"}`}>
          Repère
        </span>
        {repere ? (
          <button
            type="button"
            onClick={onRetirer}
            className="-my-1 -mr-1 rounded px-1 py-1 text-[12.5px] text-texte-faible transition-colors hover:text-accent"
          >
            Retirer
          </button>
        ) : (
          <span className="text-[12.5px] text-texte-faible">Aucun</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <RechercheCommune
            communes={communes}
            onChoisir={onChoisirCommune}
            placeholder={repere ? repere.nom : "Commune…"}
            compact
          />
        </div>
        <button
          type="button"
          onClick={onDemanderPlacement}
          aria-pressed={placement}
          aria-label={placement ? "Cliquez sur la carte pour poser le repère" : "Placer le repère sur la carte"}
          title={placement ? "Cliquez sur la carte pour poser le repère" : "Placer le repère sur la carte"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
            placement
              ? "border-accent bg-accent-doux text-accent-fort"
              : "border-trait text-texte-doux hover:border-trait-fort hover:text-texte"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
            <path
              d="M8 14.5s-4.5-4.2-4.5-7.8A4.5 4.5 0 0 1 12.5 6.7c0 3.6-4.5 7.8-4.5 7.8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="6.7" r="1.6" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
