#!/usr/bin/env node
/**
 * Démographie, emploi-revenus et santé — INSEE (recensement 2022, Filosofi
 * 2023, BPE 2025) et DREES (APL 2024).
 *
 *   node scripts/importer-insee.mjs [--dossier <cache>]
 *
 * Écrit, pour chaque région peuplée, `data/raw/<région>/population.json`,
 * `emploi.json` et `sante.json`, en ne retenant que les communes de son
 * référentiel. Les fichiers nationaux (≈ 400 Mo) sont téléchargés dans le
 * dossier de cache s'ils n'y sont pas déjà, et lus en flux.
 *
 * Aucune valeur inventée : une donnée sous secret statistique (Filosofi,
 * `CONF_STATUS = C`) reste absente avec son statut ; un taux n'est calculé que
 * si ses deux termes sont publiés.
 */
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const argDossier = process.argv.indexOf("--dossier");
const CACHE = argDossier > -1 ? path.resolve(process.argv[argDossier + 1]) : path.join(RACINE, ".cache-insee");
mkdirSync(CACHE, { recursive: true });

const FICHIERS = {
  population: {
    zip: "https://www.insee.fr/fr/statistiques/fichier/8581696/base-cc-evol-struct-pop-2022_csv.zip",
    dossier: "rp-pop",
    fichier: "base-cc-evol-struct-pop-2022.CSV",
    page: "https://www.insee.fr/fr/statistiques/8581696",
  },
  emploi: {
    zip: "https://www.insee.fr/fr/statistiques/fichier/8581444/base-cc-emploi-pop-active-2022_csv.zip",
    dossier: "rp-emploi",
    fichier: "base-cc-emploi-pop-active-2022.CSV",
    page: "https://www.insee.fr/fr/statistiques/8581444",
  },
  filosofi: {
    zip: "https://www.insee.fr/fr/statistiques/fichier/8984752/FILOSOFI_CC_csv.zip",
    dossier: "filosofi2023",
    fichier: "DS_FILOSOFI_CC_2023_data.csv",
    page: "https://www.insee.fr/fr/statistiques/8984752?sommaire=8984758",
  },
  apl: {
    url: "https://data.drees.solidarites-sante.gouv.fr/api/v2/catalog/datasets/530_l-accessibilite-potentielle-localisee-apl/attachments/indicateur_d_apl_aux_medecins_generalistes_xlsx",
    fichier: "apl-mg.xlsx",
    page: "https://data.drees.solidarites-sante.gouv.fr/explore/dataset/530_l-accessibilite-potentielle-localisee-apl/",
  },
  bpe: {
    zip: "https://www.insee.fr/fr/statistiques/fichier/8217527/DS_BPE_CSV_FR.zip",
    dossier: "bpe",
    fichier: "DS_BPE_2025_data.csv",
    page: "https://www.insee.fr/fr/statistiques/8217527",
  },
};

async function telecharger(url, destination) {
  console.log(`  téléchargement ${url}`);
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${reponse.status} ${url}`);
  await writeFile(destination, Buffer.from(await reponse.arrayBuffer()));
}

function decompresser(zip, dossier) {
  mkdirSync(dossier, { recursive: true });
  try {
    execFileSync("unzip", ["-o", "-q", zip, "-d", dossier], { stdio: "inherit" });
  } catch {
    execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Force -LiteralPath '${zip}' -DestinationPath '${dossier}'`], { stdio: "inherit" });
  }
}

/** Rend le chemin local du fichier, en le téléchargeant (et décompressant) au besoin. */
async function assurer(cle) {
  const f = FICHIERS[cle];
  const chemin = f.dossier ? path.join(CACHE, f.dossier, f.fichier) : path.join(CACHE, f.fichier);
  if (existsSync(chemin)) return chemin;
  if (f.zip) {
    const zip = path.join(CACHE, `${cle}.zip`);
    if (!existsSync(zip)) await telecharger(f.zip, zip);
    decompresser(zip, path.join(CACHE, f.dossier));
  } else {
    await telecharger(f.url, chemin);
  }
  if (!existsSync(chemin)) throw new Error(`Fichier attendu absent après extraction : ${chemin}`);
  return chemin;
}

