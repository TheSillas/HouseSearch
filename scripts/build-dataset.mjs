#!/usr/bin/env node
/**
 * Normalise les extractions brutes en un jeu de données prêt pour l'application.
 *
 *   data/raw/<region>/*.json  ->  data/dist/<region>.json (format compact v2)
 *
 *   node scripts/build-dataset.mjs [region]     # "metropole-lyon" par défaut
 *
 * Ce script ne calcule aucune valeur métier : il choisit quelles mesures sont
 * *classantes*, les habille (libellé, unité, sens de lecture, phrase
 * comparative) et recopie les chiffres tels que les extractions les ont
 * produits. Une valeur absente reste absente.
 *
 * Une région par exécution. Le nom de zone affiché (`ZONE`) est lu depuis le
 * champ `zone` de `data/raw/<region>/referentiel.json` — jamais recopié en dur
 * ici, pour qu'ajouter une région ne demande de toucher qu'un seul endroit.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REGION_SLUG = process.argv[2] ?? "metropole-lyon";
const RAW = path.join(RACINE, "data", "raw", REGION_SLUG);
const REDACTION = path.join(RAW, "redaction");
// Hors de `src/` : le jeu complet n'est plus importé statiquement mais lu à la
// demande par le serveur (voir src/lib/regions.ts) ; le classement passe par le
// noyau national compact produit ensuite par build-noyau.mjs.
const SORTIE = path.join(RACINE, "data", "dist", `${REGION_SLUG}.json`);

if (!existsSync(RAW)) {
  console.error(
    `Aucune extraction trouvée pour la région « ${REGION_SLUG} » (répertoire ${RAW} absent).\n` +
      `Régions disponibles : node -e "console.log(require('fs').readdirSync('data/raw'))"`,
  );
  process.exit(1);
}

/**
 * Le référentiel produit des notes de lignage (mouvements du Code officiel
 * géographique, anciens codes INSEE) destinées au raccordement des données, pas
 * au lecteur. On ne conserve donc que ce qui change la lecture des chiffres
 * pour quelqu'un qui compare des communes, réécrit pour lui.
 */
const NOTES_AFFICHEES = {
  "69149":
    "Commune nouvelle née le 1er janvier 2024 de la fusion d'Oullins et de Pierre-Bénite. Les données antérieures à 2024 ont été reconstituées en additionnant les deux anciennes communes.",
  "69123":
    "Les chiffres portent sur la commune entière, ses neuf arrondissements confondus. Les écarts entre arrondissements y sont donc lissés.",
  "69091":
    "Commune de la Métropole de Lyon détachée du cœur d'agglomération, à son extrémité sud : à lire en gardant en tête sa distance à Lyon.",
};

// --------------------------------------------------------------- utilitaires

async function lireJson(fichier, obligatoire = true) {
  if (!existsSync(fichier)) {
    if (obligatoire) throw new Error(`Fichier requis introuvable : ${fichier}`);
    return null;
  }
  return JSON.parse(await readFile(fichier, "utf8"));
}

/** Toute valeur non finie devient null : jamais 0, jamais NaN dans la sortie. */
function num(valeur) {
  return valeur === null || valeur === undefined || !Number.isFinite(valeur) ? null : valeur;
}

function arrondir(valeur, decimales) {
  if (valeur === null || !Number.isFinite(valeur)) return null;
  const f = 10 ** decimales;
  return Math.round(valeur * f) / f;
}

const fr = (n) => (n === null || n === undefined ? "" : n.toLocaleString("fr-FR"));

/** En francais, zero et un restent au singulier : « 0 gare », « 1 gare », « 2 gares ». */
const accord = (valeur, singulier) =>
  valeur !== null && valeur !== undefined && Math.abs(valeur) >= 2 ? singulier + "s" : singulier;

/**
 * Enumeration bornee : au-dela de quelques elements, une liste exhaustive de
 * codes de ligne devient du bruit dans une carte. Les codes non renseignes par
 * le producteur sont ecartes plutot qu'affiches tels quels.
 */
function enumerer(elements, maxi, singulier) {
  const propres = (elements ?? []).filter((e) => e && e !== "INCONNU");
  if (propres.length === 0) return null;
  if (propres.length <= maxi) return propres.join(", ");
  return `${propres.slice(0, maxi).join(", ")} et ${propres.length - maxi} ${accord(propres.length - maxi, singulier)}`;
}

function slugifier(nom) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** L'unité de compte du SSMSI (victime, infraction, véhicule…) vit dans le libellé d'unité. */
function uniteDeCompte(unites, champ) {
  const m = /unit[ée] de compte\s*:\s*([^)]+)\)/i.exec(unites?.[champ] ?? "");
  return m ? m[1].trim() : null;
}

const COMPARATIFS = {
  prix: { mieux: "moins cher que", pire: "plus cher que" },
  exposition: { mieux: "moins exposée que", pire: "plus exposée que" },
  equipement: { mieux: "mieux équipée que", pire: "moins bien équipée que" },
  reussite: { mieux: "meilleur taux que", pire: "moins bon taux que" },
  rapidite: { mieux: "plus proche que", pire: "plus éloignée que" },
  desserte: { mieux: "mieux desservie que", pire: "moins bien desservie que" },
  chomage: { mieux: "moins de chômage que", pire: "plus de chômage que" },
  niveauDeVie: { mieux: "niveau de vie plus élevé que", pire: "niveau de vie plus bas que" },
  pauvrete: { mieux: "moins de pauvreté que", pire: "plus de pauvreté que" },
  acces: { mieux: "meilleur accès aux soins que", pire: "moins bon accès aux soins que" },
  dotation: { mieux: "mieux dotée que", pire: "moins dotée que" },
  imposition: { mieux: "moins imposée que", pire: "plus imposée que" },
  ensoleillement: { mieux: "plus ensoleillée que", pire: "moins ensoleillée que" },
  neutre: { mieux: "au-dessus de", pire: "en dessous de" },
};

function mesure(id, libelle, valeur, opts = {}) {
  const m = {
    id,
    libelle,
    valeur: num(valeur),
    unite: opts.unite ?? "",
    sens: opts.sens ?? "bas",
    classante: Boolean(opts.classante),
    comparatif: opts.comparatif ?? COMPARATIFS.neutre,
  };
  if (opts.court) m.libelleCourt = opts.court;
  if (opts.vedette) m.vedette = true;
  if (opts.decimales !== undefined) m.decimales = opts.decimales;
  if (opts.comparable === false) m.comparable = false;
  if (opts.signe) m.signe = true;
  if (opts.precision) m.precision = opts.precision;
  if (opts.repartition?.length) m.repartition = opts.repartition;
  if (opts.statut && m.valeur === null) m.statut = opts.statut;
  if (opts.maille) m.maille = opts.maille;
  if (opts.historique) m.historique = opts.historique;
  if (opts.source) m.source = opts.source;
  return m;
}

/**
 * Convertit une série brute `[{ annee, valeur }, ...]` en historique affichable.
 * Exige au moins trois points renseignés : une courbe à un ou deux points ne dit
 * rien d'une évolution, et l'historique est alors omis plutôt qu'affiché creux.
 */
function historiser(points) {
  if (!Array.isArray(points) || points.length === 0) return undefined;
  const trie = [...points]
    .map((p) => ({ annee: p.annee, valeur: num(p.valeur) }))
    .sort((a, b) => a.annee - b.annee);
  const renseignes = trie.filter((p) => p.valeur !== null).length;
  return renseignes >= 3 ? trie : undefined;
}

/** Les libellés de licence vont de « lov2 » à trois lignes de prose : on tranche. */
function normaliserLicence(licence) {
  if (!licence) return undefined;
  const l = licence.toLowerCase();
  if (l.includes("non specifiee") || l.includes("non spécifiée")) return "licence non spécifiée";
  if (l.includes("odbl")) return l.includes("ouverte") ? "Licence Ouverte 2.0 et ODbL" : "ODbL";
  if (l.includes("lov2") || l.includes("licence ouverte") || l.includes("etalab")) {
    return "Licence Ouverte 2.0";
  }
  return licence.split("|")[0].trim().slice(0, 60);
}

/**
 * La source affichée est volontairement plus courte que la source technique :
 * les extractions produisent des libellés de plusieurs lignes, illisibles dans
 * une carte. Le détail complet reste dans data/sources/*.md.
 */
function source(brute, redaction) {
  const affichee = redaction?.sourceAffichee;
  return {
    nom: affichee?.nom ?? brute.nom,
    nomCourt: affichee?.nomCourt ?? brute.nomCourt,
    producteur: affichee?.producteur ?? brute.producteur,
    url: (brute.url ?? "").split("|")[0].trim(),
    annee: affichee?.annee ?? String(brute.annee),
    licence: normaliserLicence(brute.licence),
    consulteLe: brute.consulteLe,
  };
}

function critere(mesures, brute, redaction) {
  return {
    mesures: mesures.filter(Boolean),
    source: source(brute.source, redaction),
    methodologie: redaction?.methodologie ?? brute.methodologie ?? "",
    caveats: redaction?.caveats ?? brute.caveats ?? [],
  };
}

// ------------------------------------------------------------------ critères

/**
 * Loyers d'annonce estimés (« Carte des loyers », DHUP/ANIL) : l'autre moitié
 * du coût du logement, et la seule donnée disponible pour l'Alsace-Moselle et
 * Mayotte, hors DVF. Source propre à chaque mesure (elle diffère de celle du
 * critère), maille déclarée quand l'estimation n'est pas communale.
 */
