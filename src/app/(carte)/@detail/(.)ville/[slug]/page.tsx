import { ContenuFiche } from "@/components/ContenuFiche";
import { FicheFlottante } from "@/components/FicheFlottante";
import { getCommune, getCommunes, getReferentiel } from "@/lib/donnees";

/**
 * /ville/<slug> interceptée depuis la carte : la fiche s'ouvre dans un volet
 * qui prend la place du panneau, la carte reste visible et vole sur la
 * commune (voir Comparateur.tsx, qui lit l'adresse). Rendue à la demande,
 * jamais pré-générée : 5 000 fiches supplémentaires doubleraient la durée du
 * build pour un contenu identique à celui des pages déjà générées.
 */
export default async function DetailCommune({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const commune = getCommune(slug);
  if (!commune) return null;

  return (
    <FicheFlottante nom={commune.nom} slug={commune.slug} codeInsee={commune.codeInsee} departement={commune.departement}>
      <ContenuFiche
        commune={commune}
        referentiel={getReferentiel()}
        nbCommunesComparees={getCommunes().length}
        serre
      />
    </FicheFlottante>
  );
}
