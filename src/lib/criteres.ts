import type { CritereId, CritereMeta } from "./types";

/**
 * Les quatre critères réglables du MVP. L'ordre est celui des curseurs.
 *
 * `description` doit dire ce que le curseur règle *réellement*, c'est-à-dire
 * quelles mesures brutes entrent dans la position du critère — pas une promesse
 * vague.
 */
export const CRITERES: CritereMeta[] = [
  {
    id: "immobilier",
    libelle: "Prix immobilier",
    libelleCourt: "Immobilier",
    libelleCurseur: "Prix de l'immobilier",
    question: "Le budget logement compte-t-il pour vous ?",
    description: "Position calculée sur le prix médian au m² des appartements et des maisons.",
  },
  {
    id: "securite",
    libelle: "Sécurité",
    question: "La tranquillité du quartier compte-t-elle pour vous ?",
    description:
      "Position calculée sur quatre indicateurs publiés : violences hors cadre familial, vols sans violence, cambriolages, dégradations.",
  },
  {
    id: "ecoles",
    libelle: "Écoles",
    question: "L'offre scolaire compte-t-elle pour vous ?",
    description: "Position calculée sur la densité d'établissements et le taux de réussite au brevet.",
  },
  {
    id: "transports",
    libelle: "Transports",
    question: "Les déplacements comptent-ils pour vous ?",
    description: "Position calculée sur la distance à la gare la plus proche.",
  },
  {
    id: "emploi",
    libelle: "Emploi & revenus",
    libelleCourt: "Emploi",
    question: "Le dynamisme économique du lieu compte-t-il pour vous ?",
    description:
      "Position calculée sur le taux de chômage au sens du recensement, le niveau de vie médian et le taux de pauvreté (INSEE).",
  },
  {
    id: "sante",
    libelle: "Santé",
    question: "L'accès aux soins compte-t-il pour vous ?",
    description:
      "Position calculée sur l'accessibilité aux médecins généralistes (APL, DREES), qui tient compte des communes voisines.",
  },
  {
    id: "quotidien",
    libelle: "Commerces & services",
    libelleCourt: "Services",
    question: "Avoir commerces et services sur place compte-t-il pour vous ?",
    description:
      "Position calculée sur le nombre de types de commerces et services de proximité présents dans la commune (boulangerie, épicerie, poste, coiffeur, restaurant, terrain de sport, bibliothèque…), selon la gamme de proximité de l'INSEE, hors santé, enseignement et transports qui ont leurs propres critères.",
  },
  {
    id: "fiscalite",
    libelle: "Fiscalité locale",
    libelleCourt: "Fiscalité",
    curseur: false,
    question: "Le poids de la taxe foncière compte-t-il pour vous ?",
    description:
      "Position calculée sur le taux global de taxe foncière sur les propriétés bâties appliqué dans la commune (DGFiP, REI), commune et intercommunalité comprises.",
  },
  {
    id: "proximite",
    libelle: "Proximité",
    libelleCourt: "Proximité",
    avance: true,
    question: "Rester près d'un lieu qui compte pour vous ?",
    description:
      "Position calculée sur la distance à vol d'oiseau entre le centre de la commune et votre repère (votre travail, votre famille…). Sans repère, ce curseur ne compte pas.",
  },
  {
    id: "risques",
    libelle: "Risques naturels",
    libelleCourt: "Risques",
    curseur: false,
    question: "Éviter les communes souvent touchées par des catastrophes naturelles ?",
    description:
      "Position calculée sur le nombre de reconnaissances de l'état de catastrophe naturelle depuis 1982 (inondations, sécheresse, tempêtes… ; Géorisques, base GASPAR). Zone sismique, radon et plans de prévention sont donnés à titre d'information.",
  },
  {
    id: "climat",
    libelle: "Climat",
    libelleCourt: "Climat",
    question: "Le soleil compte-t-il pour vous ?",
    description:
      "Position calculée sur la durée annuelle d'insolation de la station Météo-France la plus proche (normale 1991-2020). Précipitations, températures, jours chauds et jours de gelée sont donnés à titre d'information.",
  },
];

export const CRITERE_PAR_ID: Record<CritereId, CritereMeta> = Object.fromEntries(
  CRITERES.map((c) => [c.id, c]),
) as Record<CritereId, CritereMeta>;

export const IDS_CRITERES = CRITERES.map((c) => c.id);

/** Poids par défaut : tous les critères comptent également. */
// Proximité part à zéro : elle n'a de sens qu'une fois un repère choisi.
/** Les critères qui pèsent dans le classement : ils ont un curseur (priorités ou filtres avancés). */
export const CRITERES_CLASSANTS: CritereMeta[] = CRITERES.filter((c) => c.curseur !== false);
/** Les curseurs du panneau « Vos priorités » ; Proximité vit dans les filtres avancés. */
export const CRITERES_PRIORITES: CritereMeta[] = CRITERES_CLASSANTS.filter((c) => !c.avance);

/**
 * Poids par défaut : tous à zéro. À l'ouverture, aucune priorité n'est réglée à
 * la place de l'utilisateur : la carte est neutre, toutes les communes sont
 * comparées, et c'est en montant un curseur qu'on choisit ce qui compte. Un
 * réglage par défaut à « Important » classait d'emblée sur des critères que
 * l'utilisateur n'avait pas choisis et écartait les communes sans donnée sur eux.
 */
export const POIDS_PAR_DEFAUT: Record<CritereId, number> = Object.fromEntries(
  CRITERES.map((c) => [c.id, 0]),
) as Record<CritereId, number>;

export const POIDS_MIN = 0;
export const POIDS_MAX = 100;

/** Libellé du niveau de priorité, pour rendre le curseur lisible sans chiffre. */
export function libellePoids(poids: number): string {
  if (poids <= 0) return "Ignorer";
  if (poids < 25) return "Accessoire";
  if (poids < 50) return "Utile";
  if (poids < 75) return "Important";
  if (poids < 100) return "Très important";
  return "Décisif";
}
