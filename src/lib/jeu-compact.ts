import type { Commune, CritereDonnees, CritereId, Mesure, Source } from "./types";

/**
 * Format compact (version 2) d'un jeu départemental, tel qu'écrit sur disque
 * par `scripts/build-dataset.mjs`. Les métadonnées de chaque mesure et les
 * textes de chaque critère sont écrits une fois ; chaque commune ne porte que
 * ses valeurs, alignées sur le dictionnaire, et ses particularités.
 *
 * `dilater` est le miroir exact de `scripts/lib/jeu-compact.mjs` — vérifié par
 * `artefact.test.ts`.
 */
export type MesureMeta = Omit<Mesure, "valeur" | "precision" | "statut" | "maille" | "historique" | "source"> & {
  sourceRef?: number;
};

export interface CritereCompact {
  source: Source;
  methodologie: string;
  caveats: string[];
  mesures: MesureMeta[];
}

export interface EntreeCritereCompacte {
  /** Valeurs alignées sur `mesures` du dictionnaire ; null = inconnue ou absente. */
  v: (number | null)[];
  /** Indices des mesures que cette commune n'a pas du tout (pas seulement nulles). */
  absentes?: number[];
  /** Particularités par indice de mesure : précision, statut, maille, historique, métadonnée divergente. */
  x?: Record<string, Record<string, unknown>>;
  /** Source ou méthode propre à cette commune, quand elle diffère du dictionnaire. */
  t?: { source?: Source; methodologie?: string; caveats?: string[] };
}

export type CommuneCompacte = Omit<Commune, "criteres"> & {
  criteres: Partial<Record<CritereId, EntreeCritereCompacte>>;
};

export interface JeuCompact {
  version: 2;
  zone: string;
  departement?: string;
  genereLe: string;
  criteres: Partial<Record<CritereId, CritereCompact>>;
  sources: Source[];
  communes: CommuneCompacte[];
}

export function dilater(jeu: JeuCompact): Commune[] {
  if (jeu.version !== 2) throw new Error(`Format de jeu inattendu (version ${String(jeu.version)})`);
  return jeu.communes.map((c) => {
    const criteres: Partial<Record<CritereId, CritereDonnees>> = {};
    for (const [id, entree] of Object.entries(c.criteres) as [CritereId, EntreeCritereCompacte][]) {
      const dico = jeu.criteres[id];
      if (!dico) continue;
      const absentes = new Set(entree.absentes ?? []);
      const mesures: Mesure[] = [];
      dico.mesures.forEach((meta, i) => {
        if (absentes.has(i)) return;
        const { sourceRef, ...reste } = meta;
        const m: Mesure = { ...reste, valeur: entree.v[i] ?? null };
        if (sourceRef !== undefined) m.source = jeu.sources[sourceRef];
        for (const [champ, valeur] of Object.entries(entree.x?.[String(i)] ?? {})) {
          const cible = m as unknown as Record<string, unknown>;
          if (valeur === null && champ !== "valeur") delete cible[champ];
          else cible[champ] = valeur;
        }
        mesures.push(m);
      });
      criteres[id] = {
        mesures,
        source: entree.t?.source ?? dico.source,
        methodologie: entree.t?.methodologie ?? dico.methodologie,
        caveats: entree.t?.caveats ?? dico.caveats,
      };
    }
    return { ...c, criteres } as Commune;
  });
}
