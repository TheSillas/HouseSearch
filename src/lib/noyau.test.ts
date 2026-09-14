import { describe, expect, it } from "vitest";

import { getCommunes, getCommunesCompletes, getNoyau } from "./donnees";
import { communesDepuisNoyau } from "./noyau";
import { construireReferentiel } from "./scoring";

/**
 * Le noyau national (colonnes) et les jeux départementaux (fiches complètes)
 * sont deux écritures des mêmes données. Le classement se calcule sur le
 * premier, la fiche lit le second : ils doivent dire exactement la même chose
 * sur chaque mesure qui classe, pour chaque commune — sinon la phrase de la
 * fiche et le rang de l'accueil pourraient diverger.
 */
describe("noyau national", () => {
  const noyau = getNoyau();
  const depuisNoyau = communesDepuisNoyau(noyau);
  const completes = getCommunesCompletes();
  const parCode = new Map(completes.map((c) => [c.codeInsee, c]));

  it("couvre toutes les communes des jeux départementaux, une fois chacune", () => {
    expect(depuisNoyau.length).toBe(completes.length);
    expect(new Set(depuisNoyau.map((c) => c.codeInsee)).size).toBe(completes.length);
    expect(new Set(depuisNoyau.map((c) => c.slug)).size).toBe(completes.length);
  });

  // 34 746 communes × 6 critères : quelques secondes, bien au-delà du délai par défaut.
  it("porte les mêmes critères et les mêmes valeurs classantes que les fiches", { timeout: 120_000 }, () => {
    for (const c of depuisNoyau) {
      const complete = parCode.get(c.codeInsee)!;
      expect(complete, c.codeInsee).toBeDefined();
      expect(c.nom).toBe(complete.nom);
      expect(c.departement).toBe(complete.departement);
      expect(c.population).toBe(complete.population);
      for (const id of noyau.criteres) {
        const a = c.criteres[id];
        const b = complete.criteres[id];
        expect(Boolean(a), `${c.nom} / ${id} : présence`).toBe(Boolean(b));
        if (!a || !b) continue;
        const attendues = b.mesures.filter((m) => m.classante || m.vedette);
        expect(
          a.mesures.map((m) => [m.id, m.valeur, m.unite]),
          `${c.nom} / ${id}`,
        ).toEqual(attendues.map((m) => [m.id, m.valeur, m.unite]));
      }
    }
  });

  it("donne les mêmes positions que les fiches complètes", { timeout: 120_000 }, () => {
    const refNoyau = construireReferentiel(getCommunes());
    const refCompletes = construireReferentiel(completes);
    for (const c of depuisNoyau.filter((_, i) => i % 97 === 0)) {
      expect(refNoyau.positionsCriteres[c.codeInsee], c.nom).toEqual(refCompletes.positionsCriteres[c.codeInsee]);
    }
  });
});
