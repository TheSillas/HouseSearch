"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { slugifier } from "@/lib/format";
import type { DepartementDisponible, FiltreDepartements } from "@/lib/localisation";

/**
 * Le filtre de localisation : une liste déroulante à choix multiple, avec un
 * champ pour chercher un département par son nom ou son numéro. Les
 * départements retenus s'affichent en puces retirables au-dessus du champ ;
 * la liste, elle, ne s'ouvre qu'à la demande — 96 puces en permanence
 * noyaient le panneau.
 *
 * Clavier : flèches pour parcourir, Entrée ou Espace pour cocher/décocher,
 * Échap pour fermer ; la saisie filtre sans fermer.
 */
export function SelecteurDepartements({
  departements,
  selectionnes,
  onChange,
}: {
  departements: DepartementDisponible[];
  selectionnes: FiltreDepartements;
  onChange: (selection: FiltreDepartements) => void;
}) {
  const idListe = useId();
  const racineRef = useRef<HTMLDivElement>(null);
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);

  const index = useMemo(
    () => departements.map((d) => ({ d, cle: `${d.code} ${slugifier(d.nom)}` })),
    [departements],
  );
  const requete = slugifier(texte);
  const visibles = useMemo(
    () => (requete ? index.filter((e) => e.cle.includes(requete)) : index).map((e) => e.d),
    [index, requete],
  );
  const parCode = useMemo(() => new Map(departements.map((d) => [d.code, d])), [departements]);

  // Fermeture au clic hors du composant.
  useEffect(() => {
    if (!ouvert) return;
    const surPointeur = (e: PointerEvent) => {
      if (!racineRef.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", surPointeur);
    return () => document.removeEventListener("pointerdown", surPointeur);
  }, [ouvert]);

  const basculer = (code: string) => {
    onChange(
      selectionnes.includes(code) ? selectionnes.filter((c) => c !== code) : [...selectionnes, code],
    );
  };

  return (
    <div ref={racineRef} className="relative">
      {selectionnes.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Départements retenus">
          {selectionnes.map((code) => {
            const d = parCode.get(code);
            return (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => basculer(code)}
                  aria-label={`Retirer ${d?.nom ?? code}`}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-accent-trait bg-accent-doux pl-3 pr-2 text-[13px] text-accent-fort transition-colors hover:border-accent"
                >
                  <span className="chiffres">{code}</span> — {d?.nom ?? code}
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-faible"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setOuvert(true);
            setActif(0);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOuvert(false);
              return;
            }
            if (!ouvert) {
              if (e.key === "ArrowDown") setOuvert(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActif((i) => Math.min(i + 1, visibles.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActif((i) => Math.max(i - 1, 0));
            } else if ((e.key === "Enter" || e.key === " ") && visibles[actif]) {
              e.preventDefault();
              basculer(visibles[actif].code);
            }
          }}
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={idListe}
          aria-autocomplete="list"
          aria-activedescendant={ouvert && visibles[actif] ? `${idListe}-${visibles[actif].code}` : undefined}
          aria-label="Chercher un département à ajouter"
          placeholder={
            selectionnes.length > 0 ? "Ajouter un département…" : "Chercher un département (nom ou numéro)…"
          }
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-trait bg-carte pl-10 pr-10 text-[14px] text-texte outline-none placeholder:text-texte-faible focus:border-accent-trait"
        />
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-label={ouvert ? "Fermer la liste des départements" : "Ouvrir la liste des départements"}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-texte-faible transition-colors hover:bg-doux hover:text-texte"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${ouvert ? "rotate-180" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {ouvert && (
        <ul
          id={idListe}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Départements"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-trait bg-carte py-1 shadow-flottante"
        >
          {visibles.length === 0 && (
            <li className="px-3.5 py-2.5 text-[13px] text-texte-faible">Aucun département ne correspond.</li>
          )}
          {visibles.map((d, i) => {
            const coche = selectionnes.includes(d.code);
            return (
              <li
                key={d.code}
                id={`${idListe}-${d.code}`}
                role="option"
                aria-selected={coche}
                className={i === actif ? "bg-doux" : ""}
              >
                <button
                  type="button"
                  // Garde le focus dans le champ : son « blur » ne doit pas
                  // fermer la liste avant que le clic n'arrive.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActif(i)}
                  onClick={() => basculer(d.code)}
                  className="flex h-10 w-full items-center gap-3 px-3.5 text-left text-[14px]"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${
                      coche ? "border-accent bg-accent text-carte" : "border-trait-fort bg-carte"
                    }`}
                  >
                    {coche && (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                        <path d="m2.5 6.5 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="chiffres w-7 shrink-0 text-texte-doux">{d.code}</span>
                  <span className="min-w-0 flex-1 truncate" title={d.nom}>
                    {d.nom}
                  </span>
                  <span className="chiffres shrink-0 text-[12px] text-texte-faible">{d.nbCommunes}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
