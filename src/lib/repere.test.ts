import { describe, expect, it } from "vitest";

import { appliquerRepere, decoderRepere, distanceKm, encoderRepere, poidsEffectifs } from "./repere";
import { POIDS_PAR_DEFAUT } from "./criteres";
import type { Commune } from "./types";

const commune = (codeInsee: string, nom: string, lat?: number, lon?: number): Commune => ({
  codeInsee,
  slug: nom.toLowerCase(),
  nom,
  population: 1000,
  anneePopulation: 2023,
  departement: codeInsee.slice(0, 2),
  criteres: {},
  politique: { scrutins: [] },
  ...(lat !== undefined && lon !== undefined ? { lat, lon } : {}),
});

describe("repère personnel", () => {
  it("mesure une distance orthodromique plausible", () => {
    // Paris (Notre-Dame) → Lyon (Bellecour) : ~392 km.
    const d = distanceKm(48.853, 2.3499, 45.7578, 4.832);
    expect(d).toBeGreaterThan(388);
    expect(d).toBeLessThan(396);
    expect(distanceKm(45, 5, 45, 5)).toBe(0);
  });

  it("ajoute un critère Proximité classant, sans toucher aux communes d'origine", () => {
    const communes = [commune("69123", "Lyon", 45.7578, 4.832), commune("75056", "Paris", 48.853, 2.3499), commune("99999", "Sans point")];
    const repere = { lat: 45.7578, lon: 4.832, nom: "Lyon", codeInsee: "69123" };
    const avec = appliquerRepere(communes, repere);
    expect(communes[0].criteres.proximite).toBeUndefined();
    expect(avec[0].criteres.proximite?.mesures[0]).toMatchObject({ id: "prox-distance", valeur: 0, classante: true, vedette: true, sens: "bas" });
    expect(avec[1].criteres.proximite?.mesures[0].valeur).toBeCloseTo(392, -1);
    expect(avec[2].criteres.proximite).toBeUndefined();
  });

  it("neutralise le curseur Proximité sans repère", () => {
    const poids = { ...POIDS_PAR_DEFAUT, proximite: 80 };
    expect(poidsEffectifs(poids, null).proximite).toBe(0);
    expect(poidsEffectifs(poids, { lat: 45, lon: 5, nom: "x" }).proximite).toBe(80);
  });

  it("encode et décode un repère commune ou un point", () => {
    const lookup = (code: string) => (code === "64122" ? { nom: "Biarritz", lat: 43.4832, lon: -1.5586 } : undefined);
    expect(encoderRepere({ lat: 43.4832, lon: -1.5586, nom: "Biarritz", codeInsee: "64122" })).toBe("64122");
    expect(decoderRepere("64122", lookup)).toEqual({ lat: 43.4832, lon: -1.5586, nom: "Biarritz", codeInsee: "64122" });
    expect(decoderRepere("45.1234,5.6789", lookup)).toEqual({ lat: 45.1234, lon: 5.6789, nom: "Point sur la carte" });
    expect(decoderRepere("00000", lookup)).toBeNull();
    expect(decoderRepere("12,50", lookup)).toBeNull();
    expect(decoderRepere(undefined, lookup)).toBeNull();
  });
});
