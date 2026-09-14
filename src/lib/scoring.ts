/**
 * Moteur de classement.
 *
 * Aucune note arbitraire n'est produite. Pour chaque mesure on calcule la
 * position d'une commune parmi les autres, sous deux formes qui ne servent pas
 * à la même chose :
 *
 *   — `fraction`, le rang milieu (ex-æquo comptés pour une demi-victoire), qui
 *     sert à trier et à dessiner la barre de position ;
 *   — `devancees` et `exAequo`, des décomptes réels de communes, seuls habilités
 *     à produire la phrase affichée. Traduire le rang milieu en toutes lettres
 *     ferait dire au produit des choses fausses dès qu'une valeur est répandue :
 *     une commune sans gare a un rang milieu de 26 %, alors qu'elle est à égalité
 *     avec la moitié du jeu et devancée par l'autre moitié seulement.
 *
 * Le score pondéré n'est qu'un moyen de trier ; il n'est jamais montré comme
 * une note sur 10.
 *
 * Complexité : le classement d'un jeu de test de quelques dizaines de communes
 * tolère n'importe quel algorithme, mais ce projet a vocation à couvrir la
 * France entière — plusieurs milliers de communes. Comparer chaque commune à
 * toutes les autres une à une (O(n²)) devient alors des centaines de millions
 * d'opérations par mesure. La position d'une commune ne dépend que de son rang
 * dans la mesure triée : un tri une fois par mesure (O(n log n)), puis une
 * recherche dichotomique par commune, donne exactement le même résultat sans
 * jamais comparer les communes deux à deux.
 */

import type { Commune, CritereId, Mesure } from "./types";
import { CRITERES } from "./criteres";

/** Position d'une commune sur une mesure. */
export interface Position {
  /** Rang milieu dans [0, 1]. 1 = devance toutes les autres. */
  fraction: number;
  /** Communes disposant d'une valeur pour cette mesure, celle-ci comprise. */
  effectif: number;
  /** Autres communes strictement devancées. */
  devancees: number;
  /** Autres communes de valeur strictement meilleure. */
  devancantes: number;
  /** Autres communes de valeur identique. */
  exAequo: number;
  /** Communes de comparaison, soit `effectif - 1`. */
  autres: number;
}

/** Position agrégée d'un critère : une fraction, sans décompte de communes. */
export interface PositionCritere {
  fraction: number;
  effectif: number;
  /** Mesures classantes réellement disponibles, sur le total du critère. */
  mesuresRetenues: number;
  mesuresAttendues: number;
}

export type PositionsParMesure = Record<string, Position | null>;

/** Positions calculées une fois pour tout le jeu de données. */
export interface Referentiel {
  /** codeInsee -> mesureId -> position */
  positions: Record<string, PositionsParMesure>;
  /** codeInsee -> critereId -> position agrégée des mesures classantes */
  positionsCriteres: Record<string, Record<CritereId, PositionCritere | null>>;
}

function mesuresDe(commune: Commune, critere: CritereId): Mesure[] {
  return commune.criteres[critere]?.mesures ?? [];
}

/** Index du premier élément d'un tableau trié croissant qui soit >= v. */
function borneInferieure(trie: number[], v: number): number {
  let bas = 0;
  let haut = trie.length;
  while (bas < haut) {
    const milieu = (bas + haut) >>> 1;
    if (trie[milieu] < v) bas = milieu + 1;
    else haut = milieu;
  }
  return bas;
}

/** Index du premier élément d'un tableau trié croissant qui soit > v. */
function borneSuperieure(trie: number[], v: number): number {
  let bas = 0;
  let haut = trie.length;
  while (bas < haut) {
    const milieu = (bas + haut) >>> 1;
    if (trie[milieu] <= v) bas = milieu + 1;
    else haut = milieu;
  }
  return bas;
}

/**
 * Situe chaque commune d'un échantillon par rapport aux autres, pour une seule
 * mesure. Le tableau des valeurs n'est trié qu'une fois pour tout l'échantillon
 * (O(n log n)), puis chaque commune se localise dedans par recherche
 * dichotomique (O(log n)) au lieu d'un balayage complet des autres (O(n)) :
 * O(n log n) au total pour la mesure entière, plutôt que O(n²).
 *
 * Un échantillon de moins de deux valeurs renvoie une correspondance vide : la
 * comparaison n'a pas de sens, et lui attribuer une position médiane par
 * défaut serait un chiffre inventé.
 */