function mesuresLoyers(code, loyers) {
  if (!loyers) return [];
  const l = loyers.communes[code];
  const src = loyers.source
    ? {
        nom: loyers.source.nom,
        producteur: loyers.source.producteur,
        url: loyers.source.url,
        annee: loyers.source.annee,
        licence: loyers.source.licence,
        consulteLe: loyers.source.consulteLe,
      }
    : undefined;
  const precision = (bas, haut, nbCommune, nbMaille) => {
    if (bas === null || haut === null) return undefined;
    const annonces =
      nbCommune !== null
        ? `${fr(nbCommune)} annonce${nbCommune > 1 ? "s" : ""} observée${nbCommune > 1 ? "s" : ""} dans la commune${
            nbMaille !== null && nbMaille !== nbCommune ? `, ${fr(nbMaille)} dans sa maille` : ""
          }`
        : null;
    return [`intervalle de prédiction ${fr(bas, 1)} – ${fr(haut, 1)} €/m²`, annonces].filter(Boolean).join(" · ");
  };
  const maille = (niveau) =>
    niveau === "maille" ? "« groupe de communes voisines » (estimation du modèle faute d'annonces suffisantes)" : undefined;
  const commun = {
    unite: "€/m²/mois",
    sens: "bas",
    classante: true,
    decimales: 1,
    comparatif: COMPARATIFS.prix,
    source: src,
  };
  return [
    mesure("immo-loyer-appartement", "Loyer d'annonce estimé au m², appartements", l?.loyerM2Appartement ?? null, {
      ...commun,
      court: "Loyer appart.",
      precision: l ? precision(l.loyerM2AppartementBas, l.loyerM2AppartementHaut, l.nbAnnoncesAppartementCommune, l.nbAnnoncesAppartementMaille) : undefined,
      maille: maille(l?.loyerM2AppartementNiveau),
      statut: l ? undefined : "indisponible",
    }),
    mesure("immo-loyer-maison", "Loyer d'annonce estimé au m², maisons", l?.loyerM2Maison ?? null, {
      ...commun,
      court: "Loyer maison",
      precision: l ? precision(l.loyerM2MaisonBas, l.loyerM2MaisonHaut, l.nbAnnoncesMaisonCommune, l.nbAnnoncesMaisonMaille) : undefined,
      maille: maille(l?.loyerM2MaisonNiveau),
      statut: l ? undefined : "indisponible",
    }),
  ];
}

function batirImmobilier(code, brut, redaction, historique, loyers) {
  const d = brut.communes[code];
  if (!d) return undefined;

  const ventes = (n) => (n ? `médiane calculée sur ${fr(n)} ventes de 2021 à 2025` : undefined);
  const compare = (a2024, a2025) =>
    a2024 && a2025 ? `médiane 2025 de ${fr(a2025)} €/m², contre ${fr(a2024)} €/m² en 2024` : undefined;
  const h = historique?.communes[code];

  // Le dernier point de la série (2025) et le millésime 2025 déjà affiché à
  // part (mesure « dont médiane 2025 ») viennent de la même source, non
  // recalculée : un écart signalerait une désynchronisation entre les deux
  // extractions, pas une nuance méthodologique légitime.
  const verifierDernierPoint = (points, attendu, libelle) => {
    if (!points || attendu === null || attendu === undefined) return;
    const dernier = points[points.length - 1];
    if (dernier.annee === 2025 && dernier.valeur !== null && Math.abs(dernier.valeur - attendu) > 0.5) {
      throw new Error(
        `Immobilier ${code} ${libelle} : dernier point de l'historique (${dernier.valeur}) ` +
          `≠ millésime 2025 (${attendu})`,
      );
    }
  };
  const histApp = historiser(h?.appartement);
  const histMaison = historiser(h?.maison);
  verifierDernierPoint(histApp, d.prixM2MedianAppartement2025, "appartement");
  verifierDernierPoint(histMaison, d.prixM2MedianMaison2025, "maison");

  return critere(
    [
      mesure("immo-appartement", "Prix médian au m², appartements", d.prixM2MedianAppartement, {
        court: "Prix appart.",
        unite: "€/m²",
        sens: "bas",
        classante: true,
        vedette: true,
        decimales: 0,
        precision: ventes(d.nbTransactionsAppartement),
        statut: d.prixM2MedianAppartement_statut,
        comparatif: COMPARATIFS.prix,
        historique: histApp,
      }),
      mesure("immo-maison", "Prix médian au m², maisons", d.prixM2MedianMaison, {
        court: "Prix maison",
        unite: "€/m²",
        sens: "bas",
        classante: true,
        decimales: 0,
        precision: ventes(d.nbTransactionsMaison),
        statut: d.prixM2MedianMaison_statut,
        comparatif: COMPARATIFS.prix,
        historique: histMaison,
      }),
      ...mesuresLoyers(code, loyers),
      mesure("immo-appartement-2025", "dont médiane 2025, appartements", d.prixM2MedianAppartement2025, {
        unite: "€/m²",
        sens: "bas",
        decimales: 0,
        precision: d.nbTransactionsAppartement2025
          ? `${fr(d.nbTransactionsAppartement2025)} ventes en 2025`
          : undefined,
        comparatif: COMPARATIFS.prix,
      }),
      // Une hausse de prix n'est ni bonne ni mauvaise en soi : elle arrange le
      // vendeur et dessert l'acheteur. On montre donc le chiffre, jamais un rang.
      mesure("immo-evolution-appartement", "Évolution sur un an, appartements", d.evolution1anPct, {
        unite: "%",
        sens: "bas",
        comparable: false,
        signe: true,
        decimales: 1,
        statut: d.evolution1anPct_statut,
        precision: compare(d.prixM2MedianAppartement2024, d.prixM2MedianAppartement2025),
      }),
      mesure("immo-evolution-maison", "Évolution sur un an, maisons", d.evolution1anMaisonPct, {
        unite: "%",
        sens: "bas",
        comparable: false,
        signe: true,
        decimales: 1,
        statut: d.evolution1anMaisonPct_statut,
        precision: compare(d.prixM2MedianMaison2024, d.prixM2MedianMaison2025),
      }),
    ],
    brut,
    redaction,
  );
}

/**
 * Les indicateurs du SSMSI n'ont ni la même unité de compte ni le même
 * dénominateur : les additionner n'aurait aucun sens. On classe donc sur
 * plusieurs indicateurs publiés tels quels, dont les *positions* sont ensuite
 * moyennées — jamais les valeurs.
 */
const INDICATEURS_SECURITE = [
  {
    id: "secu-violences-hors-famille",
    champ: "tauxViolencesPhysiquesHorsCadreFamilial",
    nb: "nbViolencesPhysiquesHorsCadreFamilial",
    historiqueChamp: "violencesHorsFamille",
    libelle: "Violences physiques hors cadre familial, pour 1 000 habitants",
    court: "Violences",
    classante: true,
    vedette: true,
  },
  {
    id: "secu-vols-sans-violence",
    champ: "tauxVolsSansViolenceContrePersonnes",
    nb: "nbVolsSansViolenceContrePersonnes",
    historiqueChamp: "volsSansViolence",
    libelle: "Vols sans violence contre les personnes, pour 1 000 habitants",
    classante: true,
  },
  {
    id: "secu-cambriolages",
    champ: "tauxCambriolagesLogement",
    nb: "nbCambriolagesLogement",
    historiqueChamp: "cambriolages",
    libelle: "Cambriolages de logement, pour 1 000 logements",
    classante: true,
  },
  {
    id: "secu-degradations",
    champ: "tauxDestructionsDegradations",
    nb: "nbDestructionsDegradations",
    historiqueChamp: "degradations",
    libelle: "Destructions et dégradations, pour 1 000 habitants",
    classante: true,
  },
  {
    id: "secu-violences-intrafamiliales",
    champ: "tauxViolencesPhysiquesIntrafamiliales",
    nb: "nbViolencesPhysiquesIntrafamiliales",
    libelle: "Violences physiques intrafamiliales, pour 1 000 habitants",
  },
  {
    id: "secu-violences-sexuelles",
    champ: "tauxViolencesSexuelles",
    nb: "nbViolencesSexuelles",
    libelle: "Violences sexuelles, pour 1 000 habitants",
  },
  {
    id: "secu-vols-violents",
    champ: "tauxVolsViolentsSansArme",
    nb: "nbVolsViolentsSansArme",
    libelle: "Vols violents sans arme, pour 1 000 habitants",
  },
  {
    id: "secu-vols-vehicule",
    champ: "tauxVolsDeVehicule",
    nb: "nbVolsDeVehicule",
    libelle: "Vols de véhicule, pour 1 000 habitants",
  },
  {
    id: "secu-vols-dans-vehicule",
    champ: "tauxVolsDansLesVehicules",
    nb: "nbVolsDansLesVehicules",
    libelle: "Vols dans les véhicules, pour 1 000 habitants",
  },
  {
    id: "secu-trafic-stupefiants",
    champ: "tauxTraficStupefiants",
    nb: "nbTraficStupefiants",
    libelle: "Trafic de stupéfiants, pour 1 000 habitants",
  },
  {
    id: "secu-escroqueries",
    champ: "tauxEscroqueriesFraudesMoyensPaiement",
    nb: "nbEscroqueriesFraudesMoyensPaiement",
    libelle: "Escroqueries et fraudes aux moyens de paiement, pour 1 000 habitants",
  },
];

