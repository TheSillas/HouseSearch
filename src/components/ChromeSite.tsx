import Link from "next/link";

import { BandeauSelection } from "./BandeauSelection";

/**
 * Habillage des pages à lire (fiches, méthode) : colonne de lecture, en-tête
 * de marque et pied de page rappelant l'origine des chiffres. La page
 * d'accueil ne l'utilise pas — c'est une application plein écran dont le
 * panneau latéral joue ce rôle (voir Comparateur.tsx).
 */
export function ChromeSite({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <div className={`mx-auto flex min-h-dvh flex-col px-5 sm:px-7 ${large ? "max-w-[1800px]" : "max-w-3xl"}`}>
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="text-[17px] font-semibold tracking-tight">Où Vivre</span>
          <span className="hidden text-[13px] text-texte-faible sm:inline">
            comparateur sur données publiques
          </span>
        </Link>
        <Link
          href="/methodologie"
          className="rounded-full border border-trait px-3 py-1.5 text-[13px] text-texte-doux transition-colors hover:border-trait-fort hover:text-texte"
        >
          Sources
        </Link>
      </header>

      <main id="contenu" className="flex-1">
        {children}
      </main>

      {/* La sélection suit l'utilisateur sur les fiches et la comparaison. */}
      <BandeauSelection variante="page" />

      <footer className="mt-16 border-t border-trait py-7 text-[13px] leading-relaxed text-texte-faible">
        <p>
          Toutes les valeurs affichées proviennent de jeux de données publics, citées avec leur
          producteur et leur millésime.{" "}
          <Link href="/methodologie" className="text-accent underline underline-offset-2">
            Voir les sources et la méthode
          </Link>
          .
        </p>
        <p className="mt-2">
          Ce comparateur ne note pas les villes : il indique la position de chacune par rapport aux
          autres, selon les priorités que vous réglez.
        </p>
      </footer>
    </div>
  );
}