function situerTous(
  echantillon: { code: string; valeur: number; sens: "bas" | "haut" }[],
): Map<string, Position> {
  const resultats = new Map<string, Position>();
  const autres = echantillon.length - 1;
  if (autres < 1) return resultats;

  const trie = echantillon.map((e) => e.valeur).sort((a, b) => a - b);

  for (const entree of echantillon) {
    // Combien de valeurs de l'échantillon (soi compris) sont <, ==, > la mienne.
    const inf = borneInferieure(trie, entree.valeur);
    const sup = borneSuperieure(trie, entree.valeur);
    const countMoins = inf;
    const countEgal = sup - inf;
    const countPlus = trie.length - sup;

    // Sens « bas » : une valeur plus grande est moins bonne, donc « devancée ».
    const devancees = entree.sens === "bas" ? countPlus : countMoins;
    const devancantes = entree.sens === "bas" ? countMoins : countPlus;
    const exAequo = countEgal - 1; // on exclut sa propre valeur du décompte

    resultats.set(entree.code, {
      fraction: (devancees + exAequo * 0.5) / autres,
      effectif: trie.length,
      devancees,
      devancantes,
      exAequo,
      autres,
    });
  }

  return resultats;
}

/**
 * Calcule toutes les positions relatives du jeu de données.
 *
 * Coût O(communes × mesures × log(communes)) : quelques millisecondes pour un
 * jeu de test de quelques dizaines de communes, et reste largement praticable
 * pour plusieurs milliers.
 */
export function construireReferentiel(communes: Commune[]): Referentiel {
  const positions: Record<string, PositionsParMesure> = {};
  const positionsCriteres: Record<string, Record<CritereId, PositionCritere | null>> = {};

  // Les positions sont indexées à plat par identifiant de mesure : deux critères
  // qui réutiliseraient le même identifiant s'écraseraient silencieusement.
  // Mieux vaut casser la compilation que servir un classement faux.
  const proprietaire = new Map<string, CritereId>();
  for (const commune of communes) {
    for (const critere of CRITERES) {
      for (const mesure of mesuresDe(commune, critere.id)) {
        const deja = proprietaire.get(mesure.id);
        if (deja && deja !== critere.id) {
          throw new Error(
            `Identifiant de mesure « ${mesure.id} » partagé par les critères « ${deja} » et ` +
              `« ${critere.id} ». Les identifiants doivent être uniques sur tout le jeu de données.`,
          );
        }
        proprietaire.set(mesure.id, critere.id);
      }
    }
  }

  for (const commune of communes) {
    positions[commune.codeInsee] = {};
    positionsCriteres[commune.codeInsee] = {} as Record<CritereId, PositionCritere | null>;
  }

  for (const critere of CRITERES) {
    // Un critère peut porter plusieurs mesures ; on indexe par id de mesure.
    const idsMesures = new Set<string>();
    for (const commune of communes) {
      for (const mesure of mesuresDe(commune, critere.id)) idsMesures.add(mesure.id);
    }

    for (const idMesure of idsMesures) {
      const echantillon: { code: string; valeur: number; sens: "bas" | "haut" }[] = [];
      for (const commune of communes) {
        const mesure = mesuresDe(commune, critere.id).find((m) => m.id === idMesure);
        if (mesure && mesure.valeur !== null && Number.isFinite(mesure.valeur)) {
          echantillon.push({ code: commune.codeInsee, valeur: mesure.valeur, sens: mesure.sens });
        }
      }
      const situees = situerTous(echantillon);
      for (const commune of communes) {
        positions[commune.codeInsee][idMesure] = situees.get(commune.codeInsee) ?? null;
      }
    }

    // Position du critère = moyenne non pondérée des mesures classantes disponibles.
    for (const commune of communes) {
      const classantes = mesuresDe(commune, critere.id).filter((m) => m.classante);
      const dispo = classantes
        .map((m) => positions[commune.codeInsee][m.id])
        .filter((p): p is Position => p !== null && p !== undefined);
      positionsCriteres[commune.codeInsee][critere.id] = dispo.length
        ? {
            fraction: dispo.reduce((s, p) => s + p.fraction, 0) / dispo.length,
            effectif: Math.min(...dispo.map((p) => p.effectif)),
            mesuresRetenues: dispo.length,
            mesuresAttendues: classantes.length,
          }
        : null;
    }
  }

  return { positions, positionsCriteres };
}

export type Poids = Record<CritereId, number>;

export interface LigneClassement {
  commune: Commune;
  rang: number;
  /** Moyenne pondérée des positions, dans [0, 1]. Sert à trier, jamais à noter. */
  score: number;
  /** Critères écartés du calcul pour cette commune, faute de donnée. */
  criteresIgnores: CritereId[];
  /** Critères classés sur une partie seulement de leurs mesures. */
  criteresPartiels: CritereId[];
  /** Contribution de chaque critère au score, pour expliquer le rang. */
  contributions: { critere: CritereId; fraction: number; part: number }[];
}