function batirSecurite(code, brut, redaction, historique) {
  const d = brut.communes[code];
  if (!d) return undefined;
  const h = historique?.communes[code];

  const mesures = INDICATEURS_SECURITE.map((i) => {
    const compte = num(d[i.nb]);
    const uc = uniteDeCompte(brut.unites, i.champ);
    const hist = i.historiqueChamp ? historiser(h?.[i.historiqueChamp]) : undefined;

    // Ici, contrairement à l'immobilier, la valeur affichée EST le millésime
    // 2025 : le dernier point de la série doit donc coïncider exactement.
    if (hist) {
      const dernier = hist[hist.length - 1];
      const attendu = num(d[i.champ]);
      if (dernier.annee === 2025 && dernier.valeur !== null && attendu !== null && Math.abs(dernier.valeur - attendu) > 0.05) {
        throw new Error(
          `Sécurité ${code} ${i.id} : dernier point de l'historique (${dernier.valeur}) ≠ valeur 2025 (${attendu})`,
        );
      }
    }

    return mesure(i.id, i.libelle, d[i.champ], {
      court: i.court,
      // « ‰ » n'est lisible que par qui connaît déjà ce symbole rare : la
      // même unité que le libellé décrit en toutes lettres, plutôt qu'un
      // signe qu'il faut déjà connaître pour comprendre le chiffre.
      unite: i.libelle.includes("logements") ? "pour 1 000 logements" : "pour 1 000 hab.",
      sens: "bas",
      classante: i.classante,
      vedette: i.vedette,
      decimales: 1,
      statut: d[`${i.champ}_statut`],
      precision:
        compte !== null
          ? `${fr(compte)} enregistrés en 2025${uc ? ` — décompte par ${uc}` : ""}`
          : undefined,
      comparatif: COMPARATIFS.exposition,
      historique: hist,
    });
  });

  return critere(mesures, brut, redaction);
}

function batirEcoles(code, brut, redaction, population) {
  const d = brut.communes[code];
  if (!d) return undefined;

  const etablissements =
    d.ecolesTotal === null || d.ecolesTotal === undefined
      ? null
      : (d.ecolesTotal ?? 0) + (d.colleges ?? 0) + (d.lycees ?? 0);
  const densite =
    etablissements !== null && population > 0
      ? arrondir((etablissements / population) * 10000, 1)
      : null;

  // Ventilation en clair, telle que la BPE la compte : une école peut être à
  // la fois maternelle et élémentaire (école primaire), d'où « dont ».
  const pluriel = (n, mot) => `${fr(n)} ${mot}${n > 1 ? "s" : ""}`;
  const ecoles =
    d.ecolesTotal !== null && d.ecolesTotal !== undefined
      ? `${pluriel(d.ecolesTotal, "école")}${
          d.ecolesTotal > 0 && d.ecolesMaternelles != null && d.ecolesElementaires != null
            ? ` (dont ${fr(d.ecolesMaternelles)} maternelle${d.ecolesMaternelles > 1 ? "s" : ""}, ${fr(d.ecolesElementaires)} élémentaire${d.ecolesElementaires > 1 ? "s" : ""})`
            : ""
        }`
      : null;
  const lycees =
    d.lycees !== null && d.lycees !== undefined
      ? `${pluriel(d.lycees, "lycée")}${
          d.lycees > 0 && d.lyceesGeneralTechno != null && d.lyceesProfessionnels != null
            ? ` (${fr(d.lyceesGeneralTechno)} général ou technologique, ${fr(d.lyceesProfessionnels)} professionnel)`
            : ""
        }`
      : null;
  const detail = [ecoles, d.colleges != null ? pluriel(d.colleges, "collège") : null, lycees]
    .filter(Boolean)
    .join(" · ");

  return critere(
    [
      // La donnée vedette est le décompte concret — ce qu'on cherche quand on
      // lit « écoles » — avec sa ventilation. Un décompte ne se compare pas
      // entre une ville et un village : il n'est ni classant ni comparable ;
      // c'est la densité, juste en dessous, qui classe et donne la position.
      mesure("ecoles-etablissements", "Établissements scolaires publics et privés", etablissements, {
        court: "Établissements",
        unite: accord(etablissements, "établissement"),
        sens: "haut",
        classante: false,
        vedette: true,
        comparable: false,
        decimales: 0,
        precision: detail || undefined,
        comparatif: COMPARATIFS.equipement,
      }),
      mesure("ecoles-densite", "Établissements scolaires rapportés à la population", densite, {
        court: "Établissements / 10 000 hab.",
        unite: "pour 10 000 hab.",
        sens: "haut",
        classante: true,
        decimales: 1,
        precision: "Le même décompte, rapporté à la population : c'est ce qui permet de comparer un village et une ville.",
        comparatif: COMPARATIFS.equipement,
      }),
      mesure("ecoles-dnb", "Réussite au brevet des collèges", d.tauxReussiteDnb, {
        court: "Réussite brevet",
        unite: "%",
        sens: "haut",
        classante: true,
        decimales: 1,
        precision: d.nbCandidatsDnb
          ? `${fr(d.nbCandidatsDnb)} candidats, session 2025, dans ${fr(d.nbCollegesEvaluesDnb)} collège${d.nbCollegesEvaluesDnb > 1 ? "s" : ""} de la commune`
          : undefined,
        comparatif: COMPARATIFS.reussite,
      }),
      mesure("ecoles-bac", "Réussite au baccalauréat", d.tauxReussiteBac, {
        unite: "%",
        sens: "haut",
        decimales: 1,
        precision: d.nbPresentsBac
          ? `${fr(d.nbPresentsBac)} présents, session 2025, dans ${fr(d.nbLyceesEvaluesBac)} lycée${d.nbLyceesEvaluesBac > 1 ? "s" : ""} de la commune${d.voiesBacEvaluees ? ` — voies ${d.voiesBacEvaluees}` : ""}`
          : undefined,
        comparatif: COMPARATIFS.reussite,
      }),
      mesure("ecoles-va-dnb", "Valeur ajoutée au brevet, écart au taux attendu", d.vaDnb, {
        unite: "pts",
        sens: "haut",
        decimales: 1,
        precision: "Écart entre le taux constaté et le taux attendu au vu du profil des élèves (DEPP).",
      }),
      mesure("ecoles-va-bac", "Valeur ajoutée au baccalauréat, écart au taux attendu", d.vaBac, {
        unite: "pts",
        sens: "haut",
        decimales: 1,
      }),
    ],
    brut,
    redaction,
  );
}

/**
 * Le critère Transports ne classe plus que sur la distance à la gare la plus
 * proche (source SNCF, nationale — voir `docs/decisions.md` §4). L'ancien
 * référentiel SYTRAL (`transports.json`, arrêts/lignes/gares de la Métropole
 * de Lyon) n'existe donc que pour cette seule région : `brut` vaut `null`
 * ailleurs, et les trois mesures informatives qui en dépendent sont alors
 * simplement absentes plutôt que fabriquées.
 */
function batirTransports(code, brut, redaction, gareProche) {
  const g = gareProche?.communes[code];
  // « dans la commune » se lit dans la phrase elle-même : pas besoin d'un
  // Oui/Non séparé, la distance nulle-ou-non le dit déjà, en toutes lettres.
  const precisionGare = g
    ? g.dansLaCommune
      ? `Gare de ${g.gare}, dans la commune`
      : `Gare de ${g.gare} (${g.communeGare}), hors commune`
    : undefined;

  const gareLaPlusProche = mesure(
    "transp-gare-proche",
    "Distance à la gare la plus proche",
    g ? g.distanceM / 1000 : null,
    {
      court: "Gare la plus proche",
      unite: "km",
      sens: "bas",
      classante: true,
      vedette: true,
      decimales: 1,
      precision: precisionGare,
      comparatif: COMPARATIFS.rapidite,
    },
  );

  const d = brut?.communes[code];
  if (!d) {
    // Pas de référentiel SYTRAL pour cette région : seule la mesure nationale
    // existe, sourcée depuis l'extraction gare-proche elle-même.
    if (!gareProche) return undefined;
    return critere([gareLaPlusProche], gareProche, redaction);
  }

  return critere(
    [
      gareLaPlusProche,
      // « Lignes régulières desservant la commune » a été retirée : elle
      // venait du référentiel SYTRAL, propre à la Métropole de Lyon. Il
      // n'existe pas de source équivalente et unifiée à l'échelle nationale
      // (chaque agglomération a sa propre autorité de transport et son propre
      // flux GTFS) ; plutôt qu'une mesure présente ici et absente ailleurs,
      // le critère Transports ne classe désormais que sur la distance à la
      // gare la plus proche. Les trois mesures suivantes (arrêts, gares,
      // lignes scolaires) restent affichées à titre informatif pour cette
      // région, mais partagent la même limite SYTRAL — sauf « Gares de
      // voyageurs », dont la source (SNCF) est déjà nationale — et devront
      // être retirées ou retravaillées région par région le jour où d'autres
      // territoires seront peuplés.
      mesure("transp-arrets", "Points d'arrêt implantés dans la commune", d.nb_arrets_tc, {
        unite: accord(d.nb_arrets_tc, "arrêt"),
        sens: "haut",
        decimales: 0,
        comparatif: COMPARATIFS.desserte,
      }),
      mesure("transp-gares", "Gares de voyageurs", d.nb_gares_ferroviaires, {
        unite: accord(d.nb_gares_ferroviaires, "gare"),
        sens: "haut",
        decimales: 0,
        precision: (() => {
          const gares = enumerer(d.gares, 4, "autre");
          if (!gares) return undefined;
          const nbLignes = (d.lignes_ferroviaires ?? []).filter((l) => l && l !== "INCONNU").length;
          if (nbLignes === 0) return gares;
          const lignes =
            nbLignes <= 5
              ? `${accord(nbLignes, "ligne")} ${enumerer(d.lignes_ferroviaires, 5, "autre")}`
              : `${fr(nbLignes)} ${accord(nbLignes, "ligne")} ferroviaires`;
          return `${gares} — ${lignes}`;
        })(),
        comparatif: COMPARATIFS.desserte,
      }),
      // Comptees a part par le producteur, et sans direction favorable : en
      // avoir davantage ne dit rien de la qualite de la desserte.
      mesure("transp-lignes-scolaires", "Lignes scolaires, comptées à part", d.nb_lignes_scolaires, {
        unite: accord(d.nb_lignes_scolaires, "ligne"),
        sens: "haut",
        comparable: false,
        decimales: 0,
      }),
    ],
    brut,
    redaction,
  );
}

// ----------------------------------------------------------------- politique

