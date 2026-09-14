#!/usr/bin/env node
/**
 * Climat — normales 1991-2020 calculées depuis les données climatologiques
 * mensuelles de Météo-France (données publiques, une archive par département),
 * rattachées à chaque commune par la station la plus proche.
 *
 *   node scripts/importer-climat.mjs [--dossier <cache>]
 *
 * Pour chaque station et chaque mois de l'année, la moyenne des valeurs
 * mensuelles observées de 1991 à 2020 (au moins 20 années sur 30, sinon la
 * station est écartée pour cette grandeur). Les douze moyennes mensuelles sont
 * sommées (précipitations, jours, insolation) ou moyennées (température) pour
 * donner la normale annuelle. Six grandeurs : durée d'insolation, cumul de
 * précipitations, jours de pluie (≥ 1 mm), température moyenne, jours à 30 °C
 * ou plus, jours de gelée.
 *
 * Une commune n'a pas de station : elle reçoit la normale de la station valide
 * la plus proche, pour chaque famille (insolation ; précipitations ;
 * températures) séparément — les stations qui mesurent l'insolation sont bien
 * moins nombreuses. Le nom, l'altitude et la distance de la station sont
 * conservés pour être affichés (maille déclarée). Au-delà d'une distance
 * limite, la grandeur reste absente : jamais estimée.
 *
 * Écrit `data/raw/<région>/climat.json`.
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
const CACHE = args.includes("--dossier") ? path.resolve(args[args.indexOf("--dossier") + 1]) : path.join(RACINE, ".cache-insee");

const METEO = {
  page: "https://www.data.gouv.fr/datasets/donnees-climatologiques-de-base-mensuelles",
  base: "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/MENS",
  fichier: (dep) => `MENSQ_${dep}_previous-1950-2024.csv.gz`,
  dossier: "meteo",
};
const DEBUT = 1991;
const FIN = 2020;
const ANNEES_MIN = 20; // années renseignées par mois de l'année, sur 30
/** Départements métropolitains des fichiers Météo-France (la Corse est « 20 »). */
const DEPARTEMENTS = [...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, "0"))].filter((d) => d !== "20").concat("20");

/**
 * Grandeurs lues, par famille de rattachement. `cumul` : la normale annuelle
 * est la somme des douze moyennes mensuelles ; sinon leur moyenne.
 */
const FAMILLES = {
  soleil: { champs: { INST: { cle: "ensoleillementHeures", cumul: true, facteur: 1 / 60 } }, distanceMax: 100 },
  pluie: {
    champs: { RR: { cle: "precipitationsMm", cumul: true }, NBJRR1: { cle: "joursPluie", cumul: true } },
    distanceMax: 40,
  },
  temperature: {
    champs: {
      TM: { cle: "temperatureMoyenne", cumul: false },
      NBJTX30: { cle: "joursChauds", cumul: true },
      NBJGELEE: { cle: "joursGel", cumul: true },
    },
    distanceMax: 40,
  },
};

const num = (s) => {
  if (s === undefined || s === null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function distanceKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

async function assurer(dep) {
  const chemin = path.join(CACHE, METEO.dossier, METEO.fichier(dep));
  if (existsSync(chemin)) return chemin;
  await mkdir(path.dirname(chemin), { recursive: true });
  const url = `${METEO.base}/${METEO.fichier(dep)}`;
  const reponse = await fetch(url, { headers: { "user-agent": "ou-vivre/1.0" } });
  if (!reponse.ok) throw new Error(`${url} → HTTP ${reponse.status}`);
  await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()));
  return chemin;
}

/**
 * Lit un fichier départemental et accumule, par station, par grandeur et par
 * mois de l'année, les valeurs 1991-2020.
 */
