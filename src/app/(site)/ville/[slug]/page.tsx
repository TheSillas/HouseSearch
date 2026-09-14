import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ContenuFiche } from "@/components/ContenuFiche";
import { Etoile } from "@/components/Etoile";
import { getCommune, getCommunes, getReferentiel } from "@/lib/donnees";

// Rendue à la demande : pré-générer 34 746 fiches allongerait le build de
// plusieurs heures pour un contenu que le serveur produit en quelques
// millisecondes depuis le jeu départemental gardé en mémoire.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const commune = getCommune(slug);
  if (!commune) return { title: "Commune introuvable" };
  return {
    title: commune.nom,
    description: `Prix immobilier, sécurité, écoles, transports et historique électoral de ${commune.nom} : chiffres bruts issus de données publiques, avec leur source et leur millésime.`,
  };
}

/**
 * La fiche entière, à sa propre adresse : c'est elle qu'on reçoit en suivant
 * un lien partagé ou en rechargeant. Depuis la carte, la même adresse s'ouvre
 * dans un volet sans quitter la carte (voir (carte)/@detail).
 */
export default async function FicheVille({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const commune = getCommune(slug);
  if (!commune) notFound();

  // Les positions se lisent toujours par rapport au même jeu comparé : le
  // même référentiel que la page d'accueil, calculé une fois.
  const referentiel = getReferentiel();

  return (
    <div className="pb-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 py-2 text-[13px] text-texte-doux transition-colors hover:text-accent"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m10 3-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Retour au classement
      </Link>

      <header className="flex items-start justify-between gap-3 pt-2 pb-2">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">
          {commune.nom}
        </h1>
        <div className="mt-1.5 shrink-0">
          <Etoile
            commune={{ codeInsee: commune.codeInsee, slug: commune.slug, nom: commune.nom, departement: commune.departement }}
            taille="large"
          />
        </div>
      </header>

      <ContenuFiche
        commune={commune}
        referentiel={referentiel}
        nbCommunesComparees={getCommunes().length}
      />
    </div>
  );
}