/** Un jeu de résultats du ministère par scrutin, pour citer la bonne ressource. */
function sourceScrutin(brut, usageContient, nom, annee) {
  const jeu = (brut.source.jeux ?? []).find((j) => j.usage.includes(usageContient));
  return {
    nom,
    producteur: "Ministère de l'Intérieur",
    url: jeu?.urlPage ?? brut.source.url,
    annee,
    licence: normaliserLicence(jeu?.licence),
    consulteLe: brut.source.consulteLe,
  };
}

function resultatsListes(listes, nuances, maxi) {
  return (listes ?? []).slice(0, maxi).map((l) => {
    const r = {
      libelle: l.libelleListe,
      nuance: l.nuance,
      pourcentage: num(l.pctExprimes) ?? 0,
    };
    const libelleNuance = nuances?.[l.nuance];
    if (libelleNuance) r.nuanceLibelle = libelleNuance;
    if (num(l.voix) !== null) r.voix = l.voix;
    if (l.teteDeListe) r.precision = `Tête de liste : ${l.teteDeListe}`;
    return r;
  });
}

function batirPolitique(code, brut, nuances) {
  const d = brut.communes[code];
  if (!d) return { scrutins: [] };

  const nuMun = nuances?.scrutins?.mun2026?.nuances;
  const nuEur = nuances?.scrutins?.eur2024?.nuances;
  const scrutins = [];

  // --- Municipales 2026, tour décisif -------------------------------------
  const tour = d.mun2026_tourDecisif;
  if (tour) {
    const p = `mun2026_t${tour}_`;
    const notes = [];
    if (tour === 1) notes.push("Conseil municipal élu dès le premier tour.");
    if (d[`${p}nbListes`] > 4) {
      notes.push(`${d[`${p}nbListes`]} listes étaient en présence ; les quatre premières sont affichées.`);
    }
    scrutins.push({
      id: "mun2026",
      nom: "Élections municipales 2026",
      date: d[`${p}date`] ?? d.mun2026_dateTourDecisif,
      tour: tour === 1 ? "1er tour, décisif" : "2e tour, décisif",
      participation: num(d[`${p}participationPct`]),
      inscrits: num(d[`${p}inscrits`]),
      resultats: resultatsListes(d[`${p}listes`], nuMun, 4),
      source: sourceScrutin(
        brut,
        tour === 1 ? "municipales 2026 - 1er tour" : "municipales 2026 - 2nd tour",
        "Élections municipales 2026, résultats par commune",
        "scrutin des 15 et 22 mars 2026",
      ),
      note: notes.join(" ") || undefined,
    });
  }

  // --- Européennes 2024 ----------------------------------------------------
  if (d.eur2024_listes?.length) {
    scrutins.push({
      id: "eur2024",
      nom: "Élections européennes 2024",
      date: d.eur2024_date,
      participation: num(d.eur2024_participationPct),
      inscrits: num(d.eur2024_inscrits),
      resultats: resultatsListes(d.eur2024_listes, nuEur, 5),
      source: sourceScrutin(
        brut,
        "europeennes 2024",
        "Élections européennes 2024, résultats définitifs par commune",
        "scrutin du 9 juin 2024",
      ),
      note: d.eur2024_nbListes
        ? `${d.eur2024_nbListes} listes étaient en présence ; les cinq premières sont affichées.`
        : undefined,
    });
  }

  // --- Présidentielle 2022, second tour ------------------------------------
  if (d.pres2022_t2_candidats?.length) {
    const notes = [];
    if (Array.isArray(d.pres2022_agregeDepuis) && d.pres2022_agregeDepuis.length > 1) {
      notes.push(
        `Résultat reconstitué en additionnant les communes ${d.pres2022_agregeDepuis.join(" et ")}, fusionnées depuis. Ce total n'est pas publié tel quel par le ministère.`,
      );
    }
    scrutins.push({
      id: "pres2022-t2",
      nom: "Élection présidentielle 2022",
      tour: "2e tour",
      date: d.pres2022_t2_date,
      participation: num(d.pres2022_t2_participationPct),
      inscrits: num(d.pres2022_t2_inscrits),
      resultats: (d.pres2022_t2_candidats ?? []).map((c) => ({
        libelle: `${c.prenom} ${c.nom}`,
        pourcentage: num(c.pctExprimes) ?? 0,
        voix: num(c.voix) ?? undefined,
      })),
      source: sourceScrutin(
        brut,
        "presidentielle 2022 - 2nd tour",
        "Élection présidentielle 2022, résultats du second tour par commune",
        "scrutin du 24 avril 2022",
      ),
      note: notes.join(" ") || undefined,
    });
  }

  const politique = { scrutins };

  if (d.maire_nom) {
    const elu = {
      nom: `${d.maire_prenom ?? ""} ${d.maire_nom}`.trim(),
      source: sourceScrutin(
        brut,
        "nom du maire",
        "Répertoire national des élus",
        "version du 11 août 2026",
      ),
    };
    // `.trim()` : la date arrive avec le retour chariot de la dernière colonne
    // d'un CSV en fins de ligne CRLF, ce qui la rendait illisible pour `Date`.
    if (d.maire_dateDebutFonction) elu.depuis = String(d.maire_dateDebutFonction).trim();
    // La nuance appartient à la LISTE, pas à la personne : on ne la rattache au
    // maire que s'il en était la tête, et jamais autrement.
    if (d.maire_estTeteDeListeArriveeEnTete && d.mun2026_nuanceListeArriveeEnTete) {
      elu.nuance = d.mun2026_nuanceListeArriveeEnTete;
      const libelle = nuMun?.[d.mun2026_nuanceListeArriveeEnTete];
      if (libelle) elu.nuanceLibelle = libelle;
    }
    politique.maire = elu;
  }

  return politique;
}

// ---------------------------------------------------- emploi, revenus, santé

/**
 * Emploi & revenus : le chômage et l'activité au sens du recensement (INSEE
 * RP 2022) et le niveau de vie médian et la pauvreté (Filosofi 2023, source
 * propre à ces mesures). Classent : le chômage, le
 * niveau de vie et la pauvreté. Un taux d'activité ou un nombre d'emplois
 * n'a pas de « bon » sens univoque : informatifs, jamais classants.
 */
function batirEmploi(code, brut, redaction) {
  const d = brut?.communes?.[code];
  if (!brut || !d) return undefined;
  const srcRevenus = brut.sourceRevenus ? source(brut.sourceRevenus) : undefined;
  const emplois = d.emploisAuLieuDeTravail != null ? Math.round(d.emploisAuLieuDeTravail) : null;
  const ratioEmplois =
    emplois !== null && d.actifsOccupes1564 ? Math.round((emplois / d.actifsOccupes1564) * 100) / 100 : null;

  return critere(
    [
      mesure("emploi-chomage", "Taux de chômage des 15-64 ans, au sens du recensement", d.tauxChomage1564, {
        court: "Chômage",
        unite: "%",
        sens: "bas",
        classante: true,
        vedette: true,
        decimales: 1,
        precision:
          d.chomeurs1564 != null && d.actifs1564 != null
            ? `${fr(Math.round(d.chomeurs1564))} personnes se déclarant au chômage pour ${fr(Math.round(d.actifs1564))} actifs de 15 à 64 ans, recensement 2022 (effectifs estimés)`
            : undefined,
        comparatif: COMPARATIFS.chomage,
      }),
      mesure("revenu-niveau-vie", "Niveau de vie médian", d.niveauDeVieMedian, {
        court: "Niveau de vie",
        unite: "€/an",
        sens: "haut",
        classante: true,
        decimales: 0,
        statut: d.niveauDeVieMedian_statut,
        precision:
          "revenu disponible par unité de consommation : la moitié des habitants vit avec moins, l'autre moitié avec plus (Filosofi 2023)",
        comparatif: COMPARATIFS.niveauDeVie,
        source: srcRevenus,
      }),
      mesure("revenu-pauvrete", "Taux de pauvreté", d.tauxPauvrete, {
        court: "Pauvreté",
        unite: "%",
        sens: "bas",
        classante: true,
        decimales: 1,
        statut: d.tauxPauvrete_statut,
        precision:
          "part des personnes vivant sous 60 % du niveau de vie médian national (Filosofi 2023)",
        comparatif: COMPARATIFS.pauvrete,
        source: srcRevenus,
      }),
      mesure("emploi-activite", "Taux d'activité des 15-64 ans", d.tauxActivite1564, {
        unite: "%",
        sens: "haut",
        comparable: false,
        decimales: 1,
        precision:
          d.actifs1564 != null && d.population1564 != null
            ? `${fr(Math.round(d.actifs1564))} actifs (en emploi ou au chômage) sur ${fr(Math.round(d.population1564))} habitants de 15 à 64 ans ; ${fr(Math.round(d.retraites1564 ?? 0))} retraités, ${fr(Math.round(d.etudiants1564 ?? 0))} élèves ou étudiants`
            : undefined,
      }),
      mesure("emploi-emplois", "Emplois situés dans la commune", emplois, {
        unite: "emplois",
        sens: "haut",
        comparable: false,
        decimales: 0,
        precision:
          ratioEmplois !== null
            ? `${fr(ratioEmplois)} emploi sur place pour 1 actif occupé qui y habite : au-dessus de 1, la commune attire des travailleurs d'ailleurs ; en dessous, ses habitants vont travailler ailleurs`
            : undefined,
      }),
      // Le rapport interdécile n'est plus diffusé à la commune dans Filosofi 2
      // (aucune valeur sur les 34 768 communes du millésime 2023) : pas de mesure.
    ],
    brut,
    redaction,
  );
}

/**
 * Santé : l'accès aux médecins généralistes (APL de la DREES, qui intègre les
 * communes voisines et l'activité réelle des médecins — la seule mesure qui
 * classe) et les équipements implantés sur la commune (BPE), informatifs.
 */