async function lireDepartement(chemin, stations) {
  const rl = createInterface({ input: createReadStream(chemin).pipe(createGunzip()) });
  let idx = null;
  const champs = Object.values(FAMILLES).flatMap((f) => Object.keys(f.champs));
  for await (const ligne of rl) {
    const v = ligne.split(";");
    if (!idx) {
      idx = Object.fromEntries(v.map((k, i) => [k.trim(), i]));
      for (const c of ["NUM_POSTE", "NOM_USUEL", "LAT", "LON", "ALTI", "AAAAMM", ...champs]) {
        if (!(c in idx)) throw new Error(`Colonne ${c} absente de ${path.basename(chemin)}`);
      }
      continue;
    }
    const annee = Number(v[idx.AAAAMM].slice(0, 4));
    if (annee < DEBUT || annee > FIN) continue;
    const mois = Number(v[idx.AAAAMM].slice(4, 6)) - 1;
    const id = v[idx.NUM_POSTE];
    let station = stations.get(id);
    if (!station) {
      station = {
        id,
        nom: v[idx.NOM_USUEL].trim(),
        lat: num(v[idx.LAT]),
        lon: num(v[idx.LON]),
        altitude: num(v[idx.ALTI]),
        valeurs: Object.fromEntries(champs.map((c) => [c, Array.from({ length: 12 }, () => [])])),
      };
      stations.set(id, station);
    }
    for (const c of champs) {
      const x = num(v[idx[c]]);
      if (x !== null) station.valeurs[c][mois].push(x);
    }
  }
}

/** Normale annuelle d'une grandeur pour une station, ou null si la couverture est insuffisante. */
function normale(station, champ, { cumul, facteur = 1 }) {
  const mensuelles = [];
  for (const valeurs of station.valeurs[champ]) {
    if (valeurs.length < ANNEES_MIN) return null;
    mensuelles.push(valeurs.reduce((s, x) => s + x, 0) / valeurs.length);
  }
  const total = mensuelles.reduce((s, x) => s + x, 0);
  return (cumul ? total : total / 12) * facteur;
}

