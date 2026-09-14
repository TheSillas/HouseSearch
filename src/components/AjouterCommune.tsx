"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RechercheCommune } from "./RechercheCommune";
import { lienComparaison, MAX_COMPARAISON } from "@/lib/comparaison";
import { communesDepuisNoyau, type Noyau } from "@/lib/noyau";
import { estSelectionnee } from "@/lib/selection";
import { useSelection } from "@/lib/useSelection";
import type { Commune } from "@/lib/types";

/**
 * Ajouter une commune à une comparaison : un champ de recherche sur toutes les
 * communes, qui mène à l'adresse de la comparaison élargie. La liste des
 * communes vient du noyau national, le même fichier immuable que la page
 * d'accueil charge — déjà en cache pour qui vient de la carte.
 */
export function AjouterCommune({
  noyauUrl,
  slugs,
  placeholder = "Ajouter une commune…",
}: {
  noyauUrl: string;
  /** Communes déjà comparées, dans l'ordre. */
  slugs: string[];
  placeholder?: string;
}) {
  const router = useRouter();
  const { selection, etoiler } = useSelection();
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");

  useEffect(() => {
    let annule = false;
    fetch(noyauUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Noyau>;
      })
      .then((noyau) => {
        if (annule) return;
        setCommunes(communesDepuisNoyau(noyau));
        setEtat("pret");
      })
      .catch(() => {
        if (!annule) setEtat("erreur");
      });
    return () => {
      annule = true;
    };
  }, [noyauUrl]);

  const candidates = useMemo(() => communes.filter((c) => !slugs.includes(c.slug)), [communes, slugs]);
  const parCode = useMemo(() => new Map(candidates.map((c) => [c.codeInsee, c])), [candidates]);

  if (slugs.length >= MAX_COMPARAISON) {
    return (
      <p className="text-[12.5px] text-texte-faible">
        {MAX_COMPARAISON} communes au plus : retirez-en une pour en ajouter une autre.
      </p>
    );
  }

  return (
    <div>
      <RechercheCommune
        communes={candidates}
        onChoisir={(codeInsee) => {
          const commune = parCode.get(codeInsee);
          if (!commune) return;
          // La commune rejoint aussi « Ma sélection », cochée : la comparaison
          // et la sélection disent la même chose.
          if (!estSelectionnee(selection, commune.codeInsee)) etoiler(commune);
          router.push(lienComparaison([...slugs, commune.slug]));
        }}
        placeholder={etat === "chargement" ? "Chargement des communes…" : placeholder}
        compact
      />
      {etat === "erreur" && (
        <p role="status" className="mt-1 text-[12px] text-signal">
          La liste des communes n&apos;a pas pu être chargée.
        </p>
      )}
    </div>
  );
}
