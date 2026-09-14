import { describe, expect, it } from "vitest";

import { aucunePriorite, classer, construireReferentiel, type Poids } from "./scoring";
import type { Commune, CritereDonnees, CritereId, Mesure, Sens } from "./types";

const SOURCE = {
  nom: "Source de test",
  producteur: "Test",
  url: "https://example.invalid",
  annee: "2024",
};

function mesure(
  id: string,
  valeur: number | null,
  sens: Sens = "bas",
  classante = true,
): Mesure {
  return {
    id,
    libelle: id,
    valeur,
    unite: "u",
    sens,
    classante,
    comparatif: { mieux: "mieux que", pire: "moins bien que" },
  };
}

function critere(mesures: Mesure[]): CritereDonnees {
  return { mesures, source: SOURCE, methodologie: "", caveats: [] };
}

/** Commune de test : on ne renseigne que les mesures utiles au cas testé. */
function commune(
  nom: string,
  mesuresParCritere: Partial<Record<CritereId, Mesure[]>>,
): Commune {
  const criteres = {} as Record<CritereId, CritereDonnees>;
  for (const [id, mesures] of Object.entries(mesuresParCritere)) {
    criteres[id as CritereId] = critere(mesures as Mesure[]);
  }
  return {
    codeInsee: nom,
    slug: nom.toLowerCase(),
    nom,
    population: 1000,
    anneePopulation: 2023,
    departement: "69",
    criteres,
    politique: { scrutins: [] },
  };
}

const poidsDe = (partiel: Partial<Poids>): Poids => ({
  immobilier: 0,
  securite: 0,
  ecoles: 0,
  transports: 0,
  emploi: 0,
  sante: 0,
  quotidien: 0,
  fiscalite: 0,
  proximite: 0,
  risques: 0,
  climat: 0,
  ...partiel,
});

describe("positions relatives", () => {
  it("place la meilleure valeur devant toutes les autres", () => {
    const communes = [
      commune("A", { immobilier: [mesure("prix", 1000)] }),
      commune("B", { immobilier: [mesure("prix", 2000)] }),
      commune("C", { immobilier: [mesure("prix", 3000)] }),
    ];
    const ref = construireReferentiel(communes);

    expect(ref.positions.A.prix?.fraction).toBe(1);
    expect(ref.positions.B.prix?.fraction).toBe(0.5);
    expect(ref.positions.C.prix?.fraction).toBe(0);
    expect(ref.positions.A.prix?.effectif).toBe(3);
  });

  it("inverse la lecture quand une valeur haute est préférable", () => {
    const communes = [
      commune("A", { transports: [mesure("lignes", 1, "haut")] }),
      commune("B", { transports: [mesure("lignes", 9, "haut")] }),
    ];
    const ref = construireReferentiel(communes);

    expect(ref.positions.B.lignes?.fraction).toBe(1);
    expect(ref.positions.A.lignes?.fraction).toBe(0);
  });

  it("partage les ex-æquo en demi-victoires", () => {
    const communes = [
      commune("A", { immobilier: [mesure("prix", 10)] }),
      commune("B", { immobilier: [mesure("prix", 10)] }),
      commune("C", { immobilier: [mesure("prix", 20)] }),
    ];
    const ref = construireReferentiel(communes);

    // A devance C (1) et partage avec B (0,5), sur 2 comparaisons possibles.
    expect(ref.positions.A.prix?.fraction).toBe(0.75);
    expect(ref.positions.B.prix?.fraction).toBe(0.75);
    expect(ref.positions.C.prix?.fraction).toBe(0);
  });

  it("place tout le monde au milieu quand toutes les valeurs sont égales", () => {
    const communes = ["A", "B", "C"].map((n) =>
      commune(n, { immobilier: [mesure("prix", 42)] }),
    );
    const ref = construireReferentiel(communes);

    for (const n of ["A", "B", "C"]) {
      expect(ref.positions[n].prix?.fraction).toBe(0.5);
    }
  });

  it("exclut les valeurs absentes du calcul au lieu de les remplacer", () => {
    const communes = [
      commune("A", { immobilier: [mesure("prix", 1000)] }),
      commune("B", { immobilier: [mesure("prix", null)] }),
      commune("C", { immobilier: [mesure("prix", 3000)] }),
    ];
    const ref = construireReferentiel(communes);

    expect(ref.positions.B.prix).toBeNull();
    // L'effectif ne compte que les communes réellement renseignées.
    expect(ref.positions.A.prix?.effectif).toBe(2);
    expect(ref.positions.A.prix?.fraction).toBe(1);
  });

  it("moyenne les mesures classantes d'un même critère et ignore les autres", () => {
    const communes = [
      commune("A", {
        ecoles: [
          mesure("densite", 9, "haut"), // meilleure : 1
          mesure("reussite", 50, "haut"), // moins bonne : 0
          mesure("contexte", 1, "haut", false), // non classante : ignorée
        ],
      }),
      commune("B", {
        ecoles: [
          mesure("densite", 1, "haut"),
          mesure("reussite", 90, "haut"),
          mesure("contexte", 9, "haut", false),
        ],
      }),
    ];
    const ref = construireReferentiel(communes);

    expect(ref.positionsCriteres.A.ecoles?.fraction).toBe(0.5);
    expect(ref.positionsCriteres.B.ecoles?.fraction).toBe(0.5);
    // La mesure non classante existe bien, mais ne pèse pas sur le critère.
    expect(ref.positions.A.contexte?.fraction).toBe(0);
  });
});