/** Spécialités médicales dénombrées par la BPE : champ, singulier, pluriel. */
const SPECIALISTES = [
  ["cardiologues", "cardiologue", "cardiologues"],
  ["radiologues", "radiologue", "radiologues"],
  ["ophtalmologues", "ophtalmologue", "ophtalmologues"],
  ["gastroEnterologues", "gastro-entérologue", "gastro-entérologues"],
  ["pneumologues", "pneumologue", "pneumologues"],
  ["anesthesistes", "anesthésiste-réanimateur", "anesthésistes-réanimateurs"],
  ["chirurgiensOrthopedistes", "chirurgien orthopédiste ou plasticien", "chirurgiens orthopédistes ou plasticiens"],
  ["psychiatres", "psychiatre", "psychiatres"],
  ["urologuesNephrologues", "urologue ou néphrologue", "urologues ou néphrologues"],
  ["gynecologues", "gynécologue", "gynécologues"],
  ["pediatres", "pédiatre", "pédiatres"],
  ["neurologues", "neurologue", "neurologues"],
  ["dermatologues", "dermatologue", "dermatologues"],
  ["orl", "oto-rhino-laryngologiste", "oto-rhino-laryngologistes"],
  ["stomatologues", "stomatologue", "stomatologues"],
  ["chirurgiensGeneraux", "chirurgien général", "chirurgiens généraux"],
  ["medecinsReadaptation", "médecin de médecine physique et réadaptation", "médecins de médecine physique et réadaptation"],
  ["rhumatologues", "rhumatologue", "rhumatologues"],
  ["endocrinologues", "endocrinologue", "endocrinologues"],
  ["geriatres", "gériatre", "gériatres"],
  ["hematologues", "hématologue", "hématologues"],
  ["oncologues", "oncologue ou anatomopathologiste", "oncologues ou anatomopathologistes"],
  ["allergologues", "allergologue", "allergologues"],
];
/** Autres professionnels de santé libéraux dénombrés par la BPE. */
const PARAMEDICAUX = [
  ["infirmiers", "infirmier", "infirmiers"],
  ["kinesitherapeutes", "masseur-kinésithérapeute", "masseurs-kinésithérapeutes"],
  ["psychologues", "psychologue", "psychologues"],
  ["pedicuresPodologues", "pédicure-podologue", "pédicures-podologues"],
  ["orthophonistes", "orthophoniste", "orthophonistes"],
  ["sagesFemmes", "sage-femme", "sages-femmes"],
  ["orthoptistes", "orthoptiste", "orthoptistes"],
  ["dieteticiens", "diététicien", "diététiciens"],
  ["psychomotriciens", "psychomotricien", "psychomotriciens"],
  ["ergotherapeutes", "ergothérapeute", "ergothérapeutes"],
  ["audioprothesistes", "audioprothésiste", "audioprothésistes"],
];

/** Postes nommés par effectif décroissant, zéros omis : [{ libelle: "cardiologues", effectif: 89 }, …]. */
function repartitionSante(d, table) {
  return table
    .map(([champ, sing, plur]) => ({ effectif: d[champ] ?? 0, libelle: (d[champ] ?? 0) > 1 ? plur : sing }))
    .filter((p) => p.effectif > 0)
    .sort((a, b) => b.effectif - a.effectif);
}

function batirSante(code, brut, redaction, population) {
  const d = brut?.communes?.[code];
  if (!brut || !d) return undefined;
  const specialistes = SPECIALISTES.reduce((n, [champ]) => n + (d[champ] ?? 0), 0);
  const pour10000 = (n) =>
    n != null && population > 0
      ? `soit ${fr(Math.round((n / population) * 100000) / 10)} pour 10 000 habitants`
      : undefined;
  const liste = (...parts) => parts.filter(Boolean).join(" · ");

  return critere(
    [
      mesure("sante-apl", "Accès aux médecins généralistes (APL)", d.aplMedecinsGeneralistes, {
        court: "Accès médecins",
        unite: "consult./an/hab.",
        sens: "haut",
        classante: true,
        vedette: true,
        decimales: 1,
        statut: d.aplMedecinsGeneralistes == null ? "indisponible" : undefined,
        precision:
          "consultations de médecine générale accessibles par an et par habitant, médecins des communes voisines compris et pondérés par la distance (DREES, 2024)",
        comparatif: COMPARATIFS.acces,
        source: brut.sourceApl ? source(brut.sourceApl) : undefined,
        // Trois points au moins (2022, 2023, 2024) : une commune nouvelle n'en a
        // parfois qu'un ou deux, la courbe est alors omise plutôt qu'affichée creuse.
        historique: historiser(d.aplHistorique),
      }),
      mesure("sante-medecins", "Médecins généralistes installés dans la commune", d.medecinsGeneralistes, {
        unite: accord(d.medecinsGeneralistes, "médecin"),
        sens: "haut",
        comparable: false,
        decimales: 0,
        precision: pour10000(d.medecinsGeneralistes),
      }),
      mesure("sante-specialistes", "Médecins spécialistes installés dans la commune", specialistes, {
        unite: accord(specialistes, "spécialiste"),
        sens: "haut",
        comparable: false,
        decimales: 0,
        // Toutes les spécialités que la BPE dénombre (professionnels libéraux et
        // salariés de centres de santé), telles que publiées, en liste compacte.
        precision: specialistes > 0 ? undefined : "aucune des 23 spécialités dénombrées par la BPE",
        repartition: repartitionSante(d, SPECIALISTES),
      }),
      mesure("sante-pharmacies", "Pharmacies", d.pharmacies, {
        unite: accord(d.pharmacies, "pharmacie"),
        sens: "haut",
        comparable: false,
        decimales: 0,
        precision: liste(
          d.laboratoires ? `${fr(d.laboratoires)} laboratoire${d.laboratoires > 1 ? "s" : ""} d'analyses` : null,
          d.maisonsDeSante ? `${fr(d.maisonsDeSante)} maison${d.maisonsDeSante > 1 ? "s" : ""} de santé pluridisciplinaire` : null,
          d.centresDeSante ? `${fr(d.centresDeSante)} centre${d.centresDeSante > 1 ? "s" : ""} de santé` : null,
        ) || undefined,
      }),
      mesure("sante-urgences", "Services d'urgences", d.servicesUrgences, {
        unite: accord(d.servicesUrgences, "service"),
        sens: "haut",
        comparable: false,
        decimales: 0,
        precision: liste(
          `${fr(d.etablissementsSoinsCourteDuree)} établissement${d.etablissementsSoinsCourteDuree > 1 ? "s" : ""} de soins de courte durée (hôpital, clinique)`,
          `${fr(d.maternites)} maternité${d.maternites > 1 ? "s" : ""}`,
          d.etablissementsSoinsSuite ? `${fr(d.etablissementsSoinsSuite)} établissement${d.etablissementsSoinsSuite > 1 ? "s" : ""} de soins de suite` : null,
          d.etablissementsPsychiatriques ? `${fr(d.etablissementsPsychiatriques)} établissement${d.etablissementsPsychiatriques > 1 ? "s" : ""} psychiatrique${d.etablissementsPsychiatriques > 1 ? "s" : ""}` : null,
          d.dialyse ? `${fr(d.dialyse)} centre${d.dialyse > 1 ? "s" : ""} de dialyse` : null,
        ),
      }),
      mesure("sante-dentistes", "Chirurgiens-dentistes", d.dentistes, {
        unite: accord(d.dentistes, "dentiste"),
        sens: "haut",
        comparable: false,
        decimales: 0,
        // Les autres professionnels de santé libéraux, par effectif décroissant.
        repartition: repartitionSante(d, PARAMEDICAUX),
      }),
      mesure("sante-ehpad", "Hébergements pour personnes âgées", d.hebergementsPersonnesAgees, {
        unite: accord(d.hebergementsPersonnesAgees, "établissement"),
        sens: "haut",
        comparable: false,
        decimales: 0,
        precision: d.soinsDomicilePersonnesAgees
          ? `${fr(d.soinsDomicilePersonnesAgees)} service${d.soinsDomicilePersonnesAgees > 1 ? "s" : ""} de soins à domicile pour personnes âgées`
          : undefined,
      }),
    ],
    brut,
    redaction,
  );
}

/**
 * Commerces & services : les équipements de la BPE lus à travers les gammes et
 * les domaines de l'INSEE, pour trois domaines seulement — commerces (B),
 * services aux particuliers (A), sport, loisirs et culture (F). Enseignement
 * (C), santé et action sociale (D) et transports (E) sont comptés par les
 * critères Écoles, Santé et Transports : on ne les compte pas deux fois, ni
 * dans le classement ni dans les listes.
 *
 * Classe : le nombre de types de la gamme de proximité de l'INSEE présents dans
 * la commune, restreinte à ces trois domaines (sur 19) — une mesure de diversité
 * de l'offre du quotidien, officielle et comparable partout. Les trois domaines
 * et le total d'équipements sont informatifs ; les répartitions vivent dans les
 * domaines seulement, pour qu'un regroupement n'apparaisse qu'une fois.
 */
const DOMAINES_QUOTIDIEN = {
  B: {
    id: "quotidien-commerces",
    libelle: "Commerces",
    precision: "alimentaires, grandes surfaces, magasins spécialisés",
  },
  A: {
    id: "quotidien-services",
    libelle: "Services aux particuliers",
    precision: "poste, banque, coiffeur, restaurants, garages, artisans du bâtiment, services publics",
  },
  F: {
    id: "quotidien-loisirs",
    libelle: "Sport, loisirs et culture",
    precision: "terrains et salles de sport, piscine, bibliothèque, cinéma, lieux culturels",
  },
};

