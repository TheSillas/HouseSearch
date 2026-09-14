#!/usr/bin/env node
/**
 * Sécurité — délinquance enregistrée par la police et la gendarmerie (SSMSI),
 * base statistique communale nationale, pour toutes les communes.
 *
 *   node scripts/importer-securite.mjs [--dossier <cache>]
 *
 * Source : le fichier communal national du SSMSI sur data.gouv.fr (csv.gz,
 * ~40 Mo, 15 indicateurs × 10 années × toutes les communes), lu en flux. Il
 * remplace les requêtes commune par commune de la première extraction : mêmes
 * champs, mêmes valeurs (vérifié sur Ambérieu-en-Bugey), mêmes règles.
 *
 * Secret statistique : `est_diffuse = ndiff` (5 faits ou moins sur 3 années
 * consécutives) → nombre et taux laissés null, jamais estimés ni reconstitués.
 *
 * Écrit `data/raw/<région>/securite.json` (dernière année) et
 * `securite-historique.json` (taux pour mille 2016-2025 des quatre indicateurs
 * classants), au schéma consommé par build-dataset.mjs.
 */
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const args = process.argv.slice(2);
const CACHE = args.includes("--dossier")
  ? path.resolve(args[args.indexOf("--dossier") + 1])
  : path.join(RACINE, ".cache-insee");

const SSMSI = {
  page: "https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales",
  ressource: "44ef4323-1097-48d5-8719-3c544b55d294",
  url: "https://www.data.gouv.fr/api/1/datasets/r/44ef4323-1097-48d5-8719-3c544b55d294",
  fichier: "ssmsi-com.csv.gz",
};
const ANNEE = 2025;

/** Libellé SSMSI → suffixe des champs `taux…` / `nb…`. */
const INDICATEURS = {
  "Violences physiques intrafamiliales": "ViolencesPhysiquesIntrafamiliales",
  "Violences physiques hors cadre familial": "ViolencesPhysiquesHorsCadreFamilial",
  "Violences sexuelles": "ViolencesSexuelles",
  "Vols avec armes": "VolsAvecArmes",
  "Vols violents sans arme": "VolsViolentsSansArme",
  "Vols sans violence contre des personnes": "VolsSansViolenceContrePersonnes",
  "Cambriolages de logement": "CambriolagesLogement",
  "Vols de véhicule": "VolsDeVehicule",
  "Vols dans les véhicules": "VolsDansLesVehicules",
  "Vols d'accessoires sur véhicules": "VolsAccessoiresSurVehicules",
  "Destructions et dégradations volontaires": "DestructionsDegradations",
  "Usage de stupéfiants": "UsageStupefiants",
  "Usage de stupéfiants (AFD)": "UsageStupefiantsAFD",
  "Trafic de stupéfiants": "TraficStupefiants",
  "Escroqueries et fraudes aux moyens de paiement": "EscroqueriesFraudesMoyensPaiement",
};
/** Indicateurs classants dont l'évolution est gardée (clés de securite-historique.json). */
const HISTORIQUE = {
  ViolencesPhysiquesHorsCadreFamilial: "violencesHorsFamille",
  VolsSansViolenceContrePersonnes: "volsSansViolence",
  CambriolagesLogement: "cambriolages",
  DestructionsDegradations: "degradations",
};

