"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "motion/react";

import { BarrePosition } from "./BarrePosition";
import { Etoile } from "./Etoile";
import { CRITERES, CRITERES_CLASSANTS } from "@/lib/criteres";
import { nomDepartement } from "@/lib/departements";
import { phraseComparative, valeurMesure } from "@/lib/format";
import { mesurePosition, mesureVedette } from "@/lib/mesures";
import type { LigneClassement as Ligne, Poids, Referentiel } from "@/lib/scoring";

function libellesCriteres(ids: Ligne["criteresIgnores"]): string {
  return ids
    .map((id) => CRITERES.find((c) => c.id === id)?.libelle.toLowerCase())
    .filter(Boolean)
    .join(", ");
}

/**
 * Une ligne du classement, dans le panneau latéral : le rang, la commune, et
 * la donnée vedette de chacun des quatre critères — le chiffre brut avec son
 * unité, jamais une note, sous lequel une barre fine donne la position parmi
 * les communes comparées. Serrée pour qu'une demi-douzaine de lignes tiennent
 * à côté de la carte ; le détail complet, avec sources et millésimes, est sur
 * la fiche.
 *
 * Elle parle à la carte dans les deux sens : la survoler met la commune en
 * évidence sur la carte, le repère « voir sur la carte » y vole. Le nom, lui,
 * mène à la fiche.
 *
 * Mémoïsée : `classement` (donc chaque `ligne`) ne dépend que du poids
 * commis, jamais de `poidsEnDirect` — sans ce mémo, toutes les lignes
 * affichées se re-rendraient à chaque tick d'un glissement de curseur pour un
 * résultat visuellement identique.
 */
export const LigneResultat = memo(function LigneResultat({
  ligne,
  referentiel,
  poids,
  anime,
  classe,
  onSurvol,
  onCibler,
}: {
  ligne: Ligne;
  referentiel: Referentiel;
  poids: Poids;
  anime: boolean;
  /** Faux quand tous les curseurs sont à zéro : il n'y a alors pas de rang. */
  classe: boolean;
  onSurvol: (codeInsee: string | null) => void;
  onCibler: (codeInsee: string) => void;
}) {
  const { commune, rang } = ligne;
  const positions = referentiel.positions[commune.codeInsee] ?? {};
  const premier = classe && rang === 1;

  return (
    <motion.li
      layout={anime ? "position" : false}
      transition={{ type: "spring", stiffness: 420, damping: 42, mass: 0.9 }}
      className="list-none"
    >
      <div
        className={`flex gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:border-accent-trait ${
          premier ? "border-accent-trait bg-accent-doux/40" : "border-trait bg-carte"
        }`}
        onMouseEnter={() => onSurvol(commune.codeInsee)}
        onMouseLeave={() => onSurvol(null)}
      >
        {classe && (
          <span
            className={`chiffres mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
              premier ? "bg-accent text-carte" : "bg-doux text-texte-doux"
            }`}
            aria-hidden="true"
          >
            {rang}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight" title={commune.nom}>
                {/* La pastille de rang est décorative : sans ce rappel, le rang
                    ne serait annoncé nulle part. Il disparaît avec le classement. */}
                {classe && (
                  <span className="sr-only">{rang === 1 ? "1re" : `${rang}e`} — </span>
                )}
                <Link
                  href={`/ville/${commune.slug}`}
                  scroll={false}
                  className="rounded-sm outline-offset-2 transition-colors hover:text-accent"
                >
                  {commune.nom}
                </Link>
              </h3>
              <p className="mt-0.5 truncate text-[12px] text-texte-faible" title={nomDepartement(commune.departement)}>
                <span className="chiffres">{commune.population.toLocaleString("fr-FR")}</span> hab.
                {" · "}
                {nomDepartement(commune.departement)}{" "}
                <span className="chiffres">({commune.departement})</span>
              </p>
            </div>
            <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
              <Etoile commune={commune} />
            <button
              type="button"
              onClick={() => onCibler(commune.codeInsee)}
              aria-label={`Voir ${commune.nom} sur la carte`}
              title="Voir sur la carte"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-texte-faible transition-colors hover:bg-doux hover:text-accent"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 14.5s4.5-4.2 4.5-8A4.5 4.5 0 0 0 3.5 6.5c0 3.8 4.5 8 4.5 8Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="6.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            </div>
          </div>

          {/* Les critères qui pèsent (neuf, sur trois rangées de trois) : à 400 px,
              trois colonnes laissent ~110 px à un chiffre et son unité. Les
              critères informatifs (fiscalité, risques) se lisent sur la fiche. */}
          <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
            {CRITERES_CLASSANTS.map((critere) => {
              const donnees = commune.criteres[critere.id];
              const mesure = donnees ? mesureVedette(donnees.mesures) : undefined;
              // La barre lit la position de la mesure qui classe, pas
              // forcément celle du chiffre affiché (voir mesurePosition).
              const mesurePos = donnees ? mesurePosition(donnees.mesures, mesure) : undefined;
              const position = mesurePos ? (positions[mesurePos.id] ?? null) : null;
              const compte = (poids[critere.id] ?? 0) > 0;
              const phrase = mesurePos ? phraseComparative(mesurePos, position) : null;
              return (
                <div key={critere.id} className={compte ? "" : "opacity-40"}>
                  <span
                    // Césure française plutôt que coupure brute : « établisse-
                    // ments » et non « établisseme / nts » dans 85 px.
                    className="chiffres block min-h-[2.4em] text-[11.5px] font-medium leading-tight tabular-nums break-words hyphens-auto"
                    lang="fr"
                    title={mesure?.libelle}
                  >
                    {mesure
                      ? // Une unité composée (« consult./an/hab. ») se coupe après une
                        // barre oblique, jamais au milieu d'un mot (« ha / b. »).
                        valeurMesure(mesure)
                          .split("/")
                          .flatMap((part, i, tout) =>
                            i < tout.length - 1 ? [part, "/", <wbr key={i} />] : [part],
                          )
                      : "—"}
                  </span>
                  <span className="mt-1 block">
                    <BarrePosition
                      position={position}
                      libelleAccessible={
                        mesure && phrase
                          ? `${mesure.libelleCourt ?? mesure.libelle} : ${phrase}`
                          : undefined
                      }
                    />
                  </span>
                  <span
                    className="mt-1 block truncate text-[10px] uppercase tracking-[0.04em] text-texte-faible"
                    title={critere.libelle}
                  >
                    {critere.libelleCourt ?? critere.libelle}
                  </span>
                </div>
              );
            })}
          </div>

          {ligne.criteresIgnores.length > 0 && (
            <p className="mt-1.5 text-[11.5px] leading-snug text-signal">
              Sans donnée : {libellesCriteres(ligne.criteresIgnores)} — écarté du calcul.
            </p>
          )}
          {ligne.criteresPartiels.length > 0 && (
            <p className="mt-1 text-[11.5px] leading-snug text-signal">
              {libellesCriteres(ligne.criteresPartiels)} : classé sur une partie des mesures.
            </p>
          )}
        </div>
      </div>
    </motion.li>
  );
});
