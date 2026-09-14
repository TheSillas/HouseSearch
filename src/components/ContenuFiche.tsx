import { BlocCritere } from "./BlocCritere";
import { Demographie } from "./Demographie";
import { HistoriquePolitique } from "./HistoriquePolitique";
import { CRITERES } from "@/lib/criteres";
import { nomDepartement } from "@/lib/departements";
import { nombre } from "@/lib/format";
import type { Referentiel } from "@/lib/scoring";
import type { Commune } from "@/lib/types";

/**
 * Le corps d'une fiche commune, commun à ses deux présentations : la page
 * entière (/ville/<slug>, lien partageable) et le volet qui remplace le
 * panneau de la carte quand on y arrive depuis celle-ci (voir
 * (carte)/@detail). Même contenu, même ordre, mêmes chiffres : seul
 * l'habillage autour change.
 */
export function ContenuFiche({
  commune,
  referentiel,
  nbCommunesComparees,
  serre = false,
}: {
  commune: Commune;
  referentiel: Referentiel;
  nbCommunesComparees: number;
  /** Vrai dans le volet, plus étroit : marges et corps réduits. */
  serre?: boolean;
}) {
  return (
    <>
      <p className={`chiffres ${serre ? "text-[13px]" : "text-[13.5px]"} text-texte-doux`}>
        {nombre(commune.population)} habitants
        <span className="text-texte-faible"> (recensement {commune.anneePopulation})</span>
        {commune.epci ? ` · ${commune.epci}` : ""}
      </p>
      <p className="chiffres mt-1 text-[12px] text-texte-faible">
        Code INSEE {commune.codeInsee} · Département {commune.departement} (
        {nomDepartement(commune.departement)})
        {commune.surfaceKm2 ? ` · ${nombre(commune.surfaceKm2, 1)} km²` : ""}
        {commune.codesPostaux?.length ? ` · ${commune.codesPostaux.join(", ")}` : ""}
      </p>
      {commune.note && (
        <p className="mt-3 rounded-lg border border-trait bg-doux px-3.5 py-2.5 text-[12.5px] leading-relaxed text-texte-doux">
          {commune.note}
        </p>
      )}

      {/* Qui vit là, en une bande : contexte de lecture des critères. */}
      {commune.demographie && (
        <div className={serre ? "mt-3" : "mt-4"}>
          <Demographie donnees={commune.demographie} />
        </div>
      )}

      {/* Blocs repliés : un chiffre clé et une position par critère, chaque bloc
          s'ouvre sur toutes ses mesures et ses sources. */}
      <div className={`${serre ? "mt-4" : "mt-5"} flex flex-col gap-3`}>
        {/* Proximité n'est pas une donnée de la commune : c'est une distance à
            votre repère, calculée sur la carte quand un repère est choisi. Sans
            elle, la fiche n'a rien à en dire — pas de bloc « aucune donnée ». */}
        {CRITERES.filter((meta) => meta.id !== "proximite" || commune.criteres.proximite).map((meta) => (
          <BlocCritere
            key={meta.id}
            meta={meta}
            donnees={commune.criteres[meta.id]}
            referentiel={referentiel}
            codeInsee={commune.codeInsee}
          />
        ))}

        <HistoriquePolitique commune={commune} />
      </div>

      <p className="mt-6 text-[12.5px] leading-relaxed text-texte-faible">
        Les mentions « devance X&nbsp;% des villes comparées » se rapportent uniquement aux{" "}
        {nbCommunesComparees} communes de ce comparateur, pas à la France entière.
      </p>
    </>
  );
}
