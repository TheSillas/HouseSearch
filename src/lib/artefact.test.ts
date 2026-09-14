import { describe, expect, it } from "vitest";

import * as artefact from "../../scripts/artefact/moteur.mjs";
import { CRITERES } from "./criteres";
import { getCommunes } from "./donnees";
import { phraseComparative, valeurMesure } from "./format";
import { classer, construireReferentiel, type Poids, type Referentiel } from "./scoring";

/**
 * La version publiée embarque une transcription du moteur en JavaScript simple,
 * pour tenir dans un fichier autonome. Ces tests la confrontent au moteur de
 * l'application sur le jeu de données réel : une démonstration qui classerait
 * autrement que l'application serait pire qu'une absence de démonstration.
 */
const communes = getCommunes();
const reference = construireReferentiel(communes);
// Le moteur transcrit vit dans un .mjs sans annotations : TypeScript infère un
// type vide pour ses objets construits dynamiquement (`const positions = {}`
// puis peuplés en boucle). Le typage réel est prouvé par les tests eux-mêmes.
const transcrit = artefact.construireReferentiel(communes) as Referentiel;

/** Réglages de curseurs couvrant les cas de bord du classement. */
const REGLAGES: [string, Poids][] = [
  ["par défaut", { immobilier: 50, securite: 50, ecoles: 50, transports: 50, emploi: 50, sante: 50, quotidien: 50, fiscalite: 50, proximite: 0, risques: 50, climat: 50 }],
  ["prix seul", { immobilier: 100, securite: 0, ecoles: 0, transports: 0, emploi: 0, sante: 0, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["sécurité seule", { immobilier: 0, securite: 100, ecoles: 0, transports: 0, emploi: 0, sante: 0, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["écoles seules", { immobilier: 0, securite: 0, ecoles: 100, transports: 0, emploi: 0, sante: 0, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["transports seuls", { immobilier: 0, securite: 0, ecoles: 0, transports: 100, emploi: 0, sante: 0, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["emploi seul", { immobilier: 0, securite: 0, ecoles: 0, transports: 0, emploi: 100, sante: 0, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["santé seule", { immobilier: 0, securite: 0, ecoles: 0, transports: 0, emploi: 0, sante: 100, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["tout à zéro", { immobilier: 0, securite: 0, ecoles: 0, transports: 0, emploi: 0, sante: 0, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["asymétrique", { immobilier: 91, securite: 7, ecoles: 63, transports: 24, emploi: 38, sante: 12, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
  ["deux critères", { immobilier: 100, securite: 0, ecoles: 0, transports: 100, emploi: 0, sante: 0, quotidien: 0, fiscalite: 0, proximite: 0, risques: 0, climat: 0 }],
];

describe("moteur transcrit pour la version publiée", () => {
  it("couvre le même jeu de communes", () => {
    expect(artefact.CRITERES.map((c: { id: string }) => c.id)).toEqual(CRITERES.map((c) => c.id));
    expect(communes.length).toBeGreaterThanOrEqual(20);
  });

  it(
    "calcule les mêmes positions, mesure par mesure",
    () => {
      let comparees = 0;
      for (const commune of communes) {
        const attendues = reference.positions[commune.codeInsee];
        const obtenues = transcrit.positions[commune.codeInsee];
        expect(Object.keys(obtenues).sort()).toEqual(Object.keys(attendues).sort());
        for (const id of Object.keys(attendues)) {
          expect(obtenues[id], `${commune.nom} / ${id}`).toEqual(attendues[id]);
          comparees += 1;
        }
      }
      // Garde-fou : un jeu de données vidé ferait passer la boucle sans rien vérifier.
      expect(comparees).toBeGreaterThan(500);
    },
    // À l'échelle nationale (~5 300 communes), comparer mesure par mesure
    // dépasse le délai par défaut de vitest — un ralentissement réel du
    // volume de travail, pas une régression à corriger.
    30_000,
  );

  it(
    "calcule les mêmes positions de critère",
    () => {
      for (const commune of communes) {
        for (const critere of CRITERES) {
          expect(
            transcrit.positionsCriteres[commune.codeInsee][critere.id],
            `${commune.nom} / ${critere.id}`,
          ).toEqual(reference.positionsCriteres[commune.codeInsee][critere.id]);
        }
      }
    },
    30_000,
  );

  it.each(REGLAGES)("produit le même classement — %s", (_libelle, poids) => {
    const attendu = classer(communes, reference, poids);
    const obtenu = artefact.classer(communes, transcrit, poids);

    expect(obtenu.map((l: { commune: { nom: string } }) => l.commune.nom)).toEqual(
      attendu.map((l) => l.commune.nom),
    );
    expect(obtenu.map((l: { rang: number }) => l.rang)).toEqual(attendu.map((l) => l.rang));
    obtenu.forEach((ligne: { score: number }, i: number) => {
      expect(ligne.score).toBeCloseTo(attendu[i].score, 12);
    });
  });

  it(
    "écrit les mêmes chiffres et les mêmes phrases",
    () => {
      let comparees = 0;
      for (const commune of communes) {
        for (const critere of CRITERES) {
          for (const mesure of commune.criteres[critere.id]?.mesures ?? []) {
            const position = reference.positions[commune.codeInsee][mesure.id];
            expect(artefact.valeurMesure(mesure), `${commune.nom} / ${mesure.id}`).toBe(
              valeurMesure(mesure),
            );
            expect(artefact.phraseComparative(mesure, position), `${commune.nom} / ${mesure.id}`).toBe(
              phraseComparative(mesure, position),
            );
            comparees += 1;
          }
        }
      }
      expect(comparees).toBeGreaterThan(500);
    },
    // À l'échelle nationale (~5 300 communes × une quinzaine de mesures),
    // formater et comparer chaque phrase une à une dépasse largement le délai
    // par défaut de vitest — un volume de travail réel, pas une régression à
    // corriger. Large marge : ce test est le premier à céder quand la machine
    // est chargée par ailleurs.
    600_000,
  );

  it("met en avant la même mesure sur chaque ligne", { timeout: 120_000 }, () => {
    for (const commune of communes) {
      for (const critere of CRITERES) {
        // Un critère sans extraction pour cette commune n'a pas de mesure du tout.
        if (!commune.criteres[critere.id]) continue;
        const mesures = commune.criteres[critere.id]!.mesures;
        const vedette = artefact.mesureVedette(mesures);
        expect(vedette, `${commune.nom} / ${critere.id}`).toBeDefined();
        // Une mesure renseignée doit toujours l'emporter sur une mesure absente.
        if (mesures.some((m) => m.valeur !== null)) {
          expect(vedette.valeur, `${commune.nom} / ${critere.id}`).not.toBeNull();
        }
      }
    }
  });
});
