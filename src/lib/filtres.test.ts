import { describe, expect, it } from "vitest";

import {
  appliquerFiltres,
  calculerBornes,
  decoderFiltres,
  encoderFiltres,
  estFiltresVides,
  filtresActifs,
} from "./filtres";
import type { Commune, CritereDonnees, CritereId, Mesure, Sens } from "./types";

const SOURCE = { nom: "Source de test", producteur: "Test", url: "https://example.invalid", annee: "2024" };

function mesure(id: string, valeur: number | null, opts: Partial<Mesure> = {}): Mesure {
  return {
    id,
    libelle: id,
    valeur,
    unite: "u",
    sens: "bas" as Sens,
    classante: true,
    vedette: true,
    comparatif: { mieux: "mieux que", pire: "moins bien que" },
    ...opts,
  };
}

function critere(mesures: Mesure[]): CritereDonnees {
  return { mesures, source: SOURCE, methodologie: "", caveats: [] };
}

function commune(nom: string, prix: number | null, transport: number | null = 20): Commune {
  return {
    codeInsee: nom,
    slug: nom.toLowerCase(),
    nom,
    population: 1000,
    anneePopulation: 2023,
    departement: "69",
    criteres: {
      immobilier: critere([mesure("prix", prix)]),
      transports: critere([mesure("trajet", transport)]),
    } as Record<CritereId, CritereDonnees>,
    politique: { scrutins: [] },
  };
}

describe("calculerBornes", () => {
  it("calcule le min et le max réels d'une mesure vedette", () => {
    const communes = [commune("A", 1000), commune("B", 2000), commune("C", 3000)];
    const bornes = calculerBornes(communes);

    expect(bornes.immobilier).toMatchObject({ mesureId: "prix", min: 1000, max: 3000 });
  });

  it("ignore un critère sans valeur distincte (toutes égales)", () => {
    const communes = [commune("A", 1500), commune("B", 1500)];
    expect(calculerBornes(communes).immobilier).toBeUndefined();
  });

  it("ignore un critère avec moins de deux valeurs renseignées", () => {
    const communes = [commune("A", 1500), commune("B", null)];
    expect(calculerBornes(communes).immobilier).toBeUndefined();
  });
});

describe("appliquerFiltres", () => {
  const communes = [commune("Chere", 5000, 10), commune("Abordable", 1000, 40), commune("Absente", null, 20)];
  const bornes = calculerBornes(communes);

  it("ne filtre rien quand aucun filtre n'est actif", () => {
    const r = appliquerFiltres(communes, {}, bornes);
    expect(r.communes).toHaveLength(3);
    expect(r.sansDonnee).toBe(0);
    expect(r.horsPlage).toBe(0);
  });

  it("retient les communes dans la plage et exclut les autres", () => {
    const r = appliquerFiltres(communes, { immobilier: { min: 1000, max: 2000 } }, bornes);
    expect(r.communes.map((c) => c.nom)).toEqual(["Abordable"]);
    expect(r.horsPlage).toBe(1); // Chere
    expect(r.sansDonnee).toBe(1); // Absente
  });

  it("exclut une commune sans donnée sur un critère filtré, sans la compter en hors plage", () => {
    const r = appliquerFiltres(communes, { immobilier: { min: 0, max: 6000 } }, bornes);
    // La plage complète ne resserre rien : ce n'est pas un filtre actif.
    expect(r.communes).toHaveLength(3);
  });

  it("combine deux filtres actifs (ET logique)", () => {
    const r = appliquerFiltres(
      communes,
      { immobilier: { min: 0, max: 6000 - 1 }, transports: { min: 0, max: 15 } },
      bornes,
    );
    // Seule "Chere" a un trajet <= 15, et son prix (5000) passe le filtre resserré.
    expect(r.communes.map((c) => c.nom)).toEqual(["Chere"]);
  });

  it("un filtre qui ne resserre pas la borne réelle n'est pas actif", () => {
    expect(filtresActifs({ immobilier: { min: 1000, max: 5000 } }, bornes)).toEqual([]);
    expect(filtresActifs({ immobilier: { min: 1001, max: 5000 } }, bornes)).toEqual(["immobilier"]);
  });
});

describe("URL des filtres", () => {
  it("aller-retour encode/décode", () => {
    const filtres = { immobilier: { min: 1500, max: 3500 }, transports: { min: 5, max: 40 } };
    const brut = encoderFiltres(filtres);
    expect(decoderFiltres(brut)).toEqual(filtres);
  });

  it("décode une entrée vide comme aucun filtre", () => {
    expect(decoderFiltres(undefined)).toEqual({});
    expect(decoderFiltres("")).toEqual({});
    expect(estFiltresVides(decoderFiltres(undefined))).toBe(true);
  });

  it("ignore une entrée malformée plutôt que de planter", () => {
    expect(decoderFiltres("abc,,,",)).toEqual({});
    expect(decoderFiltres("100_50,,,")).toEqual({}); // min > max, rejeté
  });

  it("estFiltresVides distingue un objet vide d'un objet peuplé", () => {
    expect(estFiltresVides({})).toBe(true);
    expect(estFiltresVides({ immobilier: { min: 1, max: 2 } })).toBe(false);
  });
});
