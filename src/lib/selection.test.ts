import { describe, expect, it } from "vitest";

import {
  alignerComparaison,
  basculer,
  basculerComparaison,
  comparees,
  lireSelection,
  MAX_COMPAREES,
  retirer,
  type Selection,
} from "./selection";

const commune = (n: number) => ({ codeInsee: `640${n}`, slug: `c${n}`, nom: `Commune ${n}`, departement: "64" });

describe("ma sélection", () => {
  it("étoile : ajoute cochée, puis retire", () => {
    let s: Selection = [];
    s = basculer(s, commune(1));
    expect(s).toEqual([{ ...commune(1), comparee: true }]);
    s = basculer(s, commune(1));
    expect(s).toEqual([]);
  });

  it("au-delà du plafond, une commune entre dans la liste sans être comparée", () => {
    let s: Selection = [];
    for (let i = 1; i <= MAX_COMPAREES + 1; i++) s = basculer(s, commune(i));
    expect(s).toHaveLength(MAX_COMPAREES + 1);
    expect(comparees(s)).toHaveLength(MAX_COMPAREES);
    expect(s[MAX_COMPAREES].comparee).toBe(false);
    // Cocher la dernière ne fait rien tant que le plafond est atteint…
    expect(basculerComparaison(s, commune(MAX_COMPAREES + 1).codeInsee)).toBe(s);
    // …et redevient possible après avoir décoché une autre.
    const libere = basculerComparaison(s, commune(1).codeInsee);
    expect(comparees(basculerComparaison(libere, commune(MAX_COMPAREES + 1).codeInsee))).toHaveLength(MAX_COMPAREES);
  });

  it("retire une commune, cochée ou non", () => {
    const s = basculer(basculer([], commune(1)), commune(2));
    expect(retirer(s, commune(1).codeInsee).map((c) => c.codeInsee)).toEqual([commune(2).codeInsee]);
  });

  it("aligne la comparaison sur les communes d'une adresse, sans perdre les autres", () => {
    let s: Selection = basculer(basculer([], commune(1)), commune(2)); // 1 et 2 cochées
    s = alignerComparaison(s, [commune(2), commune(3)]);
    expect(s.map((c) => [c.codeInsee, c.comparee])).toEqual([
      [commune(1).codeInsee, false],
      [commune(2).codeInsee, true],
      [commune(3).codeInsee, true],
    ]);
    const trop = Array.from({ length: MAX_COMPAREES + 2 }, (_, i) => commune(10 + i));
    expect(comparees(alignerComparaison([], trop))).toHaveLength(MAX_COMPAREES);
  });

  it("relit le stockage en ignorant ce qui est mal formé", () => {
    expect(lireSelection(null)).toEqual([]);
    expect(lireSelection("pas du json")).toEqual([]);
    expect(lireSelection(JSON.stringify({ a: 1 }))).toEqual([]);
    const brut = JSON.stringify([
      { codeInsee: "64122", slug: "biarritz", nom: "Biarritz", departement: "64", comparee: true },
      { codeInsee: "64122", slug: "biarritz", nom: "Biarritz", departement: "64", comparee: true },
      { codeInsee: "64024", slug: "anglet", nom: "Anglet" },
      { slug: "sans-code" },
      42,
    ]);
    expect(lireSelection(brut)).toEqual([
      { codeInsee: "64122", slug: "biarritz", nom: "Biarritz", departement: "64", comparee: true },
      { codeInsee: "64024", slug: "anglet", nom: "Anglet", departement: "64", comparee: false },
    ]);
  });

  it("borne les cochées relues au plafond", () => {
    const brut = JSON.stringify(
      Array.from({ length: MAX_COMPAREES + 2 }, (_, i) => ({ ...commune(i), comparee: true })),
    );
    expect(comparees(lireSelection(brut))).toHaveLength(MAX_COMPAREES);
  });
});
