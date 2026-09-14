#!/usr/bin/env node
/**
 * Immobilier — prix médian au m² recalculé à partir des mutations DVF brutes
 * (Demandes de valeurs foncières géolocalisées, Etalab), pour toutes les
 * communes, millésimes 2021 à 2025.
 *
 *   node scripts/importer-immobilier.mjs [--dossier <cache>] [--departement 01]
 *
 * Méthode, celle des premières extractions (retrouvée à une vente près sur les
 * 87 communes de l'Ain déjà extraites) : dédoublonnage strict des lignes ; ventes seules
 * (Vente, Vente en l'état futur d'achèvement, Adjudication) ; locaux de type 1,
 * 2 ou 4 (maison, appartement, local commercial) ; mutations mono-bien
 * uniquement (exactement un local distinct — type et surface — de ces types) ;
 * prix au m² = valeur foncière / surface réelle bâtie ; exclusion des prix ≥ 100 000 €/m² ; médiane par
 * commune et par type (maison, appartement) sur les cinq années cumulées, puis
 * par année. L'évolution sur un an compare la médiane 2025 à celle de 2024,
 * publiée seulement si chacune compte au moins 30 ventes du type ; sinon
 * `echantillon_insuffisant`. Une commune sans vente retenue a une médiane
 * absente, jamais estimée.
 *
 * Les fichiers départementaux (`geo-dvf/latest/csv/<année>/departements/<dép>.csv.gz`)
 * sont téléchargés dans le cache puis lus en flux. Écrit `data/raw/<région>/immobilier.json`
 * et `immobilier-historique.json`.
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
const CACHE = path.join(
  args.includes("--dossier") ? path.resolve(args[args.indexOf("--dossier") + 1]) : path.join(RACINE, ".cache-insee"),
  "dvf",
);
const SEULEMENT = args.includes("--departement") ? args[args.indexOf("--departement") + 1] : null;

const ANNEES = [2021, 2022, 2023, 2024, 2025];
const DERNIERE = 2025;
const AVANT_DERNIERE = 2024;
const VENTES = new Set(["Vente", "Vente en l'état futur d'achèvement", "Adjudication"]);
const TYPES_LOCAUX = new Set(["1", "2", "4"]);
const PRIX_MAX = 100000;
const VENTES_MIN_EVOLUTION = 30;
const PAGE = "https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees";
/**
 * Départements sans publicité foncière DGFiP comparable : l'Alsace-Moselle relève
 * du droit local (livre foncier) et Mayotte n'est pas couvert. DVF n'y publie
 * rien ; le critère prix y est structurellement absent, pas seulement incomplet.
 */
const HORS_DVF = new Set(["57", "67", "68", "976"]);

/**
 * Paris, Lyon et Marseille : DVF code chaque mutation à l'arrondissement
 * (75101-75120, 69381-69389, 13201-13216) alors que le référentiel porte la
 * commune (75056, 69123, 13055). Les ventes sont rattachées à la commune.
 */
function communeDe(code) {
  if (/^751(0[1-9]|1\d|20)$/.test(code)) return "75056";
  if (/^6938\d$/.test(code)) return "69123";
  if (/^132(0[1-9]|1[0-6])$/.test(code)) return "13055";
  return code;
}
const urlFichier = (annee, dep) => `https://files.data.gouv.fr/geo-dvf/latest/csv/${annee}/departements/${dep}.csv.gz`;

/** Découpe une ligne CSV (virgules, guillemets doublés). */
function decouper(ligne) {
  const champs = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const ch = ligne[i];
    if (entreGuillemets) {
      if (ch === '"') {
        if (ligne[i + 1] === '"') {
          courant += '"';
          i += 1;
        } else entreGuillemets = false;
      } else courant += ch;
    } else if (ch === '"') entreGuillemets = true;
    else if (ch === ",") {
      champs.push(courant);
      courant = "";
    } else courant += ch;
  }
  champs.push(courant);
  return champs;
}

function mediane(valeurs) {
  if (valeurs.length === 0) return null;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = t.length >> 1;
  return Math.round(t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2);
}

async function telecharger(url, chemin) {
  const reponse = await fetch(url, { headers: { "user-agent": "ou-vivre/1.0" } });
  if (reponse.status === 404) return false;
  if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
  await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
  return true;
}

/**
 * Lit un fichier département-année et ajoute les prix retenus dans `ventes` :
 * code commune → année → { maison: number[], appartement: number[] }.
 */
