import { describe, expect, it } from "vitest";

import { nombre, phraseComparative, slugifier, valeurMesure } from "./format";
import type { Position } from "./scoring";
import type { Mesure } from "./types";

/** Espace fine insécable, telle que `format.ts` la produit. */
const FIN = String.fromCharCode(0x202f);

const PRIX: Mesure = {
  id: "prix",
  libelle: "Prix médian au m²",
  valeur: 3200,
  unite: "€/m²",
  sens: "bas",
  classante: true,
  comparatif: { mieux: "moins cher que", pire: "plus cher que" },
};

function position(p: Partial<Position>): Position {
  const devancees = p.devancees ?? 0;
  const devancantes = p.devancantes ?? 0;
  const exAequo = p.exAequo ?? 0;
  const autres = p.autres ?? devancees + devancantes + exAequo;
  return {
    fraction: autres > 0 ? (devancees + exAequo * 0.5) / autres : 0.5,
    effectif: autres + 1,
    devancees,
    devancantes,
    exAequo,
    autres,
  };
}

describe("phraseComparative", () => {
  it("énonce la part réellement devancée", () => {
    // 72 sur 100 autres : c'est l'exemple du cahier des charges.
    expect(phraseComparative(PRIX, position({ devancees: 72, devancantes: 28 }))).toBe(
      `moins cher que 72${FIN}% des autres villes comparées`,
    );
  });

  it("bascule sur la formulation inverse quand la commune est devancée", () => {
    expect(phraseComparative(PRIX, position({ devancees: 10, devancantes: 90 }))).toBe(
      `plus cher que 90${FIN}% des autres villes comparées`,
    );
  });

  it("ne convertit pas les ex-æquo en victoires", () => {
    // Une commune sans gare, à égalité avec 16 autres et devancée par 15 :
    // le rang milieu vaut 0,26, mais aucune ville n'est « devancée à 74 % ».
    const gares: Mesure = {
      ...PRIX,
      id: "gares",
      libelle: "Gares",
      valeur: 0,
      sens: "haut",
      comparatif: { mieux: "mieux desservie que", pire: "moins bien desservie que" },
    };
    const p = position({ devancees: 0, devancantes: 15, exAequo: 16 });

    expect(p.fraction).toBeCloseTo(0.258, 3);
    expect(phraseComparative(gares, p)).toBe(
      `moins bien desservie que 48${FIN}% des autres villes comparées, à égalité avec 52${FIN}%`,
    );
  });

  it("tait les ex-æquo tant qu'ils restent marginaux", () => {
    expect(phraseComparative(PRIX, position({ devancees: 70, devancantes: 28, exAequo: 2 }))).toBe(
      `moins cher que 70${FIN}% des autres villes comparées`,
    );
  });

  it("dit l'égalité générale plutôt qu'une position médiane", () => {
    expect(phraseComparative(PRIX, position({ exAequo: 31 }))).toBe(
      "même valeur que les 31 autres villes comparées",
    );
  });

  it("se tait pour une mesure sans direction favorable", () => {
    const evolution: Mesure = { ...PRIX, id: "evo", valeur: 4.2, comparable: false };
    expect(phraseComparative(evolution, position({ devancees: 20, devancantes: 11 }))).toBeNull();
  });

  it("se tait sans position ou sans valeur", () => {
    expect(phraseComparative(PRIX, null)).toBeNull();
    expect(phraseComparative({ ...PRIX, valeur: null }, position({ devancees: 5 }))).toBeNull();
  });
});

describe("valeurMesure", () => {
  it("colle l'unité au chiffre avec une espace insécable", () => {
    expect(valeurMesure(PRIX)).toBe(`3${FIN}200${FIN}€/m²`);
  });

  it("affiche le signe d'une variation positive", () => {
    expect(valeurMesure({ ...PRIX, valeur: 4.2, unite: "%", decimales: 1, signe: true })).toBe(
      `+4,2${FIN}%`,
    );
    expect(valeurMesure({ ...PRIX, valeur: -4.2, unite: "%", decimales: 1, signe: true })).toBe(
      `-4,2${FIN}%`,
    );
  });

  it("distingue une valeur non publiée d'une valeur absente", () => {
    expect(valeurMesure({ ...PRIX, valeur: null, statut: "secret_statistique" })).toBe("Non publié");
    expect(valeurMesure({ ...PRIX, valeur: null })).toBe("Non disponible");
  });
});

describe("nombre", () => {
  it("sépare les milliers sans espace sécable", () => {
    expect(nombre(1234567)).toBe(`1${FIN}234${FIN}567`);
    expect(nombre(3.14159, 2)).toBe("3,14");
  });
});

describe("slugifier", () => {
  it("produit des identifiants d'URL stables", () => {
    expect(slugifier("Sainte-Foy-lès-Lyon")).toBe("sainte-foy-les-lyon");
    expect(slugifier("Saint-Cyr-au-Mont-d'Or")).toBe("saint-cyr-au-mont-d-or");
    expect(slugifier("Écully")).toBe("ecully");
    expect(slugifier("Oullins-Pierre-Bénite")).toBe("oullins-pierre-benite");
  });
});
