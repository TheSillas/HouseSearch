"use client";

import { estSelectionnee, type CommuneReperable } from "@/lib/selection";
import { useSelection } from "@/lib/useSelection";

/**
 * L'étoile qui ajoute une commune à « Ma sélection » ou l'en retire. Même geste
 * partout : ligne du classement, fiche, volet. Pleine quand la commune est
 * retenue. Se suffit à elle-même (elle lit le magasin), pour que la ligne de
 * classement mémoïsée qui la contient n'ait pas à se re-rendre.
 */
export function Etoile({ commune, taille = "compacte" }: { commune: CommuneReperable; taille?: "compacte" | "large" }) {
  const { selection, etoiler } = useSelection();
  const retenue = estSelectionnee(selection, commune.codeInsee);
  const boite = taille === "large" ? "h-10 w-10" : "h-9 w-9";
  const icone = taille === "large" ? "h-5 w-5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={() => etoiler(commune)}
      aria-pressed={retenue}
      aria-label={retenue ? `Retirer ${commune.nom} de ma sélection` : `Ajouter ${commune.nom} à ma sélection`}
      title={retenue ? "Retirer de ma sélection" : "Ajouter à ma sélection"}
      className={`flex ${boite} shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-doux ${
        retenue ? "text-accent" : "text-texte-faible hover:text-accent"
      }`}
    >
      <svg className={icone} viewBox="0 0 16 16" fill={retenue ? "currentColor" : "none"} aria-hidden="true">
        <path
          d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
