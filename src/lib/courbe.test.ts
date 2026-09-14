import { describe, expect, it } from "vitest";

import { chemin, cheminAire, construireEchelle, pointLePlusProche } from "./courbe";
import type { PointHistorique } from "./types";

const MARGE = { haut: 10, bas: 10, gauche: 5, droite: 5 };

function serie(valeurs: (number | null)[]): PointHistorique[] {
  return valeurs.map((valeur, i) => ({ annee: 2021 + i, valeur }));
}

describe("construireEchelle", () => {
  it("refuse une série avec moins de deux valeurs renseignées", () => {
    expect(construireEchelle(serie([100, null, null, null, null]), 300, 100, MARGE)).toBeNull();
    expect(construireEchelle(serie([null, null]), 300, 100, MARGE)).toBeNull();
  });

  it("place le premier et le dernier point aux bords de la zone de tracé", () => {
    const e = construireEchelle(serie([100, 200, 150, 300, 250]), 300, 100, MARGE)!;
    const premier = e.points[0]!;
    const dernier = e.points[4]!;
    expect(premier.x).toBeCloseTo(MARGE.gauche, 5);
    expect(dernier.x).toBeCloseTo(300 - MARGE.droite, 5);
  });

  it("place une valeur plus haute plus haut à l'écran (y plus petit)", () => {
    const e = construireEchelle(serie([100, 500]), 300, 100, MARGE)!;
    const bas = e.points[0]!;
    const haut = e.points[1]!;
    expect(haut.y).toBeLessThan(bas.y);
  });

  it("identifie le minimum, le maximum et le dernier point renseigné", () => {
    const e = construireEchelle(serie([100, 500, 50, 300]), 300, 100, MARGE)!;
    expect(e.indexMin).toBe(2); // valeur 50
    expect(e.indexMax).toBe(1); // valeur 500
    expect(e.indexFin).toBe(3); // dernier point non nul
  });

  it("s'arrête au dernier point réellement renseigné, pas au dernier de la série", () => {
    const e = construireEchelle(serie([100, 200, 300, null]), 300, 100, MARGE)!;
    expect(e.indexFin).toBe(2);
  });

  it("casse la ligne en segments distincts autour d'un trou", () => {
    const e = construireEchelle(serie([100, null, 300, 250]), 300, 100, MARGE)!;
    expect(e.segments).toHaveLength(2);
    expect(e.segments[0].map((p) => p.index)).toEqual([0]);
    expect(e.segments[1].map((p) => p.index)).toEqual([2, 3]);
  });

  it("ne casse rien quand la série est complète", () => {
    const e = construireEchelle(serie([100, 200, 300]), 300, 100, MARGE)!;
    expect(e.segments).toHaveLength(1);
    expect(e.segments[0]).toHaveLength(3);
  });

  it("donne une étendue non nulle à une série plate", () => {
    const e = construireEchelle(serie([100, 100, 100]), 300, 100, MARGE)!;
    // Les trois points doivent rester à des y finis et non confondus avec les bords.
    for (const p of e.points) {
      expect(Number.isFinite(p!.y)).toBe(true);
    }
  });
});

describe("chemin / cheminAire", () => {
  it("commence par M et enchaîne en L", () => {
    const e = construireEchelle(serie([100, 200, 150]), 300, 100, MARGE)!;
    const d = chemin(e.segments[0]);
    expect(d.startsWith("M")).toBe(true);
    expect(d.match(/L/g)).toHaveLength(2);
  });

  it("l'aire se referme sur la ligne de base aux deux extrémités du segment", () => {
    const e = construireEchelle(serie([100, 200]), 300, 100, MARGE)!;
    const d = cheminAire(e.segments[0], e.yBase);
    expect(d).toContain(`,${e.yBase.toFixed(2)}`);
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("renvoie une chaîne vide pour un segment vide", () => {
    expect(cheminAire([], 90)).toBe("");
  });
});

describe("pointLePlusProche", () => {
  it("trouve le point tracé le plus proche d'une abscisse, en ignorant les trous", () => {
    const e = construireEchelle(serie([100, null, 300, 250]), 300, 100, MARGE)!;
    const proche = pointLePlusProche(e.points, e.points[3]!.x - 2);
    expect(proche?.index).toBe(3);
  });

  it("renvoie null quand aucun point n'est tracé", () => {
    expect(pointLePlusProche([null, null], 10)).toBeNull();
  });
});
