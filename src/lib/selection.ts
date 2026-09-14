/**
 * « Ma sélection » : les communes que l'utilisateur retient, d'une étoile,
 * depuis le classement, une fiche ou la carte. Une seule liste, deux états par
 * commune : gardée (toujours), et « dans la comparaison » ou non. La page de
 * comparaison ne montre que les communes cochées ; les autres restent à portée
 * de clic dans le bandeau.
 *
 * La liste vit dans le navigateur (localStorage, voir useSelection.ts) : c'est
 * une liste de travail personnelle, pas un réglage à partager. Ce qui se
 * partage, c'est l'adresse de la comparaison, qui ne porte que les communes
 * cochées (voir comparaison.ts).
 */
export interface CommuneSelection {
  codeInsee: string;
  slug: string;
  nom: string;
  departement: string;
  /** Vraie quand la commune fait partie de la vue de comparaison. */
  comparee: boolean;
}

export type Selection = CommuneSelection[];

export const CLE_SELECTION = "ou-vivre:selection";
/** Communes cochées au plus : au-delà, un tableau côte à côte ne se lit plus. */
export const MAX_COMPAREES = 6;

export type CommuneReperable = Pick<CommuneSelection, "codeInsee" | "slug" | "nom" | "departement">;

export function comparees(selection: Selection): CommuneSelection[] {
  return selection.filter((c) => c.comparee);
}

export function estSelectionnee(selection: Selection, codeInsee: string): boolean {
  return selection.some((c) => c.codeInsee === codeInsee);
}

/**
 * Étoile : ajoute la commune (cochée d'emblée s'il reste de la place dans la
 * comparaison, pour que le geste simple reste « étoiler puis comparer »), ou la
 * retire si elle y était.
 */
export function basculer(selection: Selection, commune: CommuneReperable): Selection {
  if (estSelectionnee(selection, commune.codeInsee)) return selection.filter((c) => c.codeInsee !== commune.codeInsee);
  return [
    ...selection,
    {
      codeInsee: commune.codeInsee,
      slug: commune.slug,
      nom: commune.nom,
      departement: commune.departement,
      comparee: comparees(selection).length < MAX_COMPAREES,
    },
  ];
}

export function retirer(selection: Selection, codeInsee: string): Selection {
  return selection.filter((c) => c.codeInsee !== codeInsee);
}

/** Coche ou décoche « dans la comparaison » ; cocher au-delà du plafond ne fait rien. */
export function basculerComparaison(selection: Selection, codeInsee: string): Selection {
  const cible = selection.find((c) => c.codeInsee === codeInsee);
  if (!cible) return selection;
  if (!cible.comparee && comparees(selection).length >= MAX_COMPAREES) return selection;
  return selection.map((c) => (c.codeInsee === codeInsee ? { ...c, comparee: !c.comparee } : c));
}

/**
 * Aligne la comparaison sur une liste de communes (celles d'une adresse
 * `/comparer?communes=…`) : elles sont ajoutées à la sélection si besoin et
 * cochées, dans cet ordre et jusqu'au plafond ; toutes les autres sont
 * décochées mais gardées.
 */
export function alignerComparaison(selection: Selection, communes: CommuneReperable[]): Selection {
  const cibles = communes.slice(0, MAX_COMPAREES);
  const codes = new Set(cibles.map((c) => c.codeInsee));
  const gardees = selection.map((c) => ({ ...c, comparee: codes.has(c.codeInsee) }));
  const nouvelles = cibles
    .filter((c) => !estSelectionnee(selection, c.codeInsee))
    .map((c) => ({ codeInsee: c.codeInsee, slug: c.slug, nom: c.nom, departement: c.departement, comparee: true }));
  return [...gardees, ...nouvelles];
}

/** Relit ce que le navigateur a gardé ; tout ce qui n'a pas la forme attendue est ignoré. */
export function lireSelection(brut: string | null | undefined): Selection {
  if (!brut) return [];
  try {
    const valeur: unknown = JSON.parse(brut);
    if (!Array.isArray(valeur)) return [];
    const vus = new Set<string>();
    const propres: Selection = [];
    for (const e of valeur) {
      if (typeof e !== "object" || e === null) continue;
      const { codeInsee, slug, nom, departement, comparee } = e as Record<string, unknown>;
      if (typeof codeInsee !== "string" || typeof slug !== "string" || typeof nom !== "string") continue;
      if (vus.has(codeInsee)) continue;
      vus.add(codeInsee);
      propres.push({
        codeInsee,
        slug,
        nom,
        departement: typeof departement === "string" ? departement : codeInsee.slice(0, 2),
        comparee: comparee === true,
      });
    }
    // Le plafond vaut aussi pour ce qui revient du stockage.
    let cochees = 0;
    return propres.map((c) => (c.comparee && ++cochees > MAX_COMPAREES ? { ...c, comparee: false } : c));
  } catch {
    return [];
  }
}
