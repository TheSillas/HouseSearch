"use client";

import Link from "next/link";

import { lienComparaison, MIN_COMPARAISON } from "@/lib/comparaison";
import { nomDepartement } from "@/lib/departements";
import { comparees, MAX_COMPAREES } from "@/lib/selection";
import { useSelection } from "@/lib/useSelection";

/**
 * « Ma sélection », toujours à portée : les communes étoilées, les cochées en
 * premier, chacune avec sa case « dans la comparaison », son lien vers la
 * fiche et sa croix. Le bouton compare les communes cochées — l'adresse qu'il
 * ouvre ne porte que celles-là, et se partage. Rien tant que la liste est
 * vide : le bandeau n'occupe pas d'espace pour annoncer qu'il n'a rien à dire.
 */
export function BandeauSelection({ variante }: { variante: "panneau" | "page" }) {
  const { selection, cocher, enlever } = useSelection();
  if (selection.length === 0) return null;

  const cochees = comparees(selection);
  const ordonnee = [...cochees, ...selection.filter((c) => !c.comparee)];
  const plafond = cochees.length >= MAX_COMPAREES;
  const comparable = cochees.length >= MIN_COMPARAISON;

  return (
    <section
      aria-labelledby="titre-selection"
      className={
        variante === "panneau"
          ? "sticky bottom-0 z-20 border-t border-trait bg-carte/95 px-4 pt-1.5 pb-2 shadow-[0_-6px_16px_-12px_rgba(0,0,0,0.25)] backdrop-blur"
          : // Pleine largeur d'écran, quelle que soit la colonne de la page : marges
            // négatives jusqu'aux bords de la fenêtre, contenu ramené dans la colonne.
            "sticky bottom-0 z-20 mx-[calc(50%-50vw)] border-t border-trait bg-carte/95 px-[max(1.25rem,calc(50vw-50%))] pt-1.5 pb-2 backdrop-blur"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="titre-selection" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
          Ma sélection <span className="chiffres text-texte-faible">· {selection.length}</span>
        </h2>
        {comparable ? (
          <Link
            href={lienComparaison(cochees.map((c) => c.slug))}
            className="rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-medium text-carte transition-colors hover:bg-accent-fort"
          >
            Comparer ces {cochees.length} communes
          </Link>
        ) : (
          <span className="text-[11.5px] text-texte-faible">
            {cochees.length === 0 ? "Cochez des communes à comparer" : "Cochez une seconde commune pour comparer"}
          </span>
        )}
      </div>

      {/* Une seule ligne, qui défile horizontalement : le bandeau ne doit pas
          grandir avec la liste et manger le classement au-dessus. */}
      <ul className="mt-1.5 flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        {ordonnee.map((c) => {
          const bloquee = !c.comparee && plafond;
          return (
            <li
              key={c.codeInsee}
              className={`flex shrink-0 items-center gap-1 rounded-full border pl-1.5 pr-1 text-[12px] ${
                c.comparee ? "border-accent-trait bg-accent-doux/50" : "border-trait bg-doux/60 text-texte-doux"
              }`}
            >
              <input
                type="checkbox"
                checked={c.comparee}
                disabled={bloquee}
                onChange={() => cocher(c.codeInsee)}
                aria-label={`${c.nom} dans la comparaison`}
                title={bloquee ? `${MAX_COMPAREES} communes comparées au plus : décochez-en une` : "Dans la comparaison"}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              <Link
                href={`/ville/${c.slug}`}
                className="max-w-[140px] truncate py-0.5 hover:text-accent"
                title={`${c.nom} · ${nomDepartement(c.departement)}`}
              >
                {c.nom}
              </Link>
              <button
                type="button"
                onClick={() => enlever(c.codeInsee)}
                aria-label={`Retirer ${c.nom} de ma sélection`}
                title="Retirer de ma sélection"
                className="flex h-5 w-5 items-center justify-center rounded-full text-texte-faible transition-colors hover:bg-doux hover:text-texte"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="m3 3 6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