function batirQuotidien(code, brut, redaction) {
  const d = brut?.communes?.[code];
  if (!brut || !d || !brut.gammes) return undefined;
  const { types: typesBpe, regroupements } = brut.gammes;
  const types = d.types ?? {};
  // Le domaine d'un regroupement est la lettre de son code (A, B, F… ; « AR03 » est un regroupement du domaine A).
  const retenu = (rid) => rid[0] in DOMAINES_QUOTIDIEN;

  // Effectifs par regroupement, pour cette commune.
  const effectifs = new Map();
  for (const [t, n] of Object.entries(types)) {
    const rid = typesBpe[t]?.regroupement ?? t;
    if (!retenu(rid)) continue;
    effectifs.set(rid, (effectifs.get(rid) ?? 0) + n);
  }
  const postes = (rids) =>
    rids
      .map((rid) => ({ libelle: regroupements[rid]?.libelle ?? rid, effectif: effectifs.get(rid) ?? 0 }))
      .filter((p) => p.effectif > 0)
      .sort((a, b) => b.effectif - a.effectif || a.libelle.localeCompare(b.libelle, "fr"));

  const proximite = Object.keys(regroupements).filter((rid) => regroupements[rid].gamme === "proximite" && retenu(rid));
  const presentsProximite = postes(proximite);
  const absentsProximite = proximite
    .filter((rid) => !(effectifs.get(rid) > 0))
    .map((rid) => regroupements[rid].libelle.toLowerCase());
  const total = [...effectifs.values()].reduce((n, v) => n + v, 0);

  return critere(
    [
      mesure("quotidien-proximite", "Commerces et services de proximité présents", presentsProximite.length, {
        court: "Commerces & services",
        unite: `sur ${proximite.length}`,
        sens: "haut",
        classante: true,
        vedette: true,
        decimales: 0,
        comparatif: COMPARATIFS.dotation,
        precision:
          absentsProximite.length === 0
            ? "toute la gamme de proximité de l'INSEE est présente (hors santé, enseignement et transports)"
            : absentsProximite.length <= 8
              ? `manquent : ${absentsProximite.join(", ")}`
              : `${absentsProximite.length} types de la gamme de proximité manquent, dont ${absentsProximite.slice(0, 5).join(", ")}`,
        // Pas de répartition ici : chaque regroupement se lit une seule fois, dans
        // sa section de domaine (commerces, services, loisirs) — aucun doublon.
      }),
      ...Object.entries(DOMAINES_QUOTIDIEN).map(([lettre, def]) => {
        const rids = Object.keys(regroupements).filter((rid) => rid[0] === lettre);
        const presents = postes(rids);
        return mesure(def.id, def.libelle, presents.length, {
          unite: accord(presents.length, "type"),
          sens: "haut",
          comparable: false,
          decimales: 0,
          precision: def.precision,
          repartition: presents,
        });
      }),
      mesure("quotidien-total", "Commerces, services et équipements de loisirs recensés", total, {
        unite: accord(total, "équipement"),
        sens: "haut",
        comparable: false,
        decimales: 0,
        precision: "hors santé, enseignement et transports, comptés dans leurs propres critères",
      }),
    ],
    brut,
    redaction,
  );
}

/**
 * Fiscalité locale : les taux de taxe foncière sur les propriétés bâties votés
 * pour l'année (DGFiP, REI). Classe : le taux global appliqué sur la commune,
 * somme des parts communale, intercommunale, syndicale et des taxes spéciales.
 */
function batirFiscalite(code, brut, redaction) {
  const d = brut?.communes?.[code];
  if (!brut || !d) return undefined;
  const pctTxt = (v) => `${fr(v, 2)} %`;
  const parts = [
    d.tauxTfbCommune != null ? `commune ${pctTxt(d.tauxTfbCommune)}` : null,
    d.tauxTfbEpci ? `intercommunalité ${pctTxt(d.tauxTfbEpci)}` : null,
    d.tauxTfbSyndicats ? `syndicats ${pctTxt(d.tauxTfbSyndicats)}` : null,
    d.tauxTfbTse ? `taxe spéciale d'équipement ${pctTxt(d.tauxTfbTse)}` : null,
    d.tauxTfbGemapi ? `GEMAPI ${pctTxt(d.tauxTfbGemapi)}` : null,
    d.tauxTfbTasa ? `TASA ${pctTxt(d.tauxTfbTasa)}` : null,
  ].filter(Boolean);

  return critere(
    [
      mesure("fisc-tfb-global", "Taux global de taxe foncière sur les propriétés bâties", d.tauxTfbGlobal, {
        court: "Taxe foncière",
        unite: "%",
        sens: "bas",
        classante: true,
        vedette: true,
        decimales: 2,
        comparatif: COMPARATIFS.imposition,
        precision: parts.length ? `${parts.join(" · ")} — appliqué à la valeur locative cadastrale, hors ordures ménagères` : undefined,
      }),
      mesure("fisc-tfb-commune", "Part communale du taux de taxe foncière", d.tauxTfbCommune, {
        unite: "%",
        sens: "bas",
        comparable: false,
        decimales: 2,
      }),
      mesure("fisc-tfb-epci", "Part intercommunale du taux de taxe foncière", d.tauxTfbEpci, {
        unite: "%",
        sens: "bas",
        comparable: false,
        decimales: 2,
      }),
      mesure("fisc-teom", "Taxe d'enlèvement des ordures ménagères, taux plein", d.tauxTeom, {
        unite: "%",
        sens: "bas",
        comparable: false,
        decimales: 2,
        statut: d.tauxTeom == null ? "sans_objet" : undefined,
        precision: "en pourcentage de la valeur locative, en plus de la taxe foncière",
      }),
      mesure("fisc-thrs", "Majoration de taxe d'habitation sur les résidences secondaires", d.majorationThResidencesSecondaires, {
        unite: "%",
        sens: "bas",
        comparable: false,
        decimales: 0,
        statut: d.majorationThResidencesSecondaires == null ? "sans_objet" : undefined,
        precision: "majoration votée par la commune, en zone tendue",
      }),
    ],
    brut,
    redaction,
  );
}

/**
 * Risques (Géorisques, base GASPAR) : la mesure classante est le nombre de
 * reconnaissances de l'état de catastrophe naturelle depuis 1982 — un fait
 * administratif publié au Journal officiel, qui dit combien de fois la commune
 * a été touchée par un événement ouvrant droit à indemnisation (inondation,
 * sécheresse, tempête…). Risques recensés, plans de prévention, zone sismique
 * et potentiel radon sont informatifs : des classements réglementaires, pas
 * des mesures, donc sans barre de position.
 */
function batirRisques(code, brut, redaction) {
  const d = brut?.communes?.[code];
  if (!brut || !d) return undefined;
  const derniere = d.catnatDerniere ? `dernière : ${d.catnatDerniere.risque.toLowerCase()}, ${d.catnatDerniere.annee}` : null;
  const rattaches = d.codesRattaches?.length
    ? `anciennes communes ${d.codesRattaches.join(", ")} comprises`
    : null;
  const RADON = {
    1: "catégorie 1 : formations géologiques à faible teneur en uranium",
    2: "catégorie 2 : faible teneur en uranium, mais failles, mines ou karsts peuvent faciliter le transfert du radon vers les bâtiments",
    3: "catégorie 3 : formations géologiques à teneur en uranium plus élevée, mesure du radon dans le logement recommandée",
  };
  const pprTechno = (d.pprtApprouves ?? 0) + (d.pprmApprouves ?? 0);
  return critere(
    [
      mesure("risq-catnat", "Reconnaissances de catastrophe naturelle depuis 1982", d.catnat, {
        court: "Catastrophes naturelles",
        unite: accord(d.catnat, "reconnaissance"),
        sens: "bas",
        classante: true,
        vedette: true,
        decimales: 0,
        comparatif: COMPARATIFS.exposition,
        precision: [
          d.catnat === 0
            ? "aucun arrêté publié au Journal officiel pour cette commune"
            : "arrêtés publiés au Journal officiel, un par événement et par type de risque",
          derniere,
          rattaches,
        ]
          .filter(Boolean)
          .join(" · "),
        repartition: d.catnatParRisque,
      }),
      mesure("risq-recenses", "Risques majeurs recensés dans le dossier départemental", d.risquesRecenses ? d.risquesRecenses.length : null, {
        unite: d.risquesRecenses ? accord(d.risquesRecenses.length, "risque") : "",
        sens: "bas",
        comparable: false,
        decimales: 0,
        statut: "indisponible",
        precision: d.risquesRecenses?.length ? d.risquesRecenses.join(" · ") : undefined,
      }),
      mesure("risq-pprn", "Plans de prévention des risques naturels approuvés", d.pprnApprouves, {
        unite: accord(d.pprnApprouves, "plan"),
        sens: "bas",
        comparable: false,
        decimales: 0,
        precision: d.pprnApprouves
          ? "documents opposables qui encadrent la construction dans les zones exposées"
          : "aucun plan approuvé pour cette commune",
        repartition: d.pprnRisques,
      }),
      mesure("risq-pprt", "Plans de prévention des risques technologiques ou miniers approuvés", pprTechno, {
        unite: accord(pprTechno, "plan"),
        sens: "bas",
        comparable: false,
        decimales: 0,
        precision: pprTechno ? "autour d'installations industrielles ou d'anciennes mines" : "aucun plan approuvé pour cette commune",
      }),
      mesure("risq-sismique", "Zone de sismicité réglementaire", d.zoneSismique, {
        unite: "sur 5",
        sens: "bas",
        comparable: false,
        decimales: 0,
        statut: "indisponible",
        precision: d.zoneSismiqueLibelle ? `sismicité ${d.zoneSismiqueLibelle} (décret n° 2010-1255)` : undefined,
      }),
      mesure("risq-radon", "Potentiel radon", d.radon, {
        unite: "sur 3",
        sens: "bas",
        comparable: false,
        decimales: 0,
        statut: "indisponible",
        precision: RADON[d.radon],
      }),
    ],
    brut,
    redaction,
  );
}

