"use client";

import { memo, useState } from "react";

import { Curseur } from "./Curseurs";
import { Repere } from "./Repere";
import { SelecteurDepartements } from "./SelecteurDepartements";
import { TOLERANCE_MAX } from "@/lib/couverture";
import { CRITERE_PAR_ID, CRITERES } from "@/lib/criteres";
import type { Repere as ReperePoint } from "@/lib/repere";
import type { Commune } from "@/lib/types";
import type { BorneFiltre, Filtres } from "@/lib/filtres";
import type { DepartementDisponible, FiltreDepartements } from "@/lib/localisation";
import { nombre } from "@/lib/format";
import { useValeurDifferee } from "@/lib/useValeurDifferee";
import type { CritereId } from "@/lib/types";

/**
 * Une plage min-max pour un critère : deux curseurs superposés sur un même
 * rail (voir `.plage-*` dans globals.css).
 *
 * Quand les deux poignées coïncident (plage réduite à un point, ou valeurs
 * proches), celle posée en dernier dans le DOM intercepte le clic. `actif`
 * bascule laquelle des deux passe au-dessus au dernier appui, pour que
 * l'une comme l'autre restent saisissables au doigt comme à la souris.
 */
function LignePlage({
  borne,
  valeur,
  onChange,
}: {
  borne: BorneFiltre;
  valeur: { min: number; max: number };
  onChange: (valeur: { min: number; max: number }) => void;
}) {
  const [actif, setActif] = useState<"min" | "max">("max");
  // Affichage instantané pendant le glissement (poignée, segment, chiffres) ;
  // `onChange` — qui redéclenche le filtrage et le classement sur l'ensemble
  // des communes — n'est appelé qu'au relâchement, jamais à chaque pixel.
  const [valeurLocale, setValeurLocale, commettre] = useValeurDifferee(valeur, onChange);
  const amplitude = Math.max(borne.max - borne.min, 1e-9);
  const pct = (v: number) => ((v - borne.min) / amplitude) * 100;
  const pas = borne.decimales > 0 ? 1 / 10 ** borne.decimales : 1;

  const libelleValeur = (v: number) =>
    borne.unite ? `${nombre(v, borne.decimales)} ${borne.unite}` : nombre(v, borne.decimales);

  return (
    <div className="min-w-0 py-1.5">
      {/* Libellé puis bornes sur deux lignes : sur deux colonnes, la largeur
          ne permet plus de les mettre côte à côte. */}
      <span className="block truncate text-[13px] font-medium" title={borne.mesureLibelle}>
        {borne.mesureLibelle}
      </span>
      <span
        className="chiffres block truncate text-[12px] text-texte-doux"
        title={`${nombre(valeurLocale.min, borne.decimales)} – ${libelleValeur(valeurLocale.max)}`}
      >
        {nombre(valeurLocale.min, borne.decimales)}
        {" – "}
        {libelleValeur(valeurLocale.max)}
      </span>

      <div className="plage-piste mt-1.5">
        <span className="plage-rail" aria-hidden="true" />
        <span
          className="plage-segment"
          aria-hidden="true"
          style={{ left: `${pct(valeurLocale.min)}%`, right: `${100 - pct(valeurLocale.max)}%` }}
        />
        <input
          type="range"
          className="plage-curseur"
          min={borne.min}
          max={borne.max}
          step={pas}
          value={valeurLocale.min}
          style={{ zIndex: actif === "min" ? 2 : 1 }}
          onPointerDown={() => setActif("min")}
          onChange={(e) =>
            setValeurLocale((v) => ({ min: Math.min(Number(e.target.value), v.max), max: v.max }))
          }
          onPointerUp={commettre}
          onKeyUp={commettre}
          onBlur={commettre}
          aria-label={`${borne.mesureLibelle}, minimum`}
          aria-valuetext={libelleValeur(valeurLocale.min)}
        />
        <input
          type="range"
          className="plage-curseur"
          min={borne.min}
          max={borne.max}
          step={pas}
          value={valeurLocale.max}
          style={{ zIndex: actif === "max" ? 2 : 1 }}
          onPointerDown={() => setActif("max")}
          onChange={(e) =>
            setValeurLocale((v) => ({ min: v.min, max: Math.max(Number(e.target.value), v.min) }))
          }
          onPointerUp={commettre}
          onKeyUp={commettre}
          onBlur={commettre}
          aria-label={`${borne.mesureLibelle}, maximum`}
          aria-valuetext={libelleValeur(valeurLocale.max)}
        />
      </div>
    </div>
  );
}

