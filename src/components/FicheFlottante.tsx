"use client";

import { Etoile } from "./Etoile";
import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PhotosCommune } from "./PhotosCommune";

/**
 * Le volet d'une commune ouverte depuis la carte : il prend la place du
 * panneau de gauche (la carte reste entièrement visible et vole sur la
 * commune) ; sur téléphone, il occupe tout l'écran.
 *
 * Fermer ramène au classement, pas à l'écran précédent. `router.back()` le
 * faisait tant qu'on n'avait ouvert qu'une commune ; en enchaînant d'une fiche
 * à l'autre — par la recherche ou par un point de la carte — il remontait la
 * chaîne fiche par fiche au lieu de rendre la main à la liste. On va donc à
 * l'adresse de la carte, avec les réglages que la fiche a reçus en s'ouvrant.
 * Le bouton retour du navigateur, lui, garde son rôle propre : défaire le
 * dernier pas.
 *
 * D'où le garde sur l'adresse : une navigation douce vers une route qui
 * n'apparie plus cet emplacement parallèle y laisse la sous-page active telle
 * quelle — `default.tsx` n'est rendu qu'au chargement complet. Sans ce test, le
 * volet restait affiché par-dessus la carte alors que l'adresse était déjà
 * revenue au classement. C'est l'adresse qui dit quelle commune est ouverte,
 * ici comme dans Comparateur.
 *
 * Le contenu (`children`) est un composant serveur : le volet n'en sait rien,
 * il ne fait que l'encadrer et le faire défiler.
 */
export function FicheFlottante({
  nom,
  slug,
  codeInsee,
  departement,
  children,
}: {
  nom: string;
  slug: string;
  codeInsee: string;
  departement: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametres = useSearchParams().toString();
  const adresseCarte = parametres ? `/?${parametres}` : "/";
  const corpsRef = useRef<HTMLDivElement>(null);

  // `scroll: false` : la carte occupe déjà l'écran, rien à faire remonter.
  const fermer = useCallback(() => {
    router.push(adresseCarte, { scroll: false });
  }, [router, adresseCarte]);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [fermer]);

  // Une autre commune ouverte depuis la carte remplace le contenu : on
  // repart du haut plutôt que de rester au milieu de la fiche précédente.
  useEffect(() => {
    corpsRef.current?.scrollTo({ top: 0 });
  }, [slug]);

  // Après tous les hooks : leur nombre ne doit pas dépendre de l'affichage.
  if (!pathname.startsWith("/ville/")) return null;

  return (
    <section
      aria-label={`Fiche de ${nom}`}
      className="fixed inset-y-0 left-0 z-30 flex w-full flex-col border-r border-trait bg-carte shadow-flottante lg:w-[400px] xl:w-[440px]"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-trait px-3 py-2.5">
        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer la fiche et revenir au classement"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-texte-doux transition-colors hover:bg-doux hover:text-texte"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m10 3-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-texte-faible">
            Fiche commune
          </p>
          <h2 className="truncate text-[18px] font-semibold leading-tight tracking-tight" title={nom}>
            {nom}
          </h2>
        </div>
        <Etoile commune={{ codeInsee, slug, nom, departement }} />
        {/* Un vrai lien, pas une navigation douce : la même adresse, chargée
            entière, donne la page complète hors de la carte. */}
        <a
          href={`/ville/${slug}${parametres ? `?${parametres}` : ""}`}
          className="shrink-0 rounded-full border border-trait px-3 py-2 text-[12px] text-texte-doux transition-colors hover:border-trait-fort hover:text-texte"
        >
          Page entière
        </a>
      </header>

      <div ref={corpsRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {/* Sur téléphone le volet couvre la carte : les photos, qui y vivent
            d'ordinaire (voir Comparateur.tsx), sont reprises ici. */}
        <div className="mb-3 lg:hidden">
          <PhotosCommune codeInsee={codeInsee} nom={nom} />
        </div>
        {children}
      </div>
    </section>
  );
}