/**
 * Climat (Météo-France, normales 1991-2020 de la station la plus proche) : la
 * mesure classante est la durée d'insolation annuelle — le soleil est ce que
 * l'on cherche ou fuit en premier. Précipitations, jours de pluie, température
 * moyenne, jours chauds et jours de gelée sont informatifs, sans direction
 * favorable (on peut aimer la pluie ou le froid). Chaque mesure déclare sa
 * maille : la station, son altitude et sa distance — jamais une observation
 * communale.
 */
function batirClimat(code, brut, redaction) {
  const d = brut?.communes?.[code];
  if (!brut || !d) return undefined;
  const nomStation = (nom) =>
    nom.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, avant, lettre) => avant + lettre.toUpperCase());
  const maille = (f) =>
    f ? `station Météo-France ${nomStation(f.station)} (${fr(f.altitude)} m d'altitude, à ${fr(f.distanceKm, 1)} km)` : undefined;
  const PRECISION = "normale 1991-2020 de la station la plus proche";
  const sansStation = (portee) => `aucune station Météo-France valide pour cette grandeur à moins de ${portee} km`;
  const { soleil, pluie, temperature: temp } = d;
  return critere(
    [
      mesure("clim-ensoleillement", "Durée d'insolation annuelle", soleil?.ensoleillementHeures ?? null, {
        court: "Ensoleillement",
        unite: "h/an",
        sens: "haut",
        classante: true,
        vedette: true,
        decimales: 0,
        comparatif: COMPARATIFS.ensoleillement,
        precision: soleil ? PRECISION : sansStation(100),
        maille: maille(soleil),
        statut: "indisponible",
      }),
      mesure("clim-precipitations", "Précipitations annuelles", pluie?.precipitationsMm ?? null, {
        unite: "mm/an",
        sens: "bas",
        comparable: false,
        decimales: 0,
        precision: pluie ? PRECISION : sansStation(40),
        maille: maille(pluie),
        statut: "indisponible",
      }),
      mesure("clim-jours-pluie", "Jours de pluie (1 mm ou plus) par an", pluie?.joursPluie ?? null, {
        unite: "jours/an",
        sens: "bas",
        comparable: false,
        decimales: 0,
        precision: pluie ? PRECISION : sansStation(40),
        maille: maille(pluie),
        statut: "indisponible",
      }),
      mesure("clim-temperature", "Température moyenne annuelle", temp?.temperatureMoyenne ?? null, {
        unite: "°C",
        sens: "haut",
        comparable: false,
        decimales: 1,
        precision: temp ? PRECISION : sansStation(40),
        maille: maille(temp),
        statut: "indisponible",
      }),
      mesure("clim-jours-chauds", "Jours à 30 °C ou plus par an", temp?.joursChauds ?? null, {
        unite: "jours/an",
        sens: "bas",
        comparable: false,
        decimales: 0,
        precision: temp ? PRECISION : sansStation(40),
        maille: maille(temp),
        statut: "indisponible",
      }),
      mesure("clim-jours-gel", "Jours de gelée par an", temp?.joursGel ?? null, {
        unite: "jours/an",
        sens: "bas",
        comparable: false,
        decimales: 0,
        precision: temp ? PRECISION : sansStation(40),
        maille: maille(temp),
        statut: "indisponible",
      }),
    ],
    brut,
    redaction,
  );
}

/** Portrait démographique (RP 2022) : contexte de la fiche, hors classement. */
function batirDemographie(code, brut) {
  const d = brut?.communes?.[code];
  if (!brut || !d) return undefined;
  return {
    population2022: d.population2022 ?? null,
    population2016: d.population2016 ?? null,
    population2011: d.population2011 ?? null,
    ages: Object.entries(d.ages ?? {}).map(([tranche, effectif]) => ({ tranche, effectif: effectif ?? null })),
    source: source(brut.source),
  };
}

// -------------------------------------------------------------------- pilote

async function main() {
  const referentiel = await lireJson(path.join(RAW, "referentiel.json"));
  if (!referentiel.zone) {
    console.error(`referentiel.json de « ${REGION_SLUG} » n'a pas de champ « zone ».`);
    process.exit(1);
  }
  const brut = {
    immobilier: await lireJson(path.join(RAW, "immobilier.json")),
    securite: await lireJson(path.join(RAW, "securite.json")),
    ecoles: await lireJson(path.join(RAW, "ecoles.json")),
    transports: await lireJson(path.join(RAW, "transports.json"), false),
    elections: await lireJson(path.join(RAW, "elections.json")),
  };
  const nuances = await lireJson(path.join(RAW, "nuances.json"), false);
  // Loyers d'annonce (« Carte des loyers ») : facultatifs — voir importer-loyers.mjs.
  const loyers = await lireJson(path.join(RAW, "loyers.json"), false);
  // Démographie, emploi-revenus, santé — voir importer-insee.mjs.
  const population = await lireJson(path.join(RAW, "population.json"), false);
  const emploi = await lireJson(path.join(RAW, "emploi.json"), false);
  const sante = await lireJson(path.join(RAW, "sante.json"), false);
  // Commerces & services (importer-equipements.mjs) et fiscalité (importer-fiscalite.mjs).
  const equipements = await lireJson(path.join(RAW, "equipements.json"), false);
  const fiscalite = await lireJson(path.join(RAW, "fiscalite.json"), false);
  // Risques naturels et technologiques (importer-risques.mjs).
  const risques = await lireJson(path.join(RAW, "risques.json"), false);
  // Climat (importer-climat.mjs).
  const climat = await lireJson(path.join(RAW, "climat.json"), false);
  const historiques = {
    immobilier: await lireJson(path.join(RAW, "immobilier-historique.json"), false),
    securite: await lireJson(path.join(RAW, "securite-historique.json"), false),
  };
  if (!historiques.immobilier || !historiques.securite) {
    console.warn(
      `Historique absent pour : ${Object.entries(historiques)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ")} — aucune courbe d'évolution pour ce critère.`,
    );
  }
  const gareProche = await lireJson(path.join(RAW, "transports-gare-proche.json"), false);
  if (!gareProche) {
    console.warn("transports-gare-proche.json absent — le critère transports reste sans mesure classante.");
  }

  const redaction = {};
  for (const cle of Object.keys(brut)) {
    redaction[cle] = await lireJson(path.join(REDACTION, `${cle}.json`), false);
  }

  const manquants = Object.entries(redaction)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (manquants.length) {
    console.warn(
      `Textes rédigés absents pour : ${manquants.join(", ")} — repli sur la documentation technique brute.`,
    );
  }
  if (!nuances) {
    console.warn("nuances.json absent — les codes de nuance seront affichés sans libellé.");
  }

  const communes = referentiel.communes.map((c) => {
    const commune = {
      codeInsee: c.codeInsee,
      slug: slugifier(c.nom),
      nom: c.nom,
      population: c.population,
      anneePopulation: c.anneePopulation,
      departement: c.departement,
      demographie: batirDemographie(c.codeInsee, population),
      criteres: {
        immobilier: batirImmobilier(
          c.codeInsee,
          brut.immobilier,
          redaction.immobilier,
          historiques.immobilier,
          loyers,
        ),
        securite: batirSecurite(c.codeInsee, brut.securite, redaction.securite, historiques.securite),
        ecoles: batirEcoles(c.codeInsee, brut.ecoles, redaction.ecoles, c.population),
        transports: batirTransports(c.codeInsee, brut.transports, redaction.transports, gareProche),
        emploi: batirEmploi(c.codeInsee, emploi, redaction.emploi),
        sante: batirSante(c.codeInsee, sante, redaction.sante, c.population),
        quotidien: batirQuotidien(c.codeInsee, equipements, redaction.quotidien),
        fiscalite: batirFiscalite(c.codeInsee, fiscalite, redaction.fiscalite),
        risques: batirRisques(c.codeInsee, risques, redaction.risques),
        climat: batirClimat(c.codeInsee, climat, redaction.climat),
      },
      politique: batirPolitique(c.codeInsee, brut.elections, nuances),
    };
    // Le référentiel suffixe l'EPCI de son numéro SIREN : inutile à l'écran.
    if (c.epci) commune.epci = c.epci.replace(/\s*\(\d+\)\s*$/, "");
    if (c.codesPostaux) commune.codesPostaux = c.codesPostaux;
    if (c.lat) commune.lat = c.lat;
    if (c.lon) commune.lon = c.lon;
    if (c.surfaceKm2) commune.surfaceKm2 = c.surfaceKm2;
    const note = NOTES_AFFICHEES[c.codeInsee];
    if (note) commune.note = note;
    return commune;
  });

  verifier(communes);

  const jeu = compacter(communes, referentiel.zone, referentiel.communes[0]?.departement);
  await mkdir(path.dirname(SORTIE), { recursive: true });
  // Compact : le fichier est lu par le serveur, pas par un humain.
  await writeFile(SORTIE, `${JSON.stringify(jeu)}\n`, "utf8");

  resumer(communes);
}

/**
 * Format compact du jeu écrit sur disque (version 2), dilaté au chargement par
 * `src/lib/jeu-compact.ts` (application) et `scripts/lib/jeu-compact.mjs`
 * (artefact, noyau national). Ce qui est constant d'une commune à l'autre —
 * libellés, unités, sens, formulations, source et méthode de chaque critère,
 * sources propres à une mesure — n'est écrit qu'une fois ; chaque commune ne
 * porte que ses valeurs, alignées sur le dictionnaire, et ses particularités
 * (précision, statut, maille, historique). Toute divergence de métadonnée entre
 * deux communes est une erreur : le format ne tolère pas d'ambiguïté.
 */
const CHAMPS_META_MESURE = [
  "id",
  "libelle",
  "libelleCourt",
  "unite",
  "sens",
  "classante",
  "vedette",
  "comparable",
  "signe",
  "decimales",
  "comparatif",
];
const CHAMPS_PARTICULIERS = ["precision", "statut", "maille", "historique", "repartition"];

