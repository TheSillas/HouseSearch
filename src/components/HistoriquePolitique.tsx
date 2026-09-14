import { dateCourte, nombre } from "@/lib/format";
import type { Commune, Scrutin } from "@/lib/types";

/**
 * Restitution des scrutins.
 *
 * Parti pris explicite : aucun score, aucun classement, aucun qualificatif
 * ajouté. On reprend les libellés et les nuances tels que le ministère de
 * l'Intérieur les publie, et les barres sont d'une seule couleur neutre pour
 * qu'aucune couleur politique ne soit suggérée par l'interface.
 */
function BlocScrutin({ scrutin }: { scrutin: Scrutin }) {
  const resultats = [...scrutin.resultats].sort((a, b) => b.pourcentage - a.pourcentage);

  return (
    <article className="border-t border-trait py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight">
          {scrutin.nom}
          {scrutin.tour && <span className="font-normal text-texte-doux"> — {scrutin.tour}</span>}
        </h3>
        <p className="chiffres text-[12.5px] text-texte-faible">{dateCourte(scrutin.date)}</p>
      </div>

      {scrutin.participation !== null && (
        <p className="chiffres mt-1 text-[12.5px] text-texte-doux">
          Participation {nombre(scrutin.participation, 1)} %
          {scrutin.inscrits ? ` · ${nombre(scrutin.inscrits)} inscrits` : ""}
        </p>
      )}

      <ul className="mt-3.5 space-y-2.5">
        {resultats.map((resultat, i) => (
          <li key={`${resultat.libelle}-${i}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-[13.5px] leading-snug">
                <span className="text-texte">{resultat.libelle}</span>
                {resultat.nuance && (
                  <span className="ml-1.5 rounded border border-trait px-1 py-px align-middle text-[10.5px] uppercase tracking-wide text-texte-faible">
                    {resultat.nuance}
                  </span>
                )}
              </p>
              <p className="chiffres shrink-0 text-[14px] font-semibold tabular-nums">
                {nombre(resultat.pourcentage, 1)} %
              </p>
            </div>
            {(resultat.nuanceLibelle || resultat.precision) && (
              <p className="mt-0.5 text-[12px] text-texte-faible">
                {[resultat.nuanceLibelle, resultat.precision].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-doux">
              <div
                className="h-full rounded-full bg-trait-fort"
                style={{ width: `${Math.min(Math.max(resultat.pourcentage, 0), 100)}%` }}
              />
            </div>
            {resultat.voix !== undefined && (
              <p className="chiffres mt-1 text-[11.5px] text-texte-faible">
                {nombre(resultat.voix)} voix
              </p>
            )}
          </li>
        ))}
      </ul>

      {scrutin.note && <p className="mt-3 text-[12px] text-texte-faible">{scrutin.note}</p>}

      <p className="mt-3 text-[12px] text-texte-faible">
        Source : {scrutin.source.nom} — {scrutin.source.producteur}, {scrutin.source.annee}.{" "}
        <a
          href={scrutin.source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent underline underline-offset-2"
        >
          Résultats officiels
        </a>
      </p>
    </article>
  );
}

export function HistoriquePolitique({ commune }: { commune: Commune }) {
  const { maire, scrutins } = commune.politique;

  if (!maire && scrutins.length === 0) {
    return null;
  }

  // Même principe que les critères (voir BlocCritere) : replié, le bloc dit
  // qui est maire et combien de scrutins sont disponibles ; déplié, il donne
  // les résultats complets. Le résumé vit dans un <summary>, donc en <span>.
  return (
    <details className="group scroll-mt-4 rounded-2xl border border-trait bg-carte shadow-carte transition-colors open:border-trait-fort">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3.5 marker:content-none sm:px-6">
        <span className="min-w-0 flex-1">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
            Historique électoral
          </h2>
          {maire ? (
            <>
              <span className="mt-1 block text-[17px] font-semibold leading-tight tracking-tight">
                {maire.nom}
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-texte-doux">
                Maire en exercice
                {maire.depuis && <> · depuis le {dateCourte(maire.depuis)}</>}
              </span>
              {/* La nuance est celle publiée par le ministère pour la liste
                  arrivée en tête aux municipales, reprise seulement quand le
                  maire la conduisait (voir build-dataset.mjs). Le RNE n'en
                  publie aucune pour les maires eux-mêmes : quand il n'y en a
                  pas, on le dit, on n'en déduit pas. */}
              {maire.nuance ? (
                <span className="mt-1.5 block text-[13px] leading-snug">
                  <span className="rounded border border-trait-fort px-1 py-px align-middle text-[10.5px] uppercase tracking-wide text-texte-faible">
                    {maire.nuance}
                  </span>{" "}
                  <span className="text-texte">{maire.nuanceLibelle ?? maire.nuance}</span>
                  <span className="text-texte-faible">
                    {" "}
                    · nuance de sa liste aux municipales 2026, telle que publiée par le
                    ministère de l&apos;Intérieur
                  </span>
                </span>
              ) : (
                <span className="mt-1.5 block text-[12.5px] leading-snug text-texte-faible">
                  Nuance politique non publiée : le Répertoire national des élus n&apos;en
                  attribue pas aux maires, et celle de la liste n&apos;est reprise que s&apos;il
                  la conduisait.
                </span>
              )}
            </>
          ) : (
            <span className="mt-1 block text-[13px] text-texte-faible">Maire non renseigné</span>
          )}
          <span className="mt-3 block text-[12px] text-texte-faible group-open:hidden">
            <span className="chiffres">{scrutins.length}</span> scrutin{scrutins.length > 1 ? "s" : ""}{" "}
            · résultats officiels du ministère de l&apos;Intérieur
            <span className="text-accent"> · voir le détail</span>
          </span>
        </span>
        <svg
          className="mt-1 h-4 w-4 shrink-0 text-texte-faible transition-transform group-open:rotate-90"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>

      <div className="border-t border-trait px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <p className="text-[12.5px] leading-relaxed text-texte-faible">
          Résultats officiels des derniers scrutins, repris sans commentaire ni interprétation.
          Les nuances affichées sont celles attribuées par le ministère de l&apos;Intérieur.
        </p>
        {maire && (
          <p className="mt-2 text-[11.5px] text-texte-faible">
            Maire : source {maire.source.nom} — {maire.source.producteur}, {maire.source.annee}.
          </p>
        )}

        <div className="mt-4">
          {scrutins.map((scrutin) => (
            <BlocScrutin key={scrutin.id} scrutin={scrutin} />
          ))}
        </div>
      </div>
    </details>
  );
}