async function lireFichier(chemin, annee, codes, ventes) {
  const rl = createInterface({ input: createReadStream(chemin).pipe(createGunzip()) });
  let idx = null;
  const vues = new Set();
  const mutations = new Map(); // id_mutation → lignes retenues
  for await (const ligne of rl) {
    if (!idx) {
      const entete = decouper(ligne);
      idx = Object.fromEntries(entete.map((k, i) => [k, i]));
      continue;
    }
    if (vues.has(ligne)) continue; // dédoublonnage strict
    vues.add(ligne);
    const v = decouper(ligne);
    if (!VENTES.has(v[idx.nature_mutation])) continue;
    const id = v[idx.id_mutation];
    const liste = mutations.get(id) ?? [];
    liste.push(v);
    mutations.set(id, liste);
  }
  let retenues = 0;
  for (const lignes of mutations.values()) {
    // Un même local apparaît sur plusieurs lignes quand la vente porte sur
    // plusieurs parcelles ou lots : les locaux distincts se reconnaissent au
    // couple (type, surface). Mono-bien = exactement un local de type 1, 2 ou 4.
    const locaux = new Map();
    for (const v of lignes) {
      if (TYPES_LOCAUX.has(v[idx.code_type_local])) locaux.set(`${v[idx.code_type_local]}|${v[idx.surface_reelle_bati]}`, v);
    }
    if (locaux.size !== 1) continue;
    const l = [...locaux.values()][0];
    const type = l[idx.code_type_local] === "1" ? "maison" : l[idx.code_type_local] === "2" ? "appartement" : null;
    if (!type) continue;
    const code = communeDe(l[idx.code_commune]);
    if (!codes.has(code)) continue;
    const valeur = Number(l[idx.valeur_fonciere]);
    const surface = Number(l[idx.surface_reelle_bati]);
    if (!Number.isFinite(valeur) || !Number.isFinite(surface) || surface <= 0 || valeur <= 0) continue;
    const prix = valeur / surface;
    if (prix >= PRIX_MAX) continue;
    const parCommune = ventes.get(code) ?? new Map();
    const parAnnee = parCommune.get(annee) ?? { maison: [], appartement: [] };
    parAnnee[type].push(prix);
    parCommune.set(annee, parAnnee);
    ventes.set(code, parCommune);
    retenues += 1;
  }
  return retenues;
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const regions = [];
  for (const d of (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    try {
      const referentiel = JSON.parse(await readFile(path.join(RAW, d.name, "referentiel.json"), "utf8"));
      const dep = referentiel.communes?.[0]?.departement;
      if (!dep || (SEULEMENT && dep !== SEULEMENT)) continue;
      regions.push({ dossier: d.name, dep, communes: referentiel.communes ?? [] });
    } catch {
      /* dossier sans référentiel */
    }
  }
  const consulteLe = new Date().toISOString().slice(0, 10);

  for (const region of regions) {
    const codes = new Set(region.communes.map((c) => c.codeInsee));
    const ventes = new Map();
    let total = 0;
    const manquants = [];
    const horsDvf = HORS_DVF.has(region.dep);
    for (const annee of horsDvf ? [] : ANNEES) {
      const chemin = path.join(CACHE, `${region.dep}-${annee}.csv.gz`);
      if (!existsSync(chemin)) {
        const ok = await telecharger(urlFichier(annee, region.dep), chemin);
        if (!ok) {
          manquants.push(annee);
          continue;
        }
      }
      total += await lireFichier(chemin, annee, codes, ventes);
    }

    const communes = {};
    const historique = {};
    for (const c of region.communes) {
      const parAnnee = ventes.get(c.codeInsee) ?? new Map();
      const tout = { maison: [], appartement: [] };
      const points = { maison: [], appartement: [] };
      for (const annee of ANNEES) {
        const a = parAnnee.get(annee);
        if (!a) continue;
        for (const type of ["maison", "appartement"]) {
          tout[type].push(...a[type]);
          if (a[type].length) points[type].push({ annee, valeur: mediane(a[type]) });
        }
      }
      const de = (type, annee) => parAnnee.get(annee)?.[type] ?? [];
      const evolution = (type) => {
        const avant = de(type, AVANT_DERNIERE);
        const apres = de(type, DERNIERE);
        if (avant.length < VENTES_MIN_EVOLUTION || apres.length < VENTES_MIN_EVOLUTION) return null;
        return Math.round((mediane(apres) / mediane(avant) - 1) * 1000) / 10;
      };
      const evoApp = evolution("appartement");
      const evoMaison = evolution("maison");
      const sortie = {
        nom: c.nom,
        prixM2MedianAppartement: mediane(tout.appartement),
        ...(horsDvf ? { prixM2MedianAppartement_statut: "indisponible" } : {}),
        prixM2MedianMaison: mediane(tout.maison),
        ...(horsDvf ? { prixM2MedianMaison_statut: "indisponible" } : {}),
        nbTransactions: tout.appartement.length + tout.maison.length,
        nbTransactionsAppartement: tout.appartement.length,
        nbTransactionsMaison: tout.maison.length,
        evolution1anPct: evoApp,
        ...(evoApp === null ? { evolution1anPct_statut: "echantillon_insuffisant" } : {}),
        evolution1anMaisonPct: evoMaison,
        ...(evoMaison === null ? { evolution1anMaisonPct_statut: "echantillon_insuffisant" } : {}),
        prixM2MedianAppartement2024: mediane(de("appartement", AVANT_DERNIERE)),
        prixM2MedianAppartement2025: mediane(de("appartement", DERNIERE)),
        nbTransactionsAppartement2024: de("appartement", AVANT_DERNIERE).length,
        nbTransactionsAppartement2025: de("appartement", DERNIERE).length,
        prixM2MedianMaison2024: mediane(de("maison", AVANT_DERNIERE)),
        prixM2MedianMaison2025: mediane(de("maison", DERNIERE)),
        nbTransactionsMaison2024: de("maison", AVANT_DERNIERE).length,
        nbTransactionsMaison2025: de("maison", DERNIERE).length,
      };
      communes[c.codeInsee] = sortie;
      const h = {};
      if (points.appartement.length) h.appartement = points.appartement;
      if (points.maison.length) h.maison = points.maison;
      historique[c.codeInsee] = h;
    }

    const source = {
      nom: `Demandes de valeurs foncières géolocalisées (DVF) - fichiers départementaux, département ${region.dep}, millésimes 2021 à 2025`,
      producteur: "DGFiP (données source DVF) / Etalab - data.gouv.fr (géolocalisation et mise en forme)",
      url: PAGE,
      urlRessource: `https://files.data.gouv.fr/geo-dvf/latest/csv/{2021,2022,2023,2024,2025}/departements/${region.dep}.csv.gz`,
      annee: "mutations du 2021-01-01 au 2025-12-31 (dernière livraison Etalab)",
      licence: "Licence Ouverte / Open Licence version 2.0",
      consulteLe,
    };
    const methodologie = horsDvf
      ? "DVF ne publie aucune donnée pour ce département : Alsace-Moselle (57, 67, 68) relève du droit local (livre foncier, pas de publicité foncière DGFiP comparable) et Mayotte (976) n'est pas couvert par le dispositif. Aucune mutation immobilière n'est donc disponible par cette source ; les champs de ce critère restent à null pour toutes les communes, jamais remplacés par une estimation."
      : "Prix médian au m² recalculé à partir des mutations DVF brutes 2021-2025 (5 ans cumulés) en appliquant la méthode Etalab, la même pour toutes les communes : " +
      "dédoublonnage strict des lignes, ventes seules (Vente, VEFA, Adjudication), types de local 1/2/4 (maison, appartement, local commercial), mutations mono-bien uniquement, " +
      "prix_m2 = valeur_fonciere / surface_reelle_bati, exclusion des prix >= 100 000 EUR/m2, puis médiane par commune et par type de bien. " +
      "L'évolution sur 1 an compare la médiane 2025 à celle de 2024, publiée seulement si chacun des deux millésimes compte au moins 30 ventes du type concerné. " +
      `Fichiers départementaux lus en flux (${total} ventes retenues sur le département)${manquants.length ? ` ; millésimes absents : ${manquants.join(", ")}` : ""}.`;
    const caveats = [
      ...(horsDvf
        ? ["Aucune donnée DVF n'existe pour ce département (droit local Alsace-Moselle, ou Mayotte) : le critère prix immobilier est structurellement absent, pas seulement incomplet."]
        : []),
      "Prix d'acte notarié, hors frais de notaire et hors commission d'agence.",
      "La médiane principale porte sur 5 années cumulées (2021-2025), pas sur le marché du jour.",
      "Donnée en retard d'environ 8 mois : la mutation la plus récente disponible date du 31 décembre 2025.",
      "Surface utilisée : la surface réelle bâtie du fichier fiscal, pas la surface loi Carrez.",
      "Ventes en lot exclues : seules les mutations mono-bien sont retenues.",
      "Le neuf est inclus (VEFA), ce qui tire la médiane vers le haut dans les communes en fort développement.",
      "Filtrage des valeurs aberrantes minimal : seul garde-fou appliqué, l'exclusion des prix supérieurs à 100 000 EUR/m2.",
      "L'évolution sur 1 an est mise à null dès que l'un des deux millésimes compte moins de 30 ventes du type de bien concerné.",
      "nbTransactions est le nombre de ventes RETENUES après filtrage, pas le nombre total de mutations de la commune.",
      "Dans une petite commune, une médiane calculée sur quelques ventes est très volatile : le nombre de ventes est affiché à côté.",
      "Un prix médian communal ne dit rien d'un bien particulier : c'est un repère de niveau de marché, pas une estimation immobilière.",
    ];
    const dossier = path.join(RAW, region.dossier);
    await writeFile(path.join(dossier, "immobilier.json"), JSON.stringify({ source, methodologie, caveats, communes }, null, 1), "utf8");
    await writeFile(
      path.join(dossier, "immobilier-historique.json"),
      JSON.stringify(
        {
          source,
          methodologie: "Médiane annuelle du prix au m² par type de bien, mêmes filtres que la médiane cumulée ; une année sans vente retenue est omise, jamais interpolée.",
          communes: historique,
        },
        null,
        1,
      ),
      "utf8",
    );
    const renseignees = Object.values(communes).filter((c) => c.nbTransactions > 0).length;
    console.log(`${region.dossier.padEnd(26)} ${region.dep}  ${String(total).padStart(7)} ventes · ${renseignees}/${region.communes.length} communes avec au moins une vente`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
