import Link from "next/link";
import type { Metadata } from "next";

import { AjouterCommune } from "@/components/AjouterCommune";
import { SynchroniserComparaison } from "@/components/SynchroniserComparaison";
import { TableauComparaison } from "@/components/TableauComparaison";
import { decoderSlugs, lienComparaison, MIN_COMPARAISON, PARAM_COMPARAISON } from "@/lib/comparaison";
import { getCommune, getCommunes, getNoyau, getReferentiel } from "@/lib/donnees";
import type { PositionsParMesure } from "@/lib/scoring";
import type { Commune } from "@/lib/types";

// Rendue à la demande : la combinaison de communes vient de l'adresse.
export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;

function communesDemandees(params: Record<string, string | string[] | undefined>) {
  const slugs = decoderSlugs(params[PARAM_COMPARAISON]);
  const trouvees: Commune[] = [];
  const introuvables: string[] = [];
  for (const slug of slugs) {
    const commune = getCommune(slug);
    if (commune) trouvees.push(commune);
    else introuvables.push(slug);
  }
  return { trouvees, introuvables };
}

/** Les positions des seules communes comparées : le tableau est un composant client, il ne reçoit pas le référentiel entier. */
function positionsDe(communes: Commune[]): Record<string, PositionsParMesure> {
  const referentiel = getReferentiel();
  return Object.fromEntries(communes.map((c) => [c.codeInsee, referentiel.positions[c.codeInsee] ?? {}]));
}

export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  const { trouvees } = communesDemandees(await searchParams);
  const noms = trouvees.map((c) => c.nom);
  return {
    title: noms.length >= MIN_COMPARAISON ? `Comparer ${noms.join(", ")}` : "Comparer des communes",
    description:
      noms.length >= MIN_COMPARAISON
        ? `${noms.join(", ")} côte à côte : prix, sécurité, écoles, transports, emploi, santé, services, fiscalité et risques, chiffres bruts sourcés.`
        : "Mettre deux à six communes côte à côte, mesure par mesure, à partir de données publiques sourcées.",
  };
}

/**
 * /comparer?communes=a,b,c : les communes désignées côte à côte, mesure par
 * mesure, avec les mêmes positions que sur leurs fiches. L'adresse est la
 * photographie partageable ; sur la page, le bandeau de sélection la pilote
 * (voir SynchroniserComparaison).
 */
export default async function Comparer({ searchParams }: { searchParams: Params }) {
  const { trouvees, introuvables } = communesDemandees(await searchParams);
  const noyauUrl = `/donnees/noyau/${getNoyau().empreinte}`;
  const slugs = trouvees.map((c) => c.slug);

  return (
    <div className="pb-4">
      <SynchroniserComparaison
        communes={trouvees.map((c) => ({ codeInsee: c.codeInsee, slug: c.slug, nom: c.nom, departement: c.departement }))}
      />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 py-2 text-[13px] text-texte-doux transition-colors hover:text-accent"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m10 3-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Retour au classement
      </Link>

      <header className="pt-2 pb-4">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">
          Comparer des communes
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-texte-doux">
          Les communes cochées dans votre sélection, côte à côte, mesure par mesure : le chiffre
          brut de chacune, sa source, et sa position parmi toutes les communes du comparateur.
          Étoilez une commune depuis le classement ou sa fiche pour l&apos;ajouter à la sélection.
        </p>
      </header>

      {introuvables.length > 0 && (
        <p className="mb-4 rounded-lg border border-trait bg-doux px-3.5 py-2.5 text-[13px] text-texte-doux" role="status">
          Commune{introuvables.length > 1 ? "s" : ""} introuvable{introuvables.length > 1 ? "s" : ""} :{" "}
          {introuvables.join(", ")}.
        </p>
      )}

      {trouvees.length >= MIN_COMPARAISON ? (
        <TableauComparaison communes={trouvees} positions={positionsDe(trouvees)} nbCommunesComparees={getCommunes().length} />
      ) : (
        trouvees.length === 1 && (
          <p className="text-[14px] text-texte-doux">
            <Link href={`/ville/${trouvees[0].slug}`} className="font-medium text-texte hover:text-accent">
              {trouvees[0].nom}
            </Link>{" "}
            attend une commune à comparer.
          </p>
        )
      )}

      <section aria-labelledby="titre-ajouter" className="mt-6 max-w-md">
        <h2 id="titre-ajouter" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
          {trouvees.length === 0 ? "Choisir une première commune" : "Ajouter une commune"}
        </h2>
        <div className="mt-2">
          <AjouterCommune noyauUrl={noyauUrl} slugs={slugs} />
        </div>
        {trouvees.length >= MIN_COMPARAISON && (
          <p className="mt-2 text-[12.5px] text-texte-faible">
            Lien de cette comparaison :{" "}
            <Link href={lienComparaison(slugs)} className="chiffres underline underline-offset-2 hover:text-accent">
              {lienComparaison(slugs)}
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
