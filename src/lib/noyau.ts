import { slugifier } from "./format";
import type { MesureMeta } from "./jeu-compact";
import type { Commune, CritereDonnees, CritereId, Mesure, Source } from "./types";

/**
 * Noyau national : ce dont le classement et la carte ont besoin pour toutes
 * les communes, en colonnes, écrit par `scripts/build-noyau.mjs`. Les libellés,
 * unités et formulations de chaque mesure n'y figurent qu'une fois ; une commune
 * n'y pèse que ses valeurs. Seules les mesures qui entrent dans le classement
 * ou qui sont mises en avant (une par critère) y sont — la fiche complète d'une
 * commune vient du jeu départemental (voir regions.ts).
 */
export interface Noyau {
  version: 1;
  genereLe: string;
  /** Empreinte du contenu, qui nomme l'URL de téléchargement (cache immuable). */
  empreinte: string;
  /** Ordre des critères dans le masque `criteresPresents`. */
  criteres: CritereId[];
  zones: { slug: string; zone: string; departement: string; nbCommunes: number; genereLe: string }[];
  /** Résumé des sources pour l'accueil : producteur et millésime par critère. */
  sources: { critere: CritereId; libelle: string; annee: string }[];
  /** Sources complètes par critère et sources électorales, pour la page de méthode. */
  sourcesDetail: { critere: CritereId; source: Source }[];
  sourcesElectorales: Source[];
  /** Colonnes de valeurs, dans cet ordre. */
  mesures: { critere: CritereId; meta: Omit<MesureMeta, "sourceRef"> }[];
  epcis: string[];
  communes: {
    codeInsee: string[];
    nom: string[];
    /** 0 quand le slug est simplement `slugifier(nom)` ; sinon le slug (homonymes suffixés du département). */
    slug: (string | 0)[];
    departement: string[];
    /** Index dans `epcis`, -1 sans EPCI. */
    epci: number[];
    population: number[];
    anneePopulation: number[];
    lat: (number | null)[];
    lon: (number | null)[];
    /** Bit k levé = le critère `criteres[k]` a des données pour cette commune. */
    criteresPresents: number[];
  };
  /** valeurs[indexMesure][indexCommune] */
  valeurs: (number | null)[][];
  /** indexMesure → indices de communes où la mesure est absente (pas seulement nulle). */
  absences: Record<string, number[]>;
  /** indexMesure → indexCommune → unité accordée, quand elle diffère du dictionnaire (« 1 établissement »). */
  unites: Record<string, Record<string, string>>;
}

/** Source de remplacement : l'accueil n'affiche aucune source par mesure. */
const SOURCE_OMISE: Source = { nom: "", producteur: "", url: "", annee: "" };

export function slugDuNoyau(noyau: Noyau, i: number): string {
  const s = noyau.communes.slug[i];
  return s === 0 ? slugifier(noyau.communes.nom[i]) : s;
}

/**
 * Reconstruit les communes telles que le classement les attend. Les positions
 * calculées sur ces communes sont identiques à celles des fiches : mêmes
 * valeurs, mêmes communes, même décompte de mesures par critère.
 */
export function communesDepuisNoyau(noyau: Noyau): Commune[] {
  // Un même noyau (même objet) donne toujours les mêmes communes : côté serveur,
  // le noyau est chargé une fois par processus et chaque requête réutilise le
  // résultat au lieu de reconstruire 34 746 communes ; côté client, une fois.
  const memo = MEMO_COMMUNES.get(noyau);
  if (memo) return memo;
  const communes = construireCommunes(noyau);
  MEMO_COMMUNES.set(noyau, communes);
  return communes;
}

const MEMO_COMMUNES = new WeakMap<Noyau, Commune[]>();

function construireCommunes(noyau: Noyau): Commune[] {
  const n = noyau.communes.codeInsee.length;
  const parCritere = new Map<CritereId, number[]>();
  noyau.mesures.forEach((m, j) => {
    (parCritere.get(m.critere) ?? parCritere.set(m.critere, []).get(m.critere)!).push(j);
  });
  const absences = new Map<number, Set<number>>();
  for (const [j, indices] of Object.entries(noyau.absences)) absences.set(Number(j), new Set(indices));

  const communes: Commune[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const criteres: Partial<Record<CritereId, CritereDonnees>> = {};
    const presents = noyau.communes.criteresPresents[i];
    noyau.criteres.forEach((id, k) => {
      if (!(presents & (1 << k))) return;
      const mesures: Mesure[] = [];
      for (const j of parCritere.get(id) ?? []) {
        if (absences.get(j)?.has(i)) continue;
        const m: Mesure = { ...noyau.mesures[j].meta, valeur: noyau.valeurs[j][i] ?? null };
        const unite = noyau.unites[String(j)]?.[String(i)];
        if (unite !== undefined) m.unite = unite;
        mesures.push(m);
      }
      criteres[id] = { mesures, source: SOURCE_OMISE, methodologie: "", caveats: [] };
    });
    const commune: Commune = {
      codeInsee: noyau.communes.codeInsee[i],
      slug: slugDuNoyau(noyau, i),
      nom: noyau.communes.nom[i],
      population: noyau.communes.population[i],
      anneePopulation: noyau.communes.anneePopulation[i],
      departement: noyau.communes.departement[i],
      criteres,
      politique: { scrutins: [] },
    };
    const epci = noyau.communes.epci[i];
    if (epci >= 0) commune.epci = noyau.epcis[epci];
    const lat = noyau.communes.lat[i];
    const lon = noyau.communes.lon[i];
    if (lat !== null && lon !== null) {
      commune.lat = lat;
      commune.lon = lon;
    }
    communes[i] = commune;
  }
  return communes;
}
