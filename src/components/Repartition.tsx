"use client";

import { useState } from "react";

import { nombre } from "@/lib/format";

/**
 * Un chiffre décomposé en postes nommés : les principaux visibles d'emblée en
 * deux colonnes, effectif aligné à droite, le reste derrière un bouton.
 * Un `<details>` obligerait à placer « Replier » au-dessus des lignes dépliées
 * (le `<summary>` est toujours premier) : ici le bouton suit la liste.
 */
export type Poste = { libelle: string; effectif: number };
const POSTES_VISIBLES = 6;

function Lignes({ items, colonnes }: { items: Poste[]; colonnes: 1 | 2 }) {
  return (
    <ul className={`grid grid-cols-1 gap-x-6 gap-y-0.5 text-[12.5px] ${colonnes === 2 ? "sm:grid-cols-2" : ""}`}>
      {items.map((p) => (
        <li key={p.libelle} className="flex items-baseline justify-between gap-3 border-b border-dotted border-trait py-0.5">
          <span className="min-w-0 truncate text-texte-doux" title={p.libelle}>
            {p.libelle}
          </span>
          <span className="chiffres shrink-0 tabular-nums text-texte">{nombre(p.effectif)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Repartition({ postes, colonnes = 2 }: { postes: Poste[]; colonnes?: 1 | 2 }) {
  const [ouvert, setOuvert] = useState(false);
  const principaux = postes.slice(0, POSTES_VISIBLES);
  const autres = postes.slice(POSTES_VISIBLES);
  return (
    <div className="mt-2">
      <Lignes items={ouvert ? postes : principaux} colonnes={colonnes} />
      {autres.length > 0 && (
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          className="mt-1 inline-flex cursor-pointer items-center gap-1 py-1 text-[12px] text-texte-faible underline decoration-trait-fort underline-offset-2 hover:text-accent"
        >
          {ouvert ? "Replier" : `Voir les ${autres.length} autres`}
        </button>
      )}
    </div>
  );
}
