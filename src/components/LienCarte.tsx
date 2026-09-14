"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Un lien interne qui garde les réglages.
 *
 * Les priorités, le repère, les filtres et la couverture vivent dans la requête
 * de l'adresse (voir Comparateur.ecrireUrl). Un lien écrit en dur ramenait donc
 * bien à la carte, mais au classement par défaut : le réglage que l'utilisateur
 * venait de composer était perdu dès qu'il ouvrait une fiche, passait par les
 * sources, puis revenait. On rebâtit la destination avec la requête courante —
 * celle que la page a reçue, puisque les liens de commune la transportent.
 *
 * `useSearchParams` suspend au rendu statique : l'enveloppe Suspense laisse
 * `/methodologie` se pré-rendre, avec le lien nu le temps de l'hydratation — la
 * destination est la bonne dans tous les cas, seuls les réglages arrivent avec
 * le composant.
 */
function LienAvecReglages({
  vers,
  className,
  children,
}: {
  vers: string;
  className?: string;
  children: React.ReactNode;
}) {
  const parametres = useSearchParams().toString();
  return (
    <Link href={parametres ? `${vers}?${parametres}` : vers} className={className}>
      {children}
    </Link>
  );
}

export function LienCarte({
  vers = "/",
  className,
  children,
}: {
  /** Destination sans requête ; la carte par défaut. */
  vers?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <Link href={vers} className={className}>
          {children}
        </Link>
      }
    >
      <LienAvecReglages vers={vers} className={className}>
        {children}
      </LienAvecReglages>
    </Suspense>
  );
}