const num = (s) => {
  if (s === undefined || s === null || s === "" || s === "NA") return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const nettoyer = (s) => s.replace(/^"|"$/g, "");

/** Lit un CSV « ; » en flux et appelle `surLigne(colonnes)` pour les lignes dont le code est dans `codes`. */
async function lireCsv(chemin, codes, colonneCode, surLigne, encodage = "utf8") {
  const rl = createInterface({ input: createReadStream(chemin, { encoding: encodage }) });
  let entete = null;
  let indexCode = -1;
  for await (const ligne of rl) {
    const v = ligne.split(";").map(nettoyer);
    if (!entete) {
      entete = v;
      indexCode = entete.indexOf(colonneCode);
      if (indexCode === -1) throw new Error(`Colonne ${colonneCode} absente de ${chemin}`);
      continue;
    }
    if (!codes.has(v[indexCode])) continue;
    surLigne(Object.fromEntries(entete.map((k, i) => [k, v[i]])));
  }
}

// ----------------------------------------------------------------- lectures

async function lirePopulation(codes) {
  const chemin = await assurer("population");
  const out = new Map();
  await lireCsv(chemin, codes, "CODGEO", (r) => {
    out.set(r.CODGEO, {
      population2022: num(r.P22_POP),
      population2016: num(r.P16_POP),
      population2011: num(r.P11_POP),
      ages: {
        "0-14": num(r.P22_POP0014),
        "15-29": num(r.P22_POP1529),
        "30-44": num(r.P22_POP3044),
        "45-59": num(r.P22_POP4559),
        "60-74": num(r.P22_POP6074),
        "75-89": num(r.P22_POP7589),
        "90+": num(r.P22_POP90P),
      },
    });
  });
  return out;
}

async function lireEmploi(codes) {
  const chemin = await assurer("emploi");
  const out = new Map();
  await lireCsv(chemin, codes, "CODGEO", (r) => {
    out.set(r.CODGEO, {
      population1564: num(r.P22_POP1564),
      actifs1564: num(r.P22_ACT1564),
      actifsOccupes1564: num(r.P22_ACTOCC1564),
      chomeurs1564: num(r.P22_CHOM1564),
      retraites1564: num(r.P22_RETR1564),
      etudiants1564: num(r.P22_ETUD1564),
      emploisAuLieuDeTravail: num(r.P22_EMPLT),
    });
  });
  return out;
}

async function lireFilosofi(codes) {
  const chemin = await assurer("filosofi");
  // Filosofi 2 (millésime 2023) ne publie plus le nombre de ménages fiscaux
  // (NUM_HH) dans la base communale : la mesure n'est plus importée.
  const MESURES = { MED_SL: "niveauDeVieMedian", PR_MD60: "tauxPauvrete", IR_D9_D1_SL: "rapportInterdecile" };
  const out = new Map();
  await lireCsv(chemin, codes, "GEO", (r) => {
    if (r.GEO_OBJECT !== "COM") return;
    const champ = MESURES[r.FILOSOFI_MEASURE];
    if (!champ) return;
    const entree = out.get(r.GEO) ?? {};
    entree[champ] = num(r.OBS_VALUE);
    // « C » : valeur couverte par le secret statistique, absente à dessein.
    // OBS_STATUS « O » : valeur manquante (sous le seuil de diffusion), absente aussi.
    if (r.CONF_STATUS === "C") entree[`${champ}_statut`] = "secret_statistique";
    else if (r.OBS_STATUS === "O" && entree[champ] === null) entree[`${champ}_statut`] = "seuil_diffusion";
    out.set(r.GEO, entree);
  });
  return out;
}

async function lireApl(codes) {
  const chemin = await assurer("apl");
  const wb = XLSX.readFile(chemin);
  const out = new Map();
  for (const annee of [2022, 2023, 2024]) {
    const ws = wb.Sheets[`APL ${annee}`];
    if (!ws) continue;
    const lignes = XLSX.utils.sheet_to_json(ws, { header: 1 });
    // L'en-tête est en 9e ligne ; les données commencent après la ligne d'unités.
    const debut = lignes.findIndex((l) => l && l[0] === "Code commune INSEE") + 2;
    for (const l of lignes.slice(debut)) {
      const code = l?.[0] ? String(l[0]).padStart(5, "0") : null;
      if (!code || !codes.has(code)) continue;
      const entree = out.get(code) ?? { historique: [] };
      const apl = num(l[2]);
      if (annee === 2024) {
        entree.apl = apl;
        entree.aplMoins65 = num(l[3]);
      }
      if (apl !== null) entree.historique.push({ annee, valeur: apl });
      out.set(code, entree);
    }
  }
  return out;
}

// Enseignement (BPE 2025, domaine C) : la méthode reproduit celle validée sur les
// premières régions — maternelles = C107 + C108 (une école primaire a une section
// maternelle), élémentaires = C109 + C108, total = C107 + C108 + C109 ; lycées GT =
// C301 + C304, lycées pro/agricoles = C302 + C303 + C305.
const TYPES_ECOLES = {
  C107: "c107",
  C108: "c108",
  C109: "c109",
  C201: "c201",
  C301: "c301",
  C302: "c302",
  C303: "c303",
  C304: "c304",
  C305: "c305",
};

// Santé (BPE 2025, domaine D) : tous les professionnels libéraux et structures
// que la BPE dénombre à la commune. Les libellés d'affichage vivent dans
// build-dataset.mjs (SPECIALISTES, PARAMEDICAUX).
const TYPES_SANTE = {
  D265: "medecinsGeneralistes",
  D277: "dentistes",
  D281: "infirmiers",
  D279: "kinesitherapeutes",
  D307: "pharmacies",
  D302: "laboratoires",
  D113: "maisonsDeSante",
  D108: "centresDeSante",
  D101: "etablissementsSoinsCourteDuree",
  D102: "etablissementsSoinsSuite",
  D104: "etablissementsPsychiatriques",
  D106: "servicesUrgences",
  D107: "maternites",
  D111: "dialyse",
  D401: "hebergementsPersonnesAgees",
  D402: "soinsDomicilePersonnesAgees",
  // Médecins spécialistes.
  D251: "allergologues",
  D252: "anesthesistes",
  D253: "chirurgiensGeneraux",
  D254: "chirurgiensOrthopedistes",
  D255: "endocrinologues",
  D256: "geriatres",
  D257: "hematologues",
  D258: "medecinsReadaptation",
  D259: "neurologues",
  D260: "oncologues",
  D261: "rhumatologues",
  D262: "urologuesNephrologues",
  D266: "cardiologues",
  D267: "dermatologues",
  D268: "gastroEnterologues",
  D269: "psychiatres",
  D270: "ophtalmologues",
  D271: "orl",
  D272: "pediatres",
  D273: "pneumologues",
  D274: "radiologues",
  D275: "stomatologues",
  D276: "gynecologues",
  // Autres professionnels de santé.
  D278: "sagesFemmes",
  D280: "pedicuresPodologues",
  D282: "orthophonistes",
  D283: "orthoptistes",
  D250: "psychologues",
  D246: "audioprothesistes",
  D247: "ergotherapeutes",
  D248: "psychomotriciens",
  D249: "dieteticiens",
};

async function lireBpe(codes) {
  const chemin = await assurer("bpe");
  const out = new Map();
  await lireCsv(chemin, codes, "GEO", (r) => {
    if (r.GEO_OBJECT !== "COM" || r.BPE_MEASURE !== "FACILITIES" || r.TIME_PERIOD !== "2025") return;
    const champ = TYPES_SANTE[r.FACILITY_TYPE] ?? TYPES_ECOLES[r.FACILITY_TYPE];
    if (!champ) return;
    const entree = out.get(r.GEO) ?? {};
    entree[champ] = num(r.OBS_VALUE);
    out.set(r.GEO, entree);
  });
  return out;
}

// ------------------------------------------------------------------- écriture

const pct = (num_, den) => (num_ === null || den === null || !den ? null : Math.round((num_ / den) * 1000) / 10);

async function main() {
  const regions = [];
  const codes = new Set();
  for (const d of (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    try {
      const referentiel = JSON.parse(await readFile(path.join(RAW, d.name, "referentiel.json"), "utf8"));
      regions.push({ dossier: path.join(RAW, d.name), communes: referentiel.communes ?? [] });
      for (const c of referentiel.communes ?? []) codes.add(c.codeInsee);
    } catch {
      /* dossier sans référentiel : ignoré */
    }
  }
  console.log(`${codes.size} communes dans ${regions.length} régions.`);

  console.log("Lecture des sources…");
  const [population, emploi, filosofi, apl, bpe] = await Promise.all([
    lirePopulation(codes),
    lireEmploi(codes),
    lireFilosofi(codes),
    lireApl(codes),
    lireBpe(codes),
  ]);
  console.log(
    `  population ${population.size} · emploi ${emploi.size} · filosofi ${filosofi.size} · APL ${apl.size} · BPE santé ${bpe.size}`,
  );

  const consulteLe = new Date().toISOString().slice(0, 10);
  const sourceRp = (theme, page) => ({
    nom: `Recensement de la population 2022 — ${theme} (base communale, exploitation principale, géographie au 1er janvier 2025, publié en 2025)`,
    nomCourt: "Recensement 2022",
    producteur: "INSEE",
    url: page,
    annee: "2022",
    licence: "Licence Ouverte / Etalab 2.0",
    consulteLe,
  });

  for (const region of regions) {
    const pop = {};
    const emp = {};
    const san = {};
    for (const c of region.communes) {
      const p = population.get(c.codeInsee);
      if (p) pop[c.codeInsee] = { nom: c.nom, ...p };

      const e = emploi.get(c.codeInsee);
      const f = filosofi.get(c.codeInsee) ?? {};
      if (e || filosofi.has(c.codeInsee)) {
        emp[c.codeInsee] = {
          nom: c.nom,
          ...(e ?? {}),
          tauxChomage1564: e ? pct(e.chomeurs1564, e.actifs1564) : null,
          tauxActivite1564: e ? pct(e.actifs1564, e.population1564) : null,
          ...f,
        };
      }

      const a = apl.get(c.codeInsee);
      const b = bpe.get(c.codeInsee) ?? {};
      if (a || bpe.has(c.codeInsee)) {
        san[c.codeInsee] = {
          nom: c.nom,
          aplMedecinsGeneralistes: a?.apl ?? null,
          aplMedecinsGeneralistesMoins65: a?.aplMoins65 ?? null,
          aplHistorique: a?.historique ?? [],
          ...Object.fromEntries(Object.values(TYPES_SANTE).map((champ) => [champ, b[champ] ?? 0])),
          ...(bpe.has(c.codeInsee) ? {} : { bpe_statut: "indisponible" }),
        };
      }
    }

    await writeFile(
      path.join(region.dossier, "population.json"),
      JSON.stringify(
        {
          source: sourceRp("évolution et structure de la population", FICHIERS.population.page),
          methodologie:
            "Population municipale par tranche d'âge au recensement 2022, et populations 2011 et 2016 dans la géographie 2025, pour lire l'évolution à périmètre constant.",
          caveats: [
            "Les tranches d'âge sont celles publiées par l'INSEE (0-14, 15-29, 30-44, 45-59, 60-74, 75-89, 90 et plus) ; aucune n'est recalculée.",
          ],
          communes: pop,
        },
        null,
        1,
      ),
    );

    await writeFile(
      path.join(region.dossier, "emploi.json"),
      JSON.stringify(
        {
          source: sourceRp("emploi et population active", FICHIERS.emploi.page),
          sourceRevenus: {
            nom: "Filosofi 2023 — revenus, pauvreté et niveau de vie des ménages (dispositif Filosofi 2 : DGFiP, Cnaf, Cnav, CCMSA ; base communale, publié le 6 août 2026 ; non comparable aux millésimes 2012 à 2021)",
            nomCourt: "Filosofi 2023",
            producteur: "INSEE",
            url: FICHIERS.filosofi.page,
            annee: "2023",
            licence: "Licence Ouverte / Etalab 2.0",
            consulteLe,
          },
          methodologie:
            "Taux de chômage et d'activité des 15-64 ans au sens du recensement (déclaratif : une personne se déclare au chômage), calculés à partir des effectifs publiés — ils diffèrent du chômage au sens du BIT ou des inscrits à France Travail. Niveau de vie médian par unité de consommation et taux de pauvreté (seuil à 60 % de la médiane nationale) publiés par Filosofi ; les valeurs couvertes par le secret statistique restent absentes.",
          caveats: [
            "Le chômage au sens du recensement est déclaratif et n'est pas comparable aux chiffres mensuels de France Travail.",
            "Filosofi 2023 est le premier millésime du dispositif Filosofi 2 : ses indicateurs ne sont pas comparables à ceux des millésimes 2012 à 2021.",
            "Le taux de pauvreté n'est diffusé que pour les communes les plus peuplées ; ailleurs il reste absent, jamais estimé.",
          ],
          communes: emp,
        },
        null,
        1,
      ),
    );

    await writeFile(
      path.join(region.dossier, "sante.json"),
      JSON.stringify(
        {
          source: {
            nom: "Base permanente des équipements (BPE) 2025, dénombrement des équipements de santé par commune au 1er janvier 2025 (DS_BPE_CSV_FR)",
            nomCourt: "BPE 2025",
            producteur: "INSEE",
            url: FICHIERS.bpe.page,
            annee: "2025",
            licence: "Licence Ouverte / Etalab 2.0",
            consulteLe,
          },
          sourceApl: {
            nom: "Indicateur d'accessibilité potentielle localisée (APL) aux médecins généralistes, millésimes 2022 à 2024 (activité 2024, publié en 2026 ; Cnam SNIIR-AM, distancier Metric, INSEE)",
            nomCourt: "APL 2024",
            producteur: "DREES",
            url: FICHIERS.apl.page,
            annee: "2024",
            licence: "Licence Ouverte 2.0",
            consulteLe,
          },
          methodologie:
            "L'APL mesure le nombre de consultations de médecine générale accessibles par an et par habitant, en tenant compte des médecins de la commune et des communes voisines (pondérés par la distance), de leur activité et de la structure par âge de la population : c'est un indicateur d'accès réel aux soins, pas un simple comptage. Les dénombrements (médecins, pharmacies, urgences…) sont ceux de la BPE, implantés sur la commune elle-même.",
          caveats: [
            "Un comptage nul dans la commune ne signifie pas une absence d'accès : l'APL, lui, intègre les communes voisines.",
            "Champ APL : omnipraticiens libéraux et salariés de centres de santé ; France hors Mayotte.",
          ],
          communes: san,
        },
        null,
        1,
      ),
    );

    await ecrireEcoles(region, bpe, consulteLe);
  }
  console.log("Écrit : population.json, emploi.json, sante.json, ecoles.json dans chaque région.");
}

/**
 * Dénombrements scolaires pour toutes les communes du référentiel, à partir de
 * la BPE (exhaustive : un type sans ligne vaut zéro). Les résultats aux examens
 * (DEPP : DNB, baccalauréat, valeur ajoutée) extraits précédemment pour une
 * commune sont conservés tels quels ; une commune sans extraction les garde absents.
 */
async function ecrireEcoles(region, bpe, consulteLe) {
  const chemin = path.join(region.dossier, "ecoles.json");
  let ancien = null;
  try {
    ancien = JSON.parse(await readFile(chemin, "utf8"));
  } catch {
    /* pas d'extraction antérieure */
  }
  const n = (b, ...cles) => cles.reduce((somme, k) => somme + (b[k] ?? 0), 0);
  const communes = {};
  for (const c of region.communes) {
    const b = bpe.get(c.codeInsee) ?? {};
    const lgt = n(b, "c301", "c304");
    const lp = n(b, "c302", "c303", "c305");
    communes[c.codeInsee] = {
      ...(ancien?.communes?.[c.codeInsee] ?? {}),
      nom: c.nom,
      ecolesMaternelles: n(b, "c107", "c108"),
      ecolesElementaires: n(b, "c109", "c108"),
      ecolesTotal: n(b, "c107", "c108", "c109"),
      colleges: n(b, "c201"),
      lyceesGeneralTechno: lgt,
      lyceesProfessionnels: lp,
      lycees: lgt + lp,
    };
  }
  const source = ancien?.source ?? {
    nom: "Base permanente des équipements (BPE) 2025, fichier de dénombrement général des équipements par commune (DS_BPE_CSV_FR)",
    producteur: "INSEE (BPE)",
    url: FICHIERS.bpe.page,
    annee: "Dénombrement au 1er janvier 2025",
    licence: "Licence Ouverte / Etalab v2.0",
  };
  source.consulteLe = consulteLe;
  const methodologie =
    "Dénombrements lus dans le fichier de dénombrement général de la BPE 2025 (DS_BPE_CSV_FR, lignes GEO_OBJECT = COM) pour toutes les communes : écoles = C107 + C108 + C109 (maternelles = C107 + C108, élémentaires = C109 + C108), collèges = C201, lycées GT = C301 + C304, lycées pro/agricoles = C302 + C303 + C305 ; la BPE étant exhaustive, un type sans ligne vaut zéro. " +
    "Résultats aux examens (DEPP, IVAC collèges et IVAL lycées, session 2025) : moyenne des établissements implantés sur la commune pondérée par les candidats ou présents, disponible seulement pour les communes déjà extraites ; ailleurs la valeur reste absente, jamais 0 ni une valeur départementale.";
  const caveats = ancien?.caveats ?? [
    "Aucun taux de réussite communal officiel n'existe ; les valeurs affichées sont une moyenne pondérée calculée à partir des établissements implantés sur la commune.",
    "Décalage temporel : dénombrement au 1er janvier 2025, résultats de la session de juin 2025.",
  ];
  await writeFile(chemin, JSON.stringify({ source, methodologie, caveats, communes }, null, 1), "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