function arrondir(x, decimales) {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

async function main() {
  const regions = [];
  for (const d of (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    try {
      const referentiel = JSON.parse(await readFile(path.join(RAW, d.name, "referentiel.json"), "utf8"));
      regions.push({ dossier: path.join(RAW, d.name), communes: referentiel.communes ?? [] });
    } catch {
      /* dossier sans référentiel */
    }
  }
  const nbCommunes = regions.reduce((n, r) => n + r.communes.length, 0);
  console.log(`${nbCommunes} communes dans ${regions.length} régions.`);

  // --- Stations et normales.
  const stations = new Map();
  for (const dep of DEPARTEMENTS) {
    process.stdout.write(`\r  lecture ${dep}…  `);
    await lireDepartement(await assurer(dep), stations);
  }
  console.log(`\r${stations.size} stations avec des observations ${DEBUT}-${FIN}.`);

  // Par famille : les stations valides (toutes les grandeurs de la famille renseignées) et leurs normales.
  const valides = {};
  for (const [famille, def] of Object.entries(FAMILLES)) {
    valides[famille] = [];
    for (const station of stations.values()) {
      if (station.lat === null || station.lon === null) continue;
      const normales = {};
      let ok = true;
      for (const [champ, spec] of Object.entries(def.champs)) {
        const n = normale(station, champ, spec);
        if (n === null) {
          ok = false;
          break;
        }
        normales[spec.cle] = n;
      }
      if (ok) valides[famille].push({ station, normales });
    }
    console.log(`  ${famille} : ${valides[famille].length} stations valides.`);
  }

  // --- Rattachement de chaque commune à la station la plus proche, par famille.
  const plusProche = (liste, lat, lon) => {
    let meilleure = null;
    let d = Infinity;
    for (const s of liste) {
      const dist = distanceKm(lat, lon, s.station.lat, s.station.lon);
      if (dist < d) {
        d = dist;
        meilleure = s;
      }
    }
    return meilleure ? { ...meilleure, distanceKm: d } : null;
  };

  const consulteLe = new Date().toISOString().slice(0, 10);
  let total = 0;
  const horsPortee = { soleil: 0, pluie: 0, temperature: 0 };
  const distances = { soleil: [], pluie: [], temperature: [] };
  let biarritz = null;
  for (const region of regions) {
    const communes = {};
    for (const c of region.communes) {
      if (c.lat == null || c.lon == null) continue;
      const entree = { nom: c.nom };
      for (const [famille, def] of Object.entries(FAMILLES)) {
        const proche = plusProche(valides[famille], c.lat, c.lon);
        if (!proche || proche.distanceKm > def.distanceMax) {
          horsPortee[famille]++;
          entree[famille] = null;
          continue;
        }
        distances[famille].push(proche.distanceKm);
        const valeurs = {};
        for (const spec of Object.values(def.champs)) {
          valeurs[spec.cle] = arrondir(proche.normales[spec.cle], spec.cle === "temperatureMoyenne" ? 1 : 0);
        }
        entree[famille] = {
          station: proche.station.nom,
          altitude: proche.station.altitude,
          distanceKm: arrondir(proche.distanceKm, 1),
          ...valeurs,
        };
      }
      communes[c.codeInsee] = entree;
      if (c.codeInsee === "64122") biarritz = entree;
      total++;
    }
    await writeFile(
      path.join(region.dossier, "climat.json"),
      JSON.stringify(
        {
          source: {
            nom: "Données climatologiques de base mensuelles (Météo-France), normales 1991-2020 calculées par station",
            nomCourt: "Météo-France 1991-2020",
            producteur: "Météo-France",
            url: METEO.page,
            annee: `${DEBUT}-${FIN}`,
            licence: "Licence Ouverte / Etalab 2.0",
            consulteLe,
          },
          methodologie:
            `Pour chaque station Météo-France et chaque mois de l'année, moyenne des valeurs mensuelles observées de ${DEBUT} à ${FIN} (au moins ${ANNEES_MIN} années sur 30, sinon la station est écartée pour cette grandeur) ; ` +
            "les douze moyennes sont sommées (insolation, précipitations, nombres de jours) ou moyennées (température) pour obtenir la normale annuelle. " +
            "Chaque commune reçoit la normale de la station valide la plus proche de son centre, séparément pour l'insolation (stations rares, jusqu'à 100 km), les précipitations et les températures (jusqu'à 40 km) ; le nom, l'altitude et la distance de la station sont indiqués. Au-delà, la grandeur reste absente.",
          caveats: [
            "Ce sont les observations de la station la plus proche, pas celles de la commune : à quelques kilomètres, en montagne ou près du littoral, le climat peut différer sensiblement ; l'altitude de la station est donnée pour en juger.",
            "Les normales décrivent 1991-2020 ; le climat se réchauffe et les dernières années sont en général plus chaudes et plus ensoleillées que la normale.",
            "L'insolation n'est mesurée que dans une centaine de stations : la station de rattachement peut être éloignée.",
          ],
          communes,
        },
        null,
        1,
      ),
      "utf8",
    );
  }
  const mediane = (l) => (l.length ? arrondir(l.sort((a, b) => a - b)[Math.floor(l.length / 2)], 1) : null);
  console.log(
    `${total} communes écrites. Distance médiane à la station : soleil ${mediane(distances.soleil)} km, pluie ${mediane(distances.pluie)} km, températures ${mediane(distances.temperature)} km. Hors portée : soleil ${horsPortee.soleil}, pluie ${horsPortee.pluie}, températures ${horsPortee.temperature}.`,
  );
  // --- Vérification contre les normales publiées par Météo-France pour la
  // station Biarritz-Pays-Basque (1991-2020) : 1 920,6 h d'insolation,
  // 1 473,6 mm de précipitations, 14,5 °C de température moyenne.
  if (!biarritz) throw new Error("Vérification impossible : Biarritz (64122) absente.");
  const ecarts = [
    ["insolation", biarritz.soleil?.ensoleillementHeures, 1921, 3],
    ["précipitations", biarritz.pluie?.precipitationsMm, 1474, 3],
    ["température moyenne", biarritz.temperature?.temperatureMoyenne, 14.5, 0.15],
  ].filter(([, obtenu, attendu, tolerance]) => obtenu == null || Math.abs(obtenu - attendu) > tolerance);
  if (ecarts.length) {
    throw new Error(
      `Vérification Biarritz : ${ecarts.map(([nom, obtenu, attendu]) => `${nom} = ${obtenu}, attendu ${attendu}`).join(" ; ")} (normales Météo-France 1991-2020).`,
    );
  }
  console.log(
    `Vérification Biarritz : ${biarritz.soleil.ensoleillementHeures} h, ${biarritz.pluie.precipitationsMm} mm, ${biarritz.temperature.temperatureMoyenne} °C — conforme aux normales Météo-France 1991-2020 (station ${biarritz.soleil.station}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
