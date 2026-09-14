"use client";

import { useId, useMemo, useState } from "react";

import { nomDepartement } from "@/lib/departements";
import { slugifier } from "@/lib/format";
import type { Commune } from "@/lib/types";

const MAX_RESULTATS = 8;

/**
 * Trouver une commune par son nom, depuis la carte : accents et traits
 * d'union ignorés (même normalisation que les adresses des fiches), les noms
 * qui commencent par la saisie passent avant ceux qui la contiennent. Choisir
 * un résultat fait voler la carte dessus — la recherche ne filtre pas le
 * classement, elle situe.
 */
export function RechercheCommune({
  communes,
  onChoisir,
  placeholder = "Trouver une commune…",
  compact = false,
}: {
  communes: Commune[];
  onChoisir: (codeInsee: string) => void;
  placeholder?: string;
  /** Champ plus bas et sans ombre, pour vivre dans le panneau plutôt que sur la carte. */
  compact?: boolean;
}) {
  const idListe = useId();
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);

  const index = useMemo(
    () => communes.map((commune) => ({ commune, cle: slugifier(commune.nom) })),
    [communes],
  );
  const requete = slugifier(texte);
  const resultats = useMemo(() => {
    if (requete.length < 2) return [];
    const commencent: Commune[] = [];
    const contiennent: Commune[] = [];
    for (const entree of index) {
      if (entree.cle.startsWith(requete)) {
        commencent.push(entree.commune);
        if (commencent.length >= MAX_RESULTATS) break;
      } else if (contiennent.length < MAX_RESULTATS && entree.cle.includes(requete)) {
        contiennent.push(entree.commune);
      }
    }
    return [...commencent, ...contiennent].slice(0, MAX_RESULTATS);
  }, [index, requete]);

  const visible = ouvert && resultats.length > 0;

  const choisir = (commune: Commune) => {
    onChoisir(commune.codeInsee);
    setTexte(commune.nom);
    setOuvert(false);
  };

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-texte-faible"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setOuvert(true);
          setActif(0);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActif((i) => Math.min(i + 1, resultats.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActif((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choisir(resultats[actif]);
          } else if (e.key === "Escape") {
            setOuvert(false);
          }
        }}
        role="combobox"
        aria-expanded={visible}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={visible ? `${idListe}-${actif}` : undefined}
        aria-label={placeholder.replace(/…$/, "")}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full rounded-full border border-trait bg-carte/95 pl-10 pr-4 text-texte backdrop-blur outline-none placeholder:text-texte-faible focus:border-accent-trait ${
          compact ? "h-9 text-[13px]" : "h-11 text-[14px] shadow-flottante"
        }`}
      />
      {visible && (
        <ul
          id={idListe}
          role="listbox"
          // En version compacte (case de la grille des curseurs), le champ est
          // étroit : la liste s'ancre à droite et prend sa propre largeur pour
          // que le nom de la commune reste lisible, sans déborder du panneau.
          className={`absolute top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-trait bg-carte shadow-flottante ${
            compact ? "right-0 w-[min(300px,calc(100vw-2.5rem))]" : "left-0 right-0"
          }`}
        >
          {resultats.map((commune, i) => (
            <li key={commune.codeInsee} id={`${idListe}-${i}`} role="option" aria-selected={i === actif}>
              <button
                type="button"
                // Garde le focus dans le champ : sinon son « blur » referme la
                // liste avant que le clic n'arrive.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActif(i)}
                onClick={() => choisir(commune)}
                className={`flex w-full items-baseline justify-between gap-3 px-3.5 py-2.5 text-left text-[14px] transition-colors ${
                  i === actif ? "bg-doux text-texte" : "text-texte-doux"
                }`}
              >
                <span className="min-w-0 truncate" title={commune.nom}>
                  {commune.nom}
                </span>
                <span className="min-w-0 shrink truncate text-[12px] text-texte-faible" title={nomDepartement(commune.departement)}>
                  {nomDepartement(commune.departement)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