/**
 * Mémoïsé pour la même raison que Curseurs : aucune de ces props ne bouge
 * pendant qu'un curseur de priorité glisse (seul `poidsEnDirect`, jamais
 * transmis ici, le fait), donc rien ne doit re-rendre ce panneau à ce
 * moment-là.
 */
export const FiltresAvances = memo(function FiltresAvances({
  departements,
  departementsSelectionnes,
  onChangeDepartements,
  bornes,
  filtres,
  onChangeFiltre,
  onReinitialiser,
  nbActifs,
  ouvertParDefaut,
  couvertureMin,
  onChangeCouverture,
  sousCouverture,
  repere,
  communesRepere,
  placement,
  onChoisirRepereCommune,
  onDemanderPlacement,
  onRetirerRepere,
  poidsProximite,
  onCommitProximite,
  onLiveChangeProximite,
}: {
  departements: DepartementDisponible[];
  departementsSelectionnes: FiltreDepartements;
  onChangeDepartements: (departements: FiltreDepartements) => void;
  bornes: Partial<Record<CritereId, BorneFiltre>>;
  filtres: Filtres;
  onChangeFiltre: (critere: CritereId, valeur: { min: number; max: number }) => void;
  onReinitialiser: () => void;
  nbActifs: number;
  /** Ouvert d'entrée quand un lien partagé arrive avec un filtre déjà réglé. */
  ouvertParDefaut: boolean;
  /** Critères activés manquants tolérés pour qu'une commune reste classée (voir couverture.ts). */
  couvertureMin: number;
  onChangeCouverture: (minimum: number) => void;
  /** Communes écartées par cette règle dans le contexte courant. */
  sousCouverture: number;
  /** Le repère personnel et le curseur Proximité qu'il active (voir repere.ts). */
  repere: ReperePoint | null;
  communesRepere: Commune[];
  placement: boolean;
  onChoisirRepereCommune: (codeInsee: string) => void;
  onDemanderPlacement: () => void;
  onRetirerRepere: () => void;
  poidsProximite: number;
  onCommitProximite: (valeur: number) => void;
  onLiveChangeProximite: (valeur: number) => void;
}) {
  const entrees = CRITERES.filter((c) => c.curseur !== false && bornes[c.id]);
  if (entrees.length === 0 && departements.length < 2) return null;


  return (
    <section className="border-t border-trait pt-1.5">
      {/* Replié par défaut : un budget maximal ou un département reste une
          option, pas une contrainte qu'on impose à l'écran avant même
          d'avoir vu le classement. */}
      <details className="group" open={ouvertParDefaut}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 marker:content-none">
          <svg
            className="h-3 w-3 shrink-0 text-texte-faible transition-transform group-open:rotate-90"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="m4.5 2.5 3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[13px] font-medium uppercase tracking-wide text-texte-doux">
            Filtres avancés
          </span>
          {nbActifs > 0 && (
            <span className="chiffres rounded-full bg-accent-doux px-1.5 py-0.5 text-[11px] font-medium text-accent-fort">
              {nbActifs}
            </span>
          )}
        </summary>

        <div className="mt-1">
          {/* « Réinitialiser » partage la ligne du premier libellé plutôt que
              d'occuper une rangée vide quand aucun filtre n'est actif. */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-medium">
              {departements.length >= 2 ? "Localisation" : ""}
            </span>
            <button
              type="button"
              onClick={onReinitialiser}
              disabled={nbActifs === 0}
              className="-my-1 -mr-2 rounded px-2 py-2 text-[13px] text-texte-faible transition-colors enabled:hover:text-accent disabled:opacity-0"
            >
              Réinitialiser
            </button>
          </div>

          {departements.length >= 2 && (
            <div className="pb-1">
              <div className="mt-1">
                <SelecteurDepartements
                  departements={departements}
                  selectionnes={departementsSelectionnes}
                  onChange={onChangeDepartements}
                />
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-texte-faible">
                {departementsSelectionnes.length === 0
                  ? "Aucun département retenu : toutes les communes sont comparées."
                  : "Seules les communes des départements retenus sont classées."}
              </p>
            </div>
          )}

          {/* Le repère personnel et le curseur Proximité : un réglage de plus,
              pas une priorité du quotidien — il vit ici, replié, avec la plage
              « Distance au repère » qu'il fait apparaître plus bas. */}
          <div className="border-t border-trait pt-2.5">
            <div className="grid grid-cols-2 gap-x-5 gap-y-0.5">
              <Curseur
                critere={CRITERE_PAR_ID.proximite}
                valeur={poidsProximite}
                onCommit={onCommitProximite}
                onLiveChange={onLiveChangeProximite}
                inerte={!repere}
              />
              <Repere
                repere={repere}
                communes={communesRepere}
                placement={placement}
                onChoisirCommune={onChoisirRepereCommune}
                onDemanderPlacement={onDemanderPlacement}
                onRetirer={onRetirerRepere}
              />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-texte-faible">
              {repere
                ? "Le curseur Proximité classe par distance à vol d'oiseau depuis ce repère ; la plage « Distance au repère » ci-dessous exclut au-delà d'un rayon."
                : "Choisissez une commune ou un point de la carte : le curseur Proximité classe alors par distance à ce lieu."}
            </p>
          </div>

          {/* Couverture : à l'échelle nationale, beaucoup de petites communes
              n'ont de données que sur une partie des critères. Une commune non
              renseignée sur un critère activé n'est pas classée, sauf tolérance
              choisie ici ; les communes écartées restent sur la carte. */}
          <div className="flex items-baseline justify-between gap-3 border-t border-trait pt-2.5">
            <label htmlFor="couverture-min" className="text-[13px] font-medium">
              Critères activés manquants tolérés
            </label>
            <select
              id="couverture-min"
              value={couvertureMin}
              onChange={(e) => onChangeCouverture(Number(e.target.value))}
              className="chiffres rounded-lg border border-trait bg-carte px-2 py-1.5 text-[13px] text-texte"
            >
              {Array.from({ length: TOLERANCE_MAX + 1 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "aucun" : n}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-texte-faible">
            {sousCouverture > 0 ? (
              <>
                <span className="chiffres">{sousCouverture.toLocaleString("fr-FR")}</span> commune
                {sousCouverture > 1 ? "s" : ""} sans donnée sur un critère que vous avez activé :
                visible{sousCouverture > 1 ? "s" : ""} sur la carte et consultable
                {sousCouverture > 1 ? "s" : ""}, hors classement. Mettez un curseur à zéro ou
                tolérez des manques pour les classer.
              </>
            ) : (
              "Toutes les communes retenues sont renseignées sur vos critères activés."
            )}
          </p>

          {/* Deux colonnes, comme les curseurs de priorité : les rails font
              environ 170 px dans le panneau, les poignées restent saisissables. */}
          {entrees.length > 0 && (
            <div className="grid grid-cols-2 gap-x-5 pt-2">
              {entrees.map((critere) => {
                const borne = bornes[critere.id]!;
                const valeur = filtres[critere.id] ?? { min: borne.min, max: borne.max };
                return (
                  <LignePlage
                    key={critere.id}
                    borne={borne}
                    valeur={valeur}
                    onChange={(v) => onChangeFiltre(critere.id, v)}
                  />
                );
              })}
            </div>
          )}

          <p className="mt-1 text-[12px] leading-snug text-texte-faible">
            Une commune sans donnée sur un critère filtré n&apos;est pas affichée tant que ce filtre
            est actif.
          </p>
        </div>
      </details>
    </section>
  );
});
