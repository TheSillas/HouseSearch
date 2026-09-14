import type { PointHistorique } from "./types";

/**
 * Géométrie pure d'une courbe d'évolution — aucun DOM, aucun React, pour
 * rester testable indépendamment du rendu.
 *
 * Une valeur manquante casse la ligne plutôt que d'être interpolée : relier
 * deux points de part et d'autre d'un trou inventerait la trajectoire entre
 * les deux, ce que ce projet s'interdit.
 */

export interface PointTrace {
  index: number;
  annee: number;
  valeur: number;
  x: number;
  y: number;
}

export interface Marge {
  haut: number;
  bas: number;
  gauche: number;
  droite: number;
}

export interface Echelle {
  /** Segments consécutifs de points renseignés ; plusieurs quand il y a un trou. */
  segments: PointTrace[][];
  /** Même longueur et ordre que les points d'entrée ; `null` préservé pour un trou. */
  points: (PointTrace | null)[];
  /** Ordonnée du bas de la zone de tracé, pour refermer l'aplat vers la ligne de base. */
  yBase: number;
  minValeur: number;
  maxValeur: number;
  /** Index du point atteignant le minimum (première occurrence). */
  indexMin: number;
  indexMax: number;
  /** Dernier point renseigné : celui qu'on met en avant comme valeur actuelle. */
  indexFin: number;
}

/**
 * Calcule les positions x/y de chaque point dans une zone `largeur × hauteur`.
 * Renvoie `null` quand moins de deux valeurs sont renseignées : une courbe n'a
 * alors rien à montrer.
 */
export function construireEchelle(
  points: PointHistorique[],
  largeur: number,
  hauteur: number,
  marge: Marge,
): Echelle | null {
  const valeurs = points.map((p) => p.valeur).filter((v): v is number => v !== null);
  if (valeurs.length < 2) return null;

  const brutMin = Math.min(...valeurs);
  const brutMax = Math.max(...valeurs);
  // Une série plate (toutes valeurs égales) recevrait une étendue nulle :
  // on lui donne alors une marge conventionnelle pour que la ligne reste lisible.
  const etendue = brutMax - brutMin || Math.abs(brutMax) * 0.1 || 1;
  const domaineMin = brutMin - etendue * 0.12;
  const domaineMax = brutMax + etendue * 0.12;

  const zoneX = Math.max(largeur - marge.gauche - marge.droite, 1);
  const zoneY = Math.max(hauteur - marge.haut - marge.bas, 1);
  const n = points.length;

  const x = (i: number) => marge.gauche + (n <= 1 ? zoneX / 2 : (i / (n - 1)) * zoneX);
  const y = (v: number) => marge.haut + zoneY - ((v - domaineMin) / (domaineMax - domaineMin)) * zoneY;

  const traces: (PointTrace | null)[] = points.map((p, i) =>
    p.valeur === null
      ? null
      : { index: i, annee: p.annee, valeur: p.valeur, x: x(i), y: y(p.valeur) },
  );

  const segments: PointTrace[][] = [];
  let courant: PointTrace[] = [];
  for (const t of traces) {
    if (t) {
      courant.push(t);
    } else if (courant.length) {
      segments.push(courant);
      courant = [];
    }
  }
  if (courant.length) segments.push(courant);

  let indexMin = -1;
  let indexMax = -1;
  let indexFin = -1;
  for (const t of traces) {
    if (!t) continue;
    indexFin = t.index;
    if (indexMin === -1 || t.valeur < (traces[indexMin] as PointTrace).valeur) indexMin = t.index;
    if (indexMax === -1 || t.valeur > (traces[indexMax] as PointTrace).valeur) indexMax = t.index;
  }

  return {
    segments,
    points: traces,
    yBase: marge.haut + zoneY,
    minValeur: brutMin,
    maxValeur: brutMax,
    indexMin,
    indexMax,
    indexFin,
  };
}

/** Chemin SVG d'un segment continu, en `M`/`L` — pas de courbe lissée, la donnée n'est pas continue. */
export function chemin(segment: PointTrace[]): string {
  return segment.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/** Referme un segment vers la ligne de base, pour l'aplat de couleur sous la ligne. */
export function cheminAire(segment: PointTrace[], yBase: number): string {
  if (segment.length === 0) return "";
  const premier = segment[0];
  const dernier = segment[segment.length - 1];
  return `${chemin(segment)} L${dernier.x.toFixed(2)},${yBase.toFixed(2)} L${premier.x.toFixed(2)},${yBase.toFixed(2)} Z`;
}

/** Plage d'années couverte, pour l'intitulé du disclosure qui replie la courbe. */
export function libellePeriode(points: PointHistorique[]): string {
  const annees = points.map((p) => p.annee);
  return `${Math.min(...annees)}–${Math.max(...annees)}`;
}

/** Point tracé le plus proche d'une abscisse donnée, pour le survol au pointeur. */
export function pointLePlusProche(points: (PointTrace | null)[], x: number): PointTrace | null {
  let meilleur: PointTrace | null = null;
  let distanceMin = Infinity;
  for (const p of points) {
    if (!p) continue;
    const d = Math.abs(p.x - x);
    if (d < distanceMin) {
      distanceMin = d;
      meilleur = p;
    }
  }
  return meilleur;
}
