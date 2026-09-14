"use client";

import { memo, useState } from "react";
import { CRITERES_CLASSANTS, CRITERES_PRIORITES, POIDS_MAX, POIDS_MIN, libellePoids } from "@/lib/criteres";
import { useValeurDifferee } from "@/lib/useValeurDifferee";
import type { CritereId } from "@/lib/types";
import type { Poids } from "@/lib/scoring";

/**
 * Un seul curseur. La valeur affichée (poignée, remplissage, libellé) suit le
 * doigt ou la souris à chaque pixel, sans jamais attendre le classement : ce
 * n'est qu'au relâchement (ou à l'appui d'une flèche du clavier) que la
 * valeur est commise au parent, qui déclenche alors le recalcul du
 * classement — une seule fois, pas à chaque tick de glissement.
 */
export function Curseur({
  critere,
  valeur,
  onCommit,
  onLiveChange,
  inerte,
}: {
  critere: (typeof CRITERES_CLASSANTS)[number];
  valeur: number;
  onCommit: (valeur: number) => void;
  /** Chaque tick de glissement, sans attendre le relâchement — voir CarteFrance. */
  onLiveChange: (valeur: number) => void;
  /** Le critère ne compte pas pour l'instant (aucun repère choisi) : curseur grisé et désactivé. */
  inerte?: boolean;
}) {
  const [valeurLocale, setValeurLocale, commettre] = useValeurDifferee(valeur, onCommit);
  const inactif = valeurLocale <= 0 || Boolean(inerte);
  const remplissage = ((valeurLocale - POIDS_MIN) / (POIDS_MAX - POIDS_MIN)) * 100;

  return (
    // Le curseur s'aligne en bas de sa case : quand un libellé long (« Prix de
    // l'immobilier ») renvoie son niveau à la ligne, le rail reste à la même
    // hauteur que celui de la case voisine.
    <div className="flex h-full flex-col justify-end">
      <label htmlFor={`curseur-${critere.id}`} className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span
          className={`whitespace-nowrap text-[14px] font-medium transition-colors ${
            inactif ? "text-texte-faible" : "text-texte"
          }`}
        >
          {/* Six curseurs sur deux colonnes : le libellé court évite
              qu'« Emploi & revenus » ne pousse « Important » à la ligne. */}
          {critere.libelleCurseur ?? critere.libelleCourt ?? critere.libelle}
        </span>
        <span
          // `ml-auto` : renvoyé à la ligne sous un libellé long, le niveau reste calé à droite.
          className={`ml-auto text-[12.5px] transition-colors ${inactif ? "text-texte-faible" : "text-accent"}`}
        >
          {inerte ? "Sans repère" : libellePoids(valeurLocale)}
        </span>
      </label>
      <span id={`aide-${critere.id}`} className="sr-only">
        {critere.description}
      </span>

      <input
        id={`curseur-${critere.id}`}
        className="curseur mt-1 block"
        type="range"
        min={POIDS_MIN}
        max={POIDS_MAX}
        step={1}
        value={valeurLocale}
        data-inactif={inactif}
        disabled={Boolean(inerte)}
        style={{ "--remplissage": `${remplissage}%` } as React.CSSProperties}
        onChange={(e) => {
          const v = Number(e.target.value);
          setValeurLocale(v);
          onLiveChange(v);
        }}
        onPointerUp={commettre}
        onKeyUp={commettre}
        onBlur={commettre}
        aria-describedby={`aide-${critere.id}`}
        aria-valuetext={inerte ? "Sans repère" : `${libellePoids(valeurLocale)}, ${valeurLocale} sur 100`}
      />
    </div>
  );
}

/**
 * Le panneau des priorités : huit curseurs sur deux colonnes, toujours visibles
 * en tête du panneau latéral. Ce que mesure chaque critère reste replié (chaque
 * curseur garde sa description en `aria-describedby`) : on règle d'abord, on
 * lit la définition si l'on doute.
 *
 * Mémoïsé : `poids` (commis) ne change jamais pendant un glissement, seul
 * `poidsEnDirect` (voir Comparateur) bouge à chaque tick — sans ce mémo, le
 * panneau entier se re-rendrait à chaque pixel parcouru pour un résultat
 * visuellement identique.
 */
export const Curseurs = memo(function Curseurs({
  poids,
  onCommit,
  onLiveChange,
  onReinitialiser,
  modifie,
}: {
  poids: Poids;
  onCommit: (critere: CritereId, valeur: number) => void;
  onLiveChange: (critere: CritereId, valeur: number) => void;
  onReinitialiser: () => void;
  modifie: boolean;
}) {
  // Les définitions des critères se déplient sous la grille ; leur bouton vit
  // dans la ligne de titre plutôt que sur une ligne à lui, pour que le
  // classement reste visible dès l'ouverture sur un téléphone.
  const [definitions, setDefinitions] = useState(false);
  return (
    <section aria-labelledby="titre-priorites" className="px-4 pt-3 pb-1">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="titre-priorites"
          className="text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux"
        >
          Vos priorités
        </h2>
        <div className="-mr-2 flex items-baseline">
          <button
            type="button"
            onClick={onReinitialiser}
            disabled={!modifie}
            className="rounded px-2 py-2 text-[13px] text-texte-faible transition-colors enabled:hover:text-accent disabled:hidden"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => setDefinitions((d) => !d)}
            aria-expanded={definitions}
            aria-controls="definitions-criteres"
            className="rounded px-2 py-2 text-[13px] text-texte-faible transition-colors hover:text-accent"
          >
            {definitions ? "Masquer les définitions" : "Que mesure chaque curseur ?"}
          </button>
        </div>
      </div>

      <div className="mt-0.5 grid grid-cols-2 gap-x-5 gap-y-0.5">
        {CRITERES_PRIORITES.map((critere) => (
          <Curseur
            key={critere.id}
            critere={critere}
            valeur={poids[critere.id] ?? 0}
            onCommit={(valeur) => onCommit(critere.id, valeur)}
            onLiveChange={(valeur) => onLiveChange(critere.id, valeur)}
          />
        ))}
      </div>

      <dl id="definitions-criteres" hidden={!definitions} className="mt-2 mb-1 space-y-2 text-[12.5px] leading-snug">
        {CRITERES_CLASSANTS.map((critere) => (
          <div key={critere.id}>
            <dt className="inline text-texte-doux">{critere.libelle} — </dt>
            <dd className="inline text-texte-faible">{critere.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
});
