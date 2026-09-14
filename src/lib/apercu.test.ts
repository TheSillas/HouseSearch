import { describe, expect, it } from "vitest";

import { construireApercu, PAGE_CLASSEMENT } from "./apercu";
import { TOLERANCE_PAR_DEFAUT } from "./couverture";
import { CRITERES_PRIORITES, POIDS_PAR_DEFAUT } from "./criteres";
import { getCommunes, getNoyau } from "./donnees";
import { classer, construireReferentiel } from "./scoring";

/**
 * L'aperçu embarqué dans la page d'accueil doit être exactement ce que le
 * navigateur recalculera une fois le noyau chargé : mêmes lignes, même ordre,
 * mêmes positions pour les barres. Sinon l'écran changerait sous les yeux de
 * l'utilisateur au moment où les curseurs deviennent actifs.
 */
describe("aperçu du classement", { timeout: 120_000 }, () => {
  const noyau = getNoyau();
  // Les poids par défaut sont tous nuls (carte neutre) : on teste avec toutes
  // les priorités à « Important », le réglage qu'un utilisateur obtient en les
  // montant toutes.
  const POIDS_ACTIFS = { ...POIDS_PAR_DEFAUT, ...Object.fromEntries(CRITERES_PRIORITES.map((c) => [c.id, 50])) };

  it("reproduit le classement complet, tronqué à une page", () => {
    const apercu = construireApercu(noyau, {
      poids: POIDS_ACTIFS,
      filtres: {},
      departements: [],
      couverture: TOLERANCE_PAR_DEFAUT,
    });
    const communes = getCommunes();
    const referentiel = construireReferentiel(communes);
    const complet = classer(communes, referentiel, POIDS_ACTIFS);
    // Sans tolérance, seules les communes renseignées sur les six critères sont classées.
    const attendues = complet.filter((l) => l.criteresIgnores.length === 0);

    expect(apercu.nbCommunes).toBe(communes.length);
    expect(apercu.lignes.length).toBe(PAGE_CLASSEMENT);
    expect(apercu.nbClassees).toBe(attendues.length);
    expect(apercu.lignes.map((l) => l.commune.codeInsee)).toEqual(
      attendues.slice(0, PAGE_CLASSEMENT).map((l) => l.commune.codeInsee),
    );
    for (const ligne of apercu.lignes) {
      expect(apercu.referentiel.positions[ligne.commune.codeInsee]).toEqual(
        referentiel.positions[ligne.commune.codeInsee],
      );
    }
    expect(apercu.exclues.sousCouverture).toBe(complet.length - attendues.length);
    expect(apercu.empreinte).toBe(noyau.empreinte);
  });

  it("respecte une localisation et un poids nul comme le navigateur", () => {
    const poids = { ...POIDS_ACTIFS, immobilier: 0, securite: 0 };
    const apercu = construireApercu(noyau, { poids, filtres: {}, departements: ["67"], couverture: 0 });
    expect(apercu.lignes.every((l) => l.commune.departement === "67")).toBe(true);
    // Prix et sécurité désactivés : un village sans ces données devient classable.
    expect(apercu.nbClassees).toBeGreaterThan(300);
    expect(apercu.exclues.horsLocalisation).toBe(apercu.nbCommunes - apercu.nbClassees - apercu.exclues.sousCouverture);
  });
});