function compacter(communes, zone, departement) {
  const criteres = {};
  const sources = [];
  const indexSources = new Map();
  const refSource = (source) => {
    const cle = JSON.stringify(source);
    if (!indexSources.has(cle)) {
      indexSources.set(cle, sources.length);
      sources.push(source);
    }
    return indexSources.get(cle);
  };
  const metaDe = (m) => {
    const meta = {};
    for (const champ of CHAMPS_META_MESURE) if (m[champ] !== undefined) meta[champ] = m[champ];
    if (m.source) meta.sourceRef = refSource(m.source);
    return meta;
  };

  const compactes = communes.map((c) => {
    const { criteres: parCritere, ...base } = c;
    const sortie = { ...base, criteres: {} };
    for (const [id, donnees] of Object.entries(parCritere)) {
      if (!donnees) continue;
      const dico = (criteres[id] ??= {
        source: donnees.source,
        methodologie: donnees.methodologie,
        caveats: donnees.caveats,
        mesures: [],
      });
      // Source ou méthode propre à cette commune (ex. réseau urbain documenté
      // pour une partie des communes seulement) : portée par la commune.
      const textes = {};
      for (const champ of ["source", "methodologie", "caveats"]) {
        if (JSON.stringify(donnees[champ]) !== JSON.stringify(dico[champ])) textes[champ] = donnees[champ];
      }
      const valeurs = [];
      const particuliers = {};
      for (const m of donnees.mesures) {
        const meta = metaDe(m);
        let index = dico.mesures.findIndex((x) => x.id === m.id);
        if (index === -1) index = dico.mesures.push(meta) - 1;
        // Les mesures peuvent manquer pour une commune (ex. sans loyer) : les
        // valeurs sont alignées sur le dictionnaire, les absentes restent undefined.
        valeurs[index] = m.valeur;
        const part = {};
        for (const champ of CHAMPS_PARTICULIERS) if (m[champ] !== undefined) part[champ] = m[champ];
        // Une métadonnée qui s'écarte du dictionnaire (ex. unité accordée au
        // pluriel : « 7 médecins » / « 1 médecin ») voyage avec la commune.
        const reference = dico.mesures[index];
        for (const champ of [...CHAMPS_META_MESURE, "sourceRef"]) {
          if (JSON.stringify(meta[champ]) !== JSON.stringify(reference[champ])) {
            if (champ === "sourceRef") part.source = m.source;
            else part[champ] = meta[champ] === undefined ? null : meta[champ];
          }
        }
        if (Object.keys(part).length) particuliers[index] = part;
      }
      const entree = { v: dico.mesures.map((_, i) => (i in valeurs ? valeurs[i] : undefined)) };
      // Une mesure absente pour cette commune (pas seulement nulle) : marquée à part.
      const absentes = dico.mesures.map((_, i) => i).filter((i) => !(i in valeurs));
      if (absentes.length) entree.absentes = absentes;
      if (Object.keys(particuliers).length) entree.x = particuliers;
      if (Object.keys(textes).length) entree.t = textes;
      sortie.criteres[id] = entree;
    }
    return sortie;
  });

  // Une commune traitée tôt peut ignorer une mesure ajoutée au dictionnaire par
  // une commune suivante : on complète ses marqueurs d'absence.
  for (const c of compactes) {
    for (const [id, entree] of Object.entries(c.criteres)) {
      const n = criteres[id].mesures.length;
      if (entree.v.length < n) {
        const absentes = new Set(entree.absentes ?? []);
        for (let i = entree.v.length; i < n; i++) absentes.add(i);
        entree.v.length = n;
        entree.absentes = [...absentes].sort((a, b) => a - b);
      }
      // undefined ne survit pas à JSON : les valeurs absentes deviennent null,
      // `absentes` garde la distinction.
      entree.v = entree.v.map((v) => (v === undefined ? null : v));
    }
  }

  return { version: 2, zone, departement, genereLe: new Date().toISOString(), criteres, sources, communes: compactes };
}

/** Garde-fous : ce qui casse ici ne doit jamais atteindre l'application. */
function verifier(communes) {
  const erreurs = [];
  const slugs = new Set();
  const proprietaire = new Map();
  const absents = {};

  for (const c of communes) {
    if (slugs.has(c.slug)) erreurs.push(`Slug en double : ${c.slug}`);
    slugs.add(c.slug);

    for (const [idCritere, donnees] of Object.entries(c.criteres)) {
      // Critère absent : aucune extraction ne couvre cette commune (ex. prix DVF
      // non encore importés hors des communes de 2 000 habitants). Toléré et
      // compté ; l'application l'affiche comme tel, jamais comblé.
      if (!donnees) {
        absents[idCritere] = (absents[idCritere] ?? 0) + 1;
        continue;
      }
      if (!donnees.source?.url) erreurs.push(`${c.nom} / ${idCritere} : source sans URL`);

      const vedettes = donnees.mesures.filter((m) => m.vedette);
      if (vedettes.length !== 1) {
        erreurs.push(`${c.nom} / ${idCritere} : ${vedettes.length} mesures vedettes, il en faut exactement une`);
      }
      if (!donnees.mesures.some((m) => m.classante)) {
        erreurs.push(`${c.nom} / ${idCritere} : aucune mesure classante`);
      }

      for (const m of donnees.mesures) {
        const deja = proprietaire.get(m.id);
        if (deja && deja !== idCritere) {
          erreurs.push(`Identifiant « ${m.id} » partagé par « ${deja} » et « ${idCritere} »`);
        }
        proprietaire.set(m.id, idCritere);
        if (m.valeur !== null && !Number.isFinite(m.valeur)) {
          erreurs.push(`${c.nom} / ${m.id} : valeur non numérique`);
        }

        if (m.historique) {
          const annees = m.historique.map((p) => p.annee);
          if (new Set(annees).size !== annees.length) {
            erreurs.push(`${c.nom} / ${m.id} : années dupliquées dans l'historique`);
          }
          if (annees.some((a, i) => i > 0 && a <= annees[i - 1])) {
            erreurs.push(`${c.nom} / ${m.id} : historique non trié par année croissante`);
          }
          if (m.historique.filter((p) => p.valeur !== null).length < 3) {
            erreurs.push(`${c.nom} / ${m.id} : historique avec moins de 3 points renseignés`);
          }
          // Pas de comparaison générique « dernier point == valeur courante »
          // ici : pour l'immobilier, la valeur affichée est une médiane sur 5
          // ans, pas le millésime le plus récent. La cohérence avec le bon
          // millésime est vérifiée au plus près de la source, dans chaque
          // fonction batirXxx ci-dessous.
        }
      }
    }

    for (const s of c.politique.scrutins) {
      const total = s.resultats.reduce((acc, r) => acc + r.pourcentage, 0);
      // Tolérance élargie à l'échelle nationale : le fichier officiel des
      // municipales 2026 publie parfois un total « Exprimés » légèrement
      // inférieur à la somme des voix par liste qu'il publie lui-même (écart
      // constaté jusqu'à 104,2 % sur une liste unique à Cissé, 86076, et
      // 100,8 % cumulé à Wintzenheim, 68374) — un défaut du producteur, pas
      // un recalcul de notre part : les pourcentages affichés restent ceux
      // publiés tels quels, jamais corrigés. Le garde-fou reste strict au-delà
      // pour continuer à détecter une vraie erreur d'agrégation côté script.
      if (total > 108) {
        erreurs.push(`${c.nom} / ${s.id} : les pourcentages affichés totalisent ${total.toFixed(1)} %`);
      }
      if (s.resultats.some((r) => r.pourcentage < 0 || r.pourcentage > 108)) {
        erreurs.push(`${c.nom} / ${s.id} : pourcentage hors des bornes 0-108`);
      }
    }
  }

  if (Object.keys(absents).length) {
    console.log(
      `Critères sans extraction : ${Object.entries(absents)
        .map(([k, v]) => `${k} ${v}/${communes.length}`)
        .join(", ")}`,
    );
  }
  if (erreurs.length) {
    console.error(`\n${erreurs.length} anomalie(s) :`);
    for (const e of erreurs.slice(0, 40)) console.error(`  - ${e}`);
    process.exit(1);
  }
}

function resumer(communes) {
  const total = communes.length;
  console.log(`${total} communes écrites dans ${path.relative(RACINE, SORTIE)}\n`);

  const lignes = [];
  for (const idCritere of ["immobilier", "securite", "ecoles", "transports"]) {
    const ids = new Set();
    for (const c of communes) for (const m of c.criteres[idCritere]?.mesures ?? []) ids.add(m.id);
    for (const id of ids) {
      const renseignees = communes.filter((c) =>
        c.criteres[idCritere]?.mesures.some((m) => m.id === id && m.valeur !== null),
      ).length;
      const classante = communes
        .find((c) => c.criteres[idCritere])
        ?.criteres[idCritere].mesures.find((m) => m.id === id)?.classante;
      const avecHistorique = communes.filter((c) =>
        c.criteres[idCritere]?.mesures.some((m) => m.id === id && m.historique),
      ).length;
      lignes.push(
        `  ${classante ? "•" : " "} ${id.padEnd(30)} ${String(renseignees).padStart(3)}/${total}` +
          (renseignees < total ? "  <- trous" : "") +
          (avecHistorique ? `  · historique ${avecHistorique}/${total}` : ""),
      );
    }
  }
  console.log("Couverture par mesure (• = entre dans le classement)");
  console.log(lignes.join("\n"));

  const scrutins = {};
  for (const c of communes) for (const s of c.politique.scrutins) scrutins[s.id] = (scrutins[s.id] ?? 0) + 1;
  const maires = communes.filter((c) => c.politique.maire).length;
  console.log(
    `\nScrutins : ${Object.entries(scrutins).map(([k, v]) => `${k} ${v}/${total}`).join(", ")}` +
      ` · maires renseignés ${maires}/${total}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
