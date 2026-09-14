/**
 * Moteur de classement de la version publiée, transcrit en JavaScript simple.
 *
 * L'artefact est un fichier autonome, sans build ni TypeScript : ce module est
 * donc une transcription littérale de `src/lib/scoring.ts` et `src/lib/format.ts`.
 * `src/lib/artefact.test.ts` compare les deux sur le jeu de données réel et pour
 * plusieurs jeux de curseurs — une divergence casse la suite de tests, parce
 * qu'une démonstration qui classerait autrement que l'application serait pire
 * qu'une absence de démonstration.
 */

export const CRITERES = [
  {
    id: "immobilier",
    libelle: "Prix immobilier",
    description: "Position calculée sur le prix médian au m² des appartements et des maisons.",
  },
  {
    id: "securite",
    libelle: "Sécurité",
    description:
      "Position calculée sur quatre indicateurs publiés : violences hors cadre familial, vols sans violence, cambriolages, dégradations.",
  },
  {
    id: "ecoles",
    libelle: "Écoles",
    description:
      "Position calculée sur la densité d'établissements et le taux de réussite au brevet.",
  },
  {
    id: "transports",
    libelle: "Transports",
    description: "Position calculée sur la distance à la gare la plus proche.",
  },
  {
    id: "emploi",
    libelle: "Emploi & revenus",
    description:
      "Position calculée sur le taux de chômage au sens du recensement, le niveau de vie médian et le taux de pauvreté (INSEE).",
  },
  {
    id: "sante",
    libelle: "Santé",
    description:
      "Position calculée sur l'accessibilité aux médecins généralistes (APL, DREES), qui tient compte des communes voisines.",
  },
  {
    id: "quotidien",
    libelle: "Commerces & services",
    description:
      "Position calculée sur le nombre de types de commerces et services de proximité présents dans la commune (gamme de proximité de l'INSEE, hors santé, enseignement et transports).",
  },
  {
    id: "fiscalite",
    libelle: "Fiscalité locale",
    curseur: false,
    description: "Position calculée sur le taux global de taxe foncière sur les propriétés bâties appliqué dans la commune.",
  },
  {
    id: "proximite",
    libelle: "Proximité",
    description: "Position calculée sur la distance à vol d'oiseau entre le centre de la commune et le repère choisi.",
  },
  {
    id: "risques",
    libelle: "Risques naturels",
    curseur: false,
    description:
      "Position calculée sur le nombre de reconnaissances de l'état de catastrophe naturelle depuis 1982 (Géorisques, base GASPAR).",
  },
  {
    id: "climat",
    libelle: "Climat",
    description:
      "Position calculée sur la durée annuelle d'insolation de la station Météo-France la plus proche (normale 1991-2020).",
  },
];

export const POIDS_MIN = 0;
export const POIDS_MAX = 100;
export const POIDS_PAR_DEFAUT = Object.fromEntries(CRITERES.map((c) => [c.id, 0]));

export function libellePoids(poids) {
  if (poids <= 0) return "Ignorer";
  if (poids < 25) return "Accessoire";
  if (poids < 50) return "Utile";
  if (poids < 75) return "Important";
  if (poids < 100) return "Très important";
  return "Décisif";
}

// ------------------------------------------------------------------ positions

function mesuresDe(commune, critere) {
  return (commune.criteres[critere] && commune.criteres[critere].mesures) || [];
}

/** Index du premier élément d'un tableau trié croissant qui soit >= v. */
function borneInferieure(trie, v) {
  let bas = 0;
  let haut = trie.length;
  while (bas < haut) {
    const milieu = (bas + haut) >>> 1;
    if (trie[milieu] < v) bas = milieu + 1;
    else haut = milieu;
  }
  return bas;
}

/** Index du premier élément d'un tableau trié croissant qui soit > v. */
function borneSuperieure(trie, v) {
  let bas = 0;
  let haut = trie.length;
  while (bas < haut) {
    const milieu = (bas + haut) >>> 1;
    if (trie[milieu] <= v) bas = milieu + 1;
    else haut = milieu;
  }
  return bas;
}

/**
 * Situe chaque commune d'un échantillon par rapport aux autres, pour une seule
 * mesure — en triant une fois (O(n log n)) puis en localisant chaque commune
 * par recherche dichotomique, plutôt qu'en la comparant une à une à toutes les
 * autres (O(n²)) : seule façon de rester praticable à l'échelle nationale.
 * Un échantillon de moins de deux valeurs renvoie une correspondance vide.
 */
function situerTous(echantillon) {
  const resultats = new Map();
  const autres = echantillon.length - 1;
  if (autres < 1) return resultats;

  const trie = echantillon.map((e) => e.valeur).sort((a, b) => a - b);

  for (const entree of echantillon) {
    const inf = borneInferieure(trie, entree.valeur);
    const sup = borneSuperieure(trie, entree.valeur);
    const countMoins = inf;
    const countEgal = sup - inf;
    const countPlus = trie.length - sup;

    const devancees = entree.sens === "bas" ? countPlus : countMoins;
    const devancantes = entree.sens === "bas" ? countMoins : countPlus;
    const exAequo = countEgal - 1;

    resultats.set(entree.code, {
      fraction: (devancees + exAequo * 0.5) / autres,
      effectif: trie.length,
      devancees,
      devancantes,
      exAequo,
      autres,
    });
  }

  return resultats;
}

