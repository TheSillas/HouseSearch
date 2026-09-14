/**
 * Modèle de domaine normalisé.
 *
 * Principe directeur du produit : on n'affiche jamais une note. On affiche un
 * chiffre brut, son unité, sa source et son millésime — et, pour situer la
 * commune, sa position relative dans le jeu de villes comparées.
 */

export type CritereId =
  | "immobilier"
  | "securite"
  | "ecoles"
  | "transports"
  | "emploi"
  | "sante"
  | "quotidien"
  | "fiscalite"
  | "proximite"
  | "risques"
  | "climat";

/**
 * Portrait démographique d'une commune (recensement INSEE) : contexte de la
 * fiche, jamais un critère de classement. Les populations 2011 et 2016 sont
 * dans la géographie 2025, comparables à celle de 2022.
 */
export interface Demographie {
  population2022: number | null;
  population2016: number | null;
  population2011: number | null;
  /** Effectifs par tranche d'âge INSEE, dans l'ordre de publication. */
  ages: { tranche: string; effectif: number | null }[];
  source: Source;
}

/** Sens de lecture d'une mesure : une valeur basse est-elle préférable ? */
export type Sens = "bas" | "haut";

/** Un point de la série historique d'une mesure : une valeur réellement publiée pour cette année. */
export interface PointHistorique {
  annee: number;
  /** Absente plutôt que comblée : un secret statistique ou un trou de couverture reste `null`. */
  valeur: number | null;
}

export interface Source {
  nom: string;
  /** Forme courte pour les lignes serrées de la fiche ("Filosofi 2023"). */
  nomCourt?: string;
  producteur: string;
  url: string;
  /** Millésime de la donnée, tel que publié ("2024", "2023-2024"…). */
  annee: string;
  licence?: string;
  consulteLe?: string;
}

/**
 * Une mesure = un chiffre brut affichable.
 *
 * `classante: true` signifie qu'elle entre dans le calcul de position du
 * critère. Un critère peut en avoir plusieurs : la position du critère est
 * alors la moyenne des positions de ses mesures classantes, et l'interface
 * l'annonce explicitement (pas de composite caché).
 */
export interface Mesure {
  id: string;
  libelle: string;
  /** Libellé condensé, pour la grille serrée du classement. */
  libelleCourt?: string;
  valeur: number | null;
  unite: string;
  sens: Sens;
  classante: boolean;
  /** Mesure mise en avant dans la ligne de classement (une seule par critère). */
  vedette?: boolean;
  /**
   * Faux quand la mesure n'a pas de direction favorable : une hausse de prix
   * n'est ni bonne ni mauvaise en soi. On affiche alors le chiffre nu, sans
   * barre de position ni phrase comparative.
   */
  comparable?: boolean;
  /** Affiche explicitement le signe, pour une variation. */
  signe?: boolean;
  /** Nombre de décimales à l'affichage. */
  decimales?: number;
  /** Précision affichée sous le chiffre : "sur 412 transactions". */
  precision?: string;
  /**
   * Décomposition du chiffre en postes nommés ("89 cardiologues", "45 radiologues"),
   * par effectif décroissant, zéros omis. Rendue en liste compacte, jamais en phrase.
   */
  repartition?: { libelle: string; effectif: number }[];
  /** Pourquoi la valeur est absente. */
  statut?: "secret_statistique" | "seuil_diffusion" | "indisponible" | "echantillon_insuffisant" | "sans_objet";
  /** Renseigné uniquement si la donnée n'est pas de maille communale. */
  maille?: string;
  /** Source propre à cette mesure, quand elle diffère de celle du critère (ex. loyers à côté des prix DVF). */
  source?: Source;
  /** Formulations comparatives, ex. { mieux: "moins cher que", pire: "plus cher que" }. */
  comparatif: { mieux: string; pire: string };
  /**
   * Série chronologique réelle, triée par année croissante. Absente quand aucun
   * historique fiable n'existe pour cette mesure — jamais complétée par une
   * extrapolation. Au moins trois points renseignés pour qu'une courbe ait un sens.
   */
  historique?: PointHistorique[];
}

export interface CritereDonnees {
  mesures: Mesure[];
  source: Source;
  /** Comment le chiffre est construit, en une phrase honnête. */
  methodologie: string;
  /** Limites méthodologiques à afficher à l'utilisateur. */
  caveats: string[];
}

export interface ResultatScrutin {
  /** Libellé de la liste ou du candidat, tel que publié. */
  libelle: string;
  /** Code de nuance officiel du ministère de l'Intérieur, repris tel quel. */
  nuance?: string;
  nuanceLibelle?: string;
  pourcentage: number;
  voix?: number;
  /** Précision factuelle affichée sous le libellé, ex. « Tête de liste : … ». */
  precision?: string;
}

export interface Scrutin {
  id: string;
  nom: string;
  /** ISO 8601. */
  date: string;
  tour?: string;
  /** En pourcentage des inscrits. */
  participation: number | null;
  inscrits?: number | null;
  resultats: ResultatScrutin[];
  source: Source;
  /** Ex. « agrégé des 9 arrondissements ». */
  note?: string;
}

export interface Elu {
  nom: string;
  nuance?: string;
  nuanceLibelle?: string;
  depuis?: string;
  source: Source;
}

export interface Commune {
  codeInsee: string;
  slug: string;
  nom: string;
  population: number;
  anneePopulation: number;
  departement: string;
  epci?: string;
  codesPostaux?: string[];
  lat?: number;
  lon?: number;
  surfaceKm2?: number;
  /** Fusion de communes, arrondissements, changement de code… */
  note?: string;
  /**
   * Un critère absent n'a aucune extraction pour cette commune (ex. prix DVF
   * non encore importés hors des communes de 2 000 habitants) : l'application
   * l'affiche comme tel, il ne compte ni dans le classement ni dans la couverture.
   */
  criteres: Partial<Record<CritereId, CritereDonnees>>;
  demographie?: Demographie;
  politique: {
    maire?: Elu;
    scrutins: Scrutin[];
  };
}

export interface JeuDeDonnees {
  /** Zone couverte, affichée à l'utilisateur. */
  zone: string;
  genereLe: string;
  communes: Commune[];
}

/** Métadonnées d'affichage d'un critère, indépendantes des données. */
export interface CritereMeta {
  id: CritereId;
  libelle: string;
  /** Libellé condensé, pour les colonnes serrées du panneau de résultats. */
  libelleCourt?: string;
  /** Libellé du curseur de priorité quand ni le libellé complet ni le court ne conviennent. */
  libelleCurseur?: string;
  /** Une ligne, dit ce que le curseur règle réellement. */
  description: string;
  /** Question posée à l'utilisateur au-dessus du curseur. */
  question: string;
  /**
   * Faux pour un critère consultable sur la fiche mais qui ne pèse jamais dans
   * le classement : aucun curseur, aucune plage, poids toujours nul.
   */
  curseur?: false;
  /** Vrai quand le curseur vit dans les filtres avancés plutôt que dans les priorités. */
  avance?: true;
}