/**
 * Trie les communes selon les poids choisis.
 *
 * Une commune sans donnée sur un critère n'est ni avantagée ni pénalisée : le
 * critère est retiré du numérateur *et* du dénominateur, et l'omission est
 * signalée dans `criteresIgnores`. Un critère classé sur une partie seulement
 * de ses mesures est signalé dans `criteresPartiels`.
 */
export function classer(
  communes: Commune[],
  referentiel: Referentiel,
  poids: Poids,
): LigneClassement[] {
  const lignes = communes.map((commune) => {
    let numerateur = 0;
    let denominateur = 0;
    const criteresIgnores: CritereId[] = [];
    const criteresPartiels: CritereId[] = [];
    const brut: { critere: CritereId; fraction: number; poids: number }[] = [];

    for (const critere of CRITERES) {
      const p = poids[critere.id] ?? 0;
      const position = referentiel.positionsCriteres[commune.codeInsee]?.[critere.id];
      if (!position) {
        if (p > 0) criteresIgnores.push(critere.id);
        continue;
      }
      if (p <= 0) continue;
      if (position.mesuresRetenues < position.mesuresAttendues) criteresPartiels.push(critere.id);
      numerateur += p * position.fraction;
      denominateur += p;
      brut.push({ critere: critere.id, fraction: position.fraction, poids: p });
    }

    const score = denominateur > 0 ? numerateur / denominateur : 0;
    const contributions = brut
      .map((b) => ({
        critere: b.critere,
        fraction: b.fraction,
        part: numerateur > 0 ? (b.poids * b.fraction) / numerateur : 0,
      }))
      .sort((a, b) => b.part - a.part);

    return { commune, score, criteresIgnores, criteresPartiels, contributions, rang: 0 };
  });

  lignes.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Départage stable et non arbitraire : ordre alphabétique.
    return a.commune.nom.localeCompare(b.commune.nom, "fr");
  });
  lignes.forEach((ligne, i) => {
    ligne.rang = i + 1;
  });
  return lignes;
}

/**
 * Le score pondéré seul, sans tri ni rang : ce qui sert à colorer la carte en
 * direct (voir CarteFrance.tsx). Le score d'une commune ne dépend que de ses
 * propres positions, jamais des autres communes du tableau — trier n'aurait
 * ici aucun effet sur le résultat, seulement un coût (O(n log n) plus les
 * appels de comparateur) inutile à payer à chaque tick de glissement.
 */
export function scoresSeuls(
  communes: Commune[],
  referentiel: Referentiel,
  poids: Poids,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const commune of communes) {
    let numerateur = 0;
    let denominateur = 0;
    for (const critere of CRITERES) {
      const p = poids[critere.id] ?? 0;
      if (p <= 0) continue;
      const position = referentiel.positionsCriteres[commune.codeInsee]?.[critere.id];
      if (!position) continue;
      numerateur += p * position.fraction;
      denominateur += p;
    }
    scores.set(commune.codeInsee, denominateur > 0 ? numerateur / denominateur : 0);
  }
  return scores;
}

/**
 * Transpose des scores bruts en position relative parmi les communes
 * fournies — même convention que `Position.fraction` (les ex-æquo comptent
 * pour une demi-victoire) — pour colorer la carte. Un score brut moyenne
 * plusieurs critères entre eux : il se resserre presque toujours vers le
 * centre (par construction, dès qu'on moyenne des positions à peu près
 * indépendantes), quels que soient les poids. Coloré linéairement, cet
 * écrasement rendrait la carte presque monochrome alors même que le
 * classement, lui, reste parfaitement net. La position relative occupe tout
 * l'intervalle [0, 1] par construction, quelle que soit la forme de la
 * distribution des scores.
 */
export function positionsDeScore(scores: Map<string, number>): Map<string, number> {
  const entrees = [...scores.entries()].sort((a, b) => a[1] - b[1]);
  const n = entrees.length;
  const positions = new Map<string, number>();
  if (n <= 1) {
    for (const [id] of entrees) positions.set(id, 0.5);
    return positions;
  }
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && entrees[j + 1][1] === entrees[i][1]) j++;
    const devancees = i;
    const exAequo = j - i;
    const fraction = (devancees + exAequo * 0.5) / (n - 1);
    for (let k = i; k <= j; k++) positions.set(entrees[k][0], fraction);
    i = j + 1;
  }
  return positions;
}

/** Aucun curseur n'est levé : le classement n'a pas de sens, on le dit. */
export function aucunePriorite(poids: Poids): boolean {
  return CRITERES.every((c) => (poids[c.id] ?? 0) <= 0);
}