export function construireReferentiel(communes) {
  const positions = {};
  const positionsCriteres = {};

  for (const commune of communes) {
    positions[commune.codeInsee] = {};
    positionsCriteres[commune.codeInsee] = {};
  }

  for (const critere of CRITERES) {
    const idsMesures = new Set();
    for (const commune of communes) {
      for (const mesure of mesuresDe(commune, critere.id)) idsMesures.add(mesure.id);
    }

    for (const idMesure of idsMesures) {
      const echantillon = [];
      for (const commune of communes) {
        const mesure = mesuresDe(commune, critere.id).find((m) => m.id === idMesure);
        if (mesure && mesure.valeur !== null && Number.isFinite(mesure.valeur)) {
          echantillon.push({ code: commune.codeInsee, valeur: mesure.valeur, sens: mesure.sens });
        }
      }
      const situees = situerTous(echantillon);
      for (const commune of communes) {
        positions[commune.codeInsee][idMesure] = situees.get(commune.codeInsee) ?? null;
      }
    }

    for (const commune of communes) {
      const classantes = mesuresDe(commune, critere.id).filter((m) => m.classante);
      const dispo = classantes
        .map((m) => positions[commune.codeInsee][m.id])
        .filter((p) => p !== null && p !== undefined);
      positionsCriteres[commune.codeInsee][critere.id] = dispo.length
        ? {
            fraction: dispo.reduce((s, p) => s + p.fraction, 0) / dispo.length,
            effectif: Math.min(...dispo.map((p) => p.effectif)),
            mesuresRetenues: dispo.length,
            mesuresAttendues: classantes.length,
          }
        : null;
    }
  }

  return { positions, positionsCriteres };
}

export function classer(communes, referentiel, poids) {
  const lignes = communes.map((commune) => {
    let numerateur = 0;
    let denominateur = 0;
    const criteresIgnores = [];
    const criteresPartiels = [];
    const brut = [];

    for (const critere of CRITERES) {
      const p = poids[critere.id] || 0;
      const position =
        referentiel.positionsCriteres[commune.codeInsee] &&
        referentiel.positionsCriteres[commune.codeInsee][critere.id];
      if (!position) {
        if (p > 0) criteresIgnores.push(critere.id);
        continue;
      }
      if (p <= 0) continue;
      if (position.mesuresRetenues < position.mesuresAttendues) criteresPartiels.push(critere.id);
      numerateur += p * position.fraction;
      denominateur += p;
      brut.push({ critere: critere.id, fraction: position.fraction, poids: p });
    }

    const score = denominateur > 0 ? numerateur / denominateur : 0;
    const contributions = brut
      .map((b) => ({
        critere: b.critere,
        fraction: b.fraction,
        part: numerateur > 0 ? (b.poids * b.fraction) / numerateur : 0,
      }))
      .sort((a, b) => b.part - a.part);

    return { commune, score, criteresIgnores, criteresPartiels, contributions, rang: 0 };
  });

  lignes.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.commune.nom.localeCompare(b.commune.nom, "fr");
  });
  lignes.forEach((ligne, i) => {
    ligne.rang = i + 1;
  });
  return lignes;
}

export function aucunePriorite(poids) {
  return CRITERES.every((c) => (poids[c.id] || 0) <= 0);
}

// ------------------------------------------------------------------ formatage

/** Espace fine insécable, construite depuis son point de code. */
const NBSP = String.fromCharCode(0x202f);

export function nombre(valeur, decimales = 0) {
  return valeur
    .toLocaleString("fr-FR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    .replace(/\s/g, NBSP);
}

export function valeurMesure(mesure) {
  if (mesure.valeur === null) {
    if (mesure.statut === "secret_statistique" || mesure.statut === "seuil_diffusion") return "Non publié";
    if (mesure.statut === "sans_objet") return "Sans objet";
    if (mesure.statut === "echantillon_insuffisant") return "Échantillon trop faible";
    return "Non disponible";
  }
  const brut = nombre(mesure.valeur, mesure.decimales || 0);
  const n = mesure.signe && mesure.valeur > 0 ? `+${brut}` : brut;
  if (!mesure.unite) return n;
  return n + NBSP + mesure.unite;
}

const SEUIL_EX_AEQUO = 0.1;

export function phraseComparative(mesure, position) {
  if (!position || mesure.valeur === null || mesure.comparable === false) return null;

  const { devancees, devancantes, exAequo, autres } = position;
  if (autres < 1) return null;
  const part = (n) => Math.round((n / autres) * 100);

  if (devancees === 0 && devancantes === 0) {
    return `même valeur que les ${autres} autres villes comparées`;
  }

  const devance = devancees >= devancantes;
  const pourcentage = part(devance ? devancees : devancantes);
  if (pourcentage === 0) return null;

  const verbe = devance ? mesure.comparatif.mieux : mesure.comparatif.pire;
  const phrase = `${verbe} ${pourcentage}${NBSP}% des autres villes comparées`;

  return exAequo / autres >= SEUIL_EX_AEQUO
    ? `${phrase}, à égalité avec ${part(exAequo)}${NBSP}%`
    : phrase;
}

export function dateCourte(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Mesure mise en avant sur une ligne, en évitant les valeurs absentes. */
export function mesureVedette(mesures) {
  const renseignee = (m) => m.valeur !== null;
  return (
    mesures.find((m) => m.vedette && renseignee(m)) ||
    mesures.find((m) => m.classante && renseignee(m)) ||
    mesures.find(renseignee) ||
    mesures.find((m) => m.vedette) ||
    mesures[0]
  );
}