describe("classement pondéré", () => {
  const communes = [
    commune("Chere", {
      immobilier: [mesure("prix", 5000)],
      securite: [mesure("taux", 10)],
    }),
    commune("Abordable", {
      immobilier: [mesure("prix", 1000)],
      securite: [mesure("taux", 90)],
    }),
  ];
  const ref = construireReferentiel(communes);

  it("suit le curseur levé", () => {
    const surLePrix = classer(communes, ref, poidsDe({ immobilier: 100 }));
    expect(surLePrix[0].commune.nom).toBe("Abordable");

    const surLaSecurite = classer(communes, ref, poidsDe({ securite: 100 }));
    expect(surLaSecurite[0].commune.nom).toBe("Chere");
  });

  it("ignore un critère dont le curseur est à zéro", () => {
    const lignes = classer(communes, ref, poidsDe({ immobilier: 100, securite: 0 }));
    expect(lignes[0].contributions.map((c) => c.critere)).toEqual(["immobilier"]);
  });

  it("numérote les rangs de façon continue", () => {
    const lignes = classer(communes, ref, poidsDe({ immobilier: 50 }));
    expect(lignes.map((l) => l.rang)).toEqual([1, 2]);
  });

  it("ne pénalise pas une commune sans donnée, mais le signale", () => {
    const avecTrou = [
      commune("Complete", {
        immobilier: [mesure("prix", 3000)],
        securite: [mesure("taux", 50)],
      }),
      commune("Incomplete", {
        immobilier: [mesure("prix", 1000)],
        securite: [mesure("taux", null)],
      }),
    ];
    const refTrou = construireReferentiel(avecTrou);
    const lignes = classer(avecTrou, refTrou, poidsDe({ immobilier: 100, securite: 100 }));

    const incomplete = lignes.find((l) => l.commune.nom === "Incomplete")!;
    expect(incomplete.criteresIgnores).toEqual(["securite"]);
    // Son score ne repose que sur l'immobilier, où elle est première.
    expect(incomplete.score).toBe(1);
    expect(incomplete.rang).toBe(1);
  });

  it("ne signale pas de critère écarté quand son curseur est à zéro", () => {
    const avecTrou = [
      commune("A", { immobilier: [mesure("prix", 1000)], securite: [mesure("taux", null)] }),
      commune("B", { immobilier: [mesure("prix", 2000)], securite: [mesure("taux", 5)] }),
    ];
    const refTrou = construireReferentiel(avecTrou);
    const lignes = classer(avecTrou, refTrou, poidsDe({ immobilier: 100, securite: 0 }));

    expect(lignes.every((l) => l.criteresIgnores.length === 0)).toBe(true);
  });

  it("départage les scores identiques par ordre alphabétique, sans hasard", () => {
    const exAequo = [
      commune("Zoe", { immobilier: [mesure("prix", 1000)] }),
      commune("Alice", { immobilier: [mesure("prix", 1000)] }),
    ];
    const refEx = construireReferentiel(exAequo);
    const lignes = classer(exAequo, refEx, poidsDe({ immobilier: 100 }));

    expect(lignes.map((l) => l.commune.nom)).toEqual(["Alice", "Zoe"]);
  });

  it("répartit les contributions au prorata du poids et de la position", () => {
    const lignes = classer(communes, ref, poidsDe({ immobilier: 100, securite: 100 }));
    for (const ligne of lignes) {
      const total = ligne.contributions.reduce((s, c) => s + c.part, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });
});

describe("aucunePriorite", () => {
  it("détecte l'état où le classement n'a pas de sens", () => {
    expect(aucunePriorite(poidsDe({}))).toBe(true);
    expect(aucunePriorite(poidsDe({ ecoles: 1 }))).toBe(false);
  });
});

describe("garde-fous du jeu de données", () => {
  it("refuse deux critères qui partagent un identifiant de mesure", () => {
    const ambigu = [
      commune("A", {
        immobilier: [mesure("taux", 10)],
        securite: [mesure("taux", 20)],
      }),
    ];
    expect(() => construireReferentiel(ambigu)).toThrow(/identifiant/i);
  });
});

describe("décomptes réels de communes", () => {
  it("distingue les communes devancées, devançantes et à égalité", () => {
    // Trois communes sans gare, deux avec : la commune sans gare est à égalité
    // avec deux autres et devancée par deux, elle n'en devance aucune.
    const communes = [
      commune("Sans1", { transports: [mesure("gares", 0, "haut")] }),
      commune("Sans2", { transports: [mesure("gares", 0, "haut")] }),
      commune("Sans3", { transports: [mesure("gares", 0, "haut")] }),
      commune("Une", { transports: [mesure("gares", 1, "haut")] }),
      commune("Deux", { transports: [mesure("gares", 2, "haut")] }),
    ];
    const p = construireReferentiel(communes).positions.Sans1.gares!;

    expect(p.devancees).toBe(0);
    expect(p.devancantes).toBe(2);
    expect(p.exAequo).toBe(2);
    expect(p.autres).toBe(4);
    // Le rang milieu reste utilisable pour trier, sans prétendre à un décompte.
    expect(p.fraction).toBe(0.25);
  });

  it("ne situe pas une mesure renseignée pour une seule commune", () => {
    const communes = [
      commune("A", { immobilier: [mesure("prix", 1000)] }),
      commune("B", { immobilier: [mesure("prix", null)] }),
    ];
    const ref = construireReferentiel(communes);

    // Une position médiane par défaut serait un chiffre inventé.
    expect(ref.positions.A.prix).toBeNull();
    expect(ref.positionsCriteres.A.immobilier).toBeNull();
  });
});

describe("critère classé sur une partie de ses mesures", () => {
  // Trois communes : « brevet » doit rester comparable entre deux d'entre elles,
  // sinon la mesure serait ecartee faute d'echantillon et le test ne testerait
  // plus le cas voulu.
  const avecTrou = [
    commune("Complete", {
      ecoles: [mesure("densite", 5, "haut"), mesure("brevet", 90, "haut")],
    }),
    commune("Autre", {
      ecoles: [mesure("densite", 1, "haut"), mesure("brevet", 80, "haut")],
    }),
    commune("SansBrevet", {
      ecoles: [mesure("densite", 9, "haut"), mesure("brevet", null, "haut")],
    }),
  ];
  const ref = construireReferentiel(avecTrou);

  it("compte les mesures retenues et attendues", () => {
    expect(ref.positionsCriteres.SansBrevet.ecoles).toMatchObject({
      mesuresRetenues: 1,
      mesuresAttendues: 2,
    });
    expect(ref.positionsCriteres.Complete.ecoles).toMatchObject({
      mesuresRetenues: 2,
      mesuresAttendues: 2,
    });
  });

  it("classe quand même la commune, mais le signale", () => {
    const lignes = classer(avecTrou, ref, poidsDe({ ecoles: 100 }));
    const partielle = lignes.find((l) => l.commune.nom === "SansBrevet")!;

    expect(partielle.criteresIgnores).toEqual([]);
    expect(partielle.criteresPartiels).toEqual(["ecoles"]);
    // Elle est première sur la seule mesure qui lui reste.
    expect(partielle.rang).toBe(1);
  });

  it("ne signale rien quand toutes les mesures sont là", () => {
    const lignes = classer(avecTrou, ref, poidsDe({ ecoles: 100 }));
    expect(lignes.find((l) => l.commune.nom === "Complete")!.criteresPartiels).toEqual([]);
  });
});

describe("passage à l'échelle nationale", () => {
  /**
   * Un jeu de test de quelques dizaines de communes tolère n'importe quel
   * algorithme. Ce projet a vocation à couvrir la France entière — plusieurs
   * milliers de communes : ce test fabrique un jeu de cette taille et vérifie
   * que le calcul reste largement praticable (O(n log n), pas O(n²)).
   */
  function grandJeu(n: number): Commune[] {
    // Valeurs pseudo-aléatoires mais déterministes (pas de Math.random, pour
    // un test reproductible), avec des doublons volontaires (n % 7) pour
    // exercer aussi le chemin des ex-æquo à cette échelle.
    return Array.from({ length: n }, (_, i) =>
      commune(`Commune-${i}`, {
        immobilier: [mesure("prix", (i % 7) * 100 + 1000), mesure("prix2", i * 3)],
        securite: [
          mesure("s1", (i * 13) % 500, "bas"),
          mesure("s2", (i * 29) % 700, "bas"),
          mesure("s3", (i * 41) % 900, "bas"),
        ],
        ecoles: [mesure("reussite", (i * 17) % 100, "haut")],
        transports: [mesure("gare", (i % 11) * 250, "bas")],
      }),
    );
  }

  it("reste rapide à l'échelle de plusieurs milliers de communes", () => {
    const communes = grandJeu(6000);

    const debut = performance.now();
    const ref = construireReferentiel(communes);
    const dureeReferentiel = performance.now() - debut;

    const debutClassement = performance.now();
    const lignes = classer(communes, ref, poidsDe({ immobilier: 60, securite: 40 }));
    const dureeClassement = performance.now() - debutClassement;

    expect(lignes).toHaveLength(6000);
    // Généreux par rapport aux temps réels observés (quelques dizaines de ms) :
    // le but est d'attraper une régression vers O(n²), pas de chronométrer la machine.
    expect(dureeReferentiel).toBeLessThan(3000);
    expect(dureeClassement).toBeLessThan(1000);
  });

  it("produit un classement identique à un calcul O(n²) de référence, sur un échantillon", () => {
    // Ne recalcule pas naïvement les 6000 communes (ce serait le O(n²) qu'on
    // évite précisément) : vérifie plutôt la cohérence interne sur un extrait,
    // en comparant chaque position à un décompte fait à la main.
    const communes = grandJeu(500);
    const ref = construireReferentiel(communes);

    for (const c of [communes[0], communes[123], communes[499]]) {
      const valeur = c.criteres.ecoles!.mesures[0].valeur!;
      const toutes = communes.map((x) => x.criteres.ecoles!.mesures[0].valeur!);
      // sens "haut" : une valeur plus grande est meilleure, donc je devance
      // les communes dont la valeur est plus PETITE que la mienne.
      const devanceesAttendues = toutes.filter((v) => v < valeur).length;
      const exAequoAttendus = toutes.filter((v) => v === valeur).length - 1;

      const position = ref.positions[c.codeInsee]["reussite"]!;
      expect(position.devancees).toBe(devanceesAttendues);
      expect(position.exAequo).toBe(exAequoAttendus);
    }
  });
});