const nettoyer = (s) => s.replace(/^"|"$/g, "");
const num = (s) => {
  if (s === undefined || s === null || s === "" || s === "NA") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

async function assurerFichier() {
  await mkdir(CACHE, { recursive: true });
  const chemin = path.join(CACHE, SSMSI.fichier);
  if (existsSync(chemin)) return chemin;
  console.log("Téléchargement du fichier communal SSMSI…");
  const reponse = await fetch(SSMSI.url, { headers: { "user-agent": "ou-vivre/1.0" }, redirect: "follow" });
  if (!reponse.ok) throw new Error(`${SSMSI.url} → HTTP ${reponse.status}`);
  await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
  return chemin;
}

async function main() {
  const regions = [];
  const codes = new Set();
  for (const d of (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    try {
      const referentiel = JSON.parse(await readFile(path.join(RAW, d.name, "referentiel.json"), "utf8"));
      regions.push({ dossier: path.join(RAW, d.name), communes: referentiel.communes ?? [] });
      for (const c of referentiel.communes ?? []) codes.add(c.codeInsee);
    } catch {
      /* dossier sans référentiel */
    }
  }
  console.log(`${codes.size} communes dans ${regions.length} régions.`);

  // Un modèle d'unités et de limites : celui d'une extraction existante si possible,
  // pour ne pas réécrire à la main un texte déjà validé.
  let modele = null;
  for (const region of regions) {
    try {
      modele = JSON.parse(await readFile(path.join(region.dossier, "securite.json"), "utf8"));
      if (modele?.unites) break;
    } catch {
      /* pas d'extraction ici */
    }
  }

  const chemin = await assurerFichier();
  const rl = createInterface({ input: createReadStream(chemin).pipe(createGunzip()) });
  let entete = null;
  let idx = {};
  const parCommune = new Map(); // code → { annee → { champ → {nombre, taux, diffuse} }, pop, log }
  let lignes = 0;
  let inconnus = new Set();
  for await (const ligne of rl) {
    const v = ligne.split(";").map(nettoyer);
    if (!entete) {
      entete = v;
      idx = Object.fromEntries(entete.map((k, i) => [k, i]));
      for (const k of ["annee", "indicateur", "nombre", "taux_pour_mille", "est_diffuse", "insee_pop", "insee_pop_millesime", "insee_log", "insee_log_millesime"]) {
        if (!(k in idx)) throw new Error(`Colonne ${k} absente : ${entete.join(" | ")}`);
      }
      continue;
    }
    const code = v[0];
    if (!codes.has(code)) continue;
    const champ = INDICATEURS[v[idx.indicateur]];
    if (!champ) {
      inconnus.add(v[idx.indicateur]);
      continue;
    }
    lignes += 1;
    const annee = Number(v[idx.annee]);
    const entree = parCommune.get(code) ?? { annees: new Map() };
    const parAnnee = entree.annees.get(annee) ?? {};
    parAnnee[champ] = {
      diffuse: v[idx.est_diffuse] === "diff",
      nombre: num(v[idx.nombre]),
      taux: num(v[idx.taux_pour_mille]),
    };
    entree.annees.set(annee, parAnnee);
    if (annee === ANNEE) {
      entree.pop = num(v[idx.insee_pop]);
      entree.popMillesime = num(v[idx.insee_pop_millesime]);
      entree.log = num(v[idx.insee_log]);
      entree.logMillesime = num(v[idx.insee_log_millesime]);
    }
    parCommune.set(code, entree);
  }
  console.log(`${lignes} lignes retenues pour ${parCommune.size} communes.`);
  if (inconnus.size) console.warn(`Indicateurs non prévus, ignorés : ${[...inconnus].join(" / ")}`);

  const consulteLe = new Date().toISOString().slice(0, 10);
  const source = {
    nom: "Bases statistiques communale, départementale et régionale de la délinquance enregistrée par la police et la gendarmerie nationales",
    producteur: "SSMSI — Service statistique ministériel de la sécurité intérieure (Ministère de l'Intérieur)",
    url: SSMSI.page,
    annee: `${ANNEE} (géographie communale au 1er janvier 2026)`,
    licence: "Licence Ouverte / Open Licence version 2.0 (lov2)",
    consulteLe,
  };
  const methodologie =
    `Fichier communal national du SSMSI (ressource ${SSMSI.ressource}, csv.gz) lu en flux : 15 indicateurs × 10 années 2016-${ANNEE} pour chaque commune. ` +
    `Taux pour mille tels que publiés (pour 1 000 habitants, cambriolages pour 1 000 logements), dénominateurs INSEE du fichier. ` +
    `Secret statistique si 5 faits ou moins sur 3 années consécutives (est_diffuse = ndiff) : nombre et taux laissés null, jamais estimés ni reconstitués. ` +
    `Même ressource et mêmes règles que l'extraction commune par commune des premières régions.`;
  const caveats = modele?.caveats ?? [
    "Faits enregistrés ≠ délinquance réelle.",
    "Comptage au lieu de commission, pas au lieu de résidence (sauf escroqueries, comptées au domicile de la victime).",
    "Secret statistique si 5 faits ou moins sur 3 années consécutives : jamais estimé ni reconstitué.",
    "Dénominateurs hétérogènes : cambriolages pour 1 000 logements, tous les autres indicateurs pour 1 000 habitants.",
    "Petites communes rurales : forte volatilité du taux pour mille, cause directe d'un taux de masquage élevé.",
  ];
  const unites = modele?.unites ?? {};

  let total = 0;
  let absentes = 0;
  for (const region of regions) {
    const communes = {};
    const historique = {};
    for (const c of region.communes) {
      const e = parCommune.get(c.codeInsee);
      const derniere = e?.annees.get(ANNEE);
      if (!e || !derniere) {
        absentes += 1;
        continue;
      }
      const sortie = {
        nom: c.nom,
        populationReference: e.pop,
        populationReferenceMillesime: e.popMillesime,
        logementsReference: e.log,
        logementsReferenceMillesime: e.logMillesime,
      };
      let diffuses = 0;
      let secrets = 0;
      for (const champ of Object.values(INDICATEURS)) {
        const x = derniere[champ];
        const ok = x?.diffuse === true;
        sortie[`taux${champ}`] = ok ? x.taux : null;
        sortie[`nb${champ}`] = ok ? x.nombre : null;
        if (x) ok ? (diffuses += 1) : (secrets += 1);
      }
      sortie.nbIndicateursDiffuses = diffuses;
      sortie.nbIndicateursSecretStatistique = secrets;
      const intra = derniere.ViolencesPhysiquesIntrafamiliales;
      const hors = derniere.ViolencesPhysiquesHorsCadreFamilial;
      if (intra?.diffuse && hors?.diffuse) {
        sortie.nbViolencesPhysiquesTotal = intra.nombre + hors.nombre;
        sortie.tauxViolencesPhysiquesTotal = Math.round((intra.taux + hors.taux) * 1e7) / 1e7;
      } else {
        sortie.nbViolencesPhysiquesTotal = null;
        sortie.tauxViolencesPhysiquesTotal = null;
      }
      communes[c.codeInsee] = sortie;

      const h = {};
      for (const [champ, cle] of Object.entries(HISTORIQUE)) {
        const points = [];
        for (const [annee, valeurs] of [...e.annees.entries()].sort((a, b) => a[0] - b[0])) {
          const x = valeurs[champ];
          if (x?.diffuse) points.push({ annee, valeur: x.taux });
        }
        if (points.length) h[cle] = points;
      }
      historique[c.codeInsee] = h;
      total += 1;
    }
    await writeFile(
      path.join(region.dossier, "securite.json"),
      JSON.stringify({ source, methodologie, caveats, unites, communes }, null, 1),
      "utf8",
    );
    await writeFile(
      path.join(region.dossier, "securite-historique.json"),
      JSON.stringify(
        {
          source,
          methodologie:
            "Taux pour mille par année 2016-2025 des quatre indicateurs classants, tels que publiés ; les années sous secret statistique sont omises, jamais interpolées.",
          communes: historique,
        },
        null,
        1,
      ),
      "utf8",
    );
  }
  console.log(`${total} communes écrites${absentes ? `, ${absentes} absentes du fichier SSMSI` : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
