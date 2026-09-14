#!/usr/bin/env node
/**
 * Fiscalité locale — taux de taxe foncière votés, par commune (DGFiP, fichier
 * REI 2025 : recensement des éléments d'imposition à la fiscalité directe locale).
 *
 *   node scripts/importer-fiscalite.mjs [--dossier <cache>]
 *
 * Le REI est le fichier de référence des impôts locaux : une ligne par commune,
 * plus de mille colonnes. On en lit la taxe foncière sur les propriétés bâties
 * (TFB), ce qu'un propriétaire paie chaque année : taux communal, taux
 * intercommunal, syndicats, taxes spéciales d'équipement, GEMAPI et TASA — leur
 * somme est le taux global appliqué sur la commune —, la taxe d'enlèvement des
 * ordures ménagères (TEOM, taux plein) et la majoration de taxe d'habitation sur
 * les résidences secondaires. Tous les taux sont repris tels que publiés, en
 * pourcentage de la valeur locative cadastrale.
 *
 * Écrit `data/raw/<région>/fiscalite.json`.
 */
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");
const args = process.argv.slice(2);
const CACHE = args.includes("--dossier") ? path.resolve(args[args.indexOf("--dossier") + 1]) : path.join(RACINE, ".cache-insee");
const ANNEE = 2025;
const REI = {
  page: "https://www.data.gouv.fr/datasets/impots-locaux-fichier-de-recensement-des-elements-dimposition-a-la-fiscalite-directe-locale-rei-4",
  zip: "https://data.economie.gouv.fr/api/v2/catalog/datasets/impots-locaux-fichier-de-recensement-des-elements-dimposition-a-la-fiscalite-dir/attachments/rei_2025_fichier_notice_tracezip",
  dossier: "rei2025",
  fichier: "REI_2025.csv",
};

const num = (s) => {
  if (s === undefined || s === null || s === "") return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const somme = (...v) => Math.round(v.reduce((t, x) => t + (x ?? 0), 0) * 1000) / 1000;

async function assurer() {
  const chemin = path.join(CACHE, REI.dossier, REI.fichier);
  if (existsSync(chemin)) return chemin;
  await mkdir(path.join(CACHE, REI.dossier), { recursive: true });
  const zip = path.join(CACHE, "rei2025.zip");
  if (!existsSync(zip)) {
    console.log("Téléchargement du REI 2025 (~18 Mo)…");
    const reponse = await fetch(REI.zip, { headers: { "user-agent": "ou-vivre/1.0" } });
    if (!reponse.ok) throw new Error(`${REI.zip} → HTTP ${reponse.status}`);
    await writeFile(zip, Buffer.from(await reponse.arrayBuffer()));
  }
  const { execSync } = await import("node:child_process");
  try {
    execSync(`unzip -o -q "${zip}" -d "${path.join(CACHE, REI.dossier)}"`, { stdio: "ignore" });
  } catch {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${zip}' -DestinationPath '${path.join(CACHE, REI.dossier)}'"`, { stdio: "ignore" });
  }
  if (!existsSync(chemin)) throw new Error(`Fichier attendu absent après extraction : ${chemin}`);
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

  const chemin = await assurer();
  const rl = createInterface({ input: createReadStream(chemin, { encoding: "utf8" }) });
  let idx = null;
  const taux = new Map();
  for await (const ligne of rl) {
    const v = ligne.split(";");
    if (!idx) {
      idx = Object.fromEntries(v.map((k, i) => [k.trim(), i]));
      for (const k of ["DEP", "COM", "E12", "E22", "E32", "E52", "E52A", "E52gGEMAPI", "E52TASA", "F22", "TXMAJOTHRS"]) {
        if (!(k in idx)) throw new Error(`Colonne ${k} absente du REI`);
      }
      continue;
    }
    const dep = v[idx.DEP].trim();
    const com = v[idx.COM].trim();
    if (dep.length > 2) continue; // outre-mer
    const code = `${dep}${com.padStart(3, "0")}`;
    if (!codes.has(code)) continue;
    const commune = num(v[idx.E12]);
    const syndicats = num(v[idx.E22]);
    const epci = num(v[idx.E32]);
    const tse = somme(num(v[idx.E52]), num(v[idx.E52A]));
    const gemapi = num(v[idx.E52gGEMAPI]);
    const tasa = num(v[idx.E52TASA]);
    const teom = num(v[idx.F22]);
    const majorationThrs = num(v[idx.TXMAJOTHRS]);
    taux.set(code, {
      tauxTfbCommune: commune,
      tauxTfbEpci: epci,
      tauxTfbSyndicats: syndicats,
      tauxTfbTse: tse,
      tauxTfbGemapi: gemapi,
      tauxTfbTasa: tasa,
      tauxTfbGlobal: commune === null ? null : somme(commune, syndicats, epci, tse, gemapi, tasa),
      // Un taux de TEOM nul ou absent : la commune finance les déchets autrement
      // (redevance incitative, budget général). Absent, jamais 0 %.
      tauxTeom: teom && teom > 0 ? teom : null,
      majorationThResidencesSecondaires: majorationThrs && majorationThrs > 0 ? majorationThrs : null,
    });
  }
  console.log(`REI : ${taux.size} communes lues.`);

  const consulteLe = new Date().toISOString().slice(0, 10);
  let total = 0;
  let absentes = 0;
  for (const region of regions) {
    const communes = {};
    for (const c of region.communes) {
      const t = taux.get(c.codeInsee);
      if (!t) {
        absentes += 1;
        continue;
      }
      communes[c.codeInsee] = { nom: c.nom, ...t };
      total += 1;
    }
    await writeFile(
      path.join(region.dossier, "fiscalite.json"),
      JSON.stringify(
        {
          source: {
            nom: `Impôts locaux : fichier de recensement des éléments d'imposition à la fiscalité directe locale (REI), millésime ${ANNEE}`,
            nomCourt: `REI ${ANNEE}`,
            producteur: "DGFiP",
            url: REI.page,
            annee: String(ANNEE),
            licence: "Licence Ouverte / Etalab 2.0",
            consulteLe,
          },
          methodologie:
            `Taux ${ANNEE} de taxe foncière sur les propriétés bâties applicables sur la commune, lus dans le REI : taux communal net (E12, taux moyen appliqué pour une commune nouvelle en intégration fiscale progressive), part des syndicats (E22), taux intercommunal net (E32), taxes spéciales d'équipement (E52, E52A), GEMAPI (E52gGEMAPI) et TASA en Île-de-France (E52TASA). ` +
            "Le taux global est leur somme : c'est le pourcentage de la valeur locative cadastrale qu'un propriétaire paie, hors taxe d'enlèvement des ordures ménagères. La TEOM (F22, zone à taux plein) et la majoration de taxe d'habitation sur les résidences secondaires (TXMAJOTHRS) sont données à part. Aucun taux départemental : la part départementale de TFB a été transférée aux communes en 2021.",
          caveats: [
            "Un taux s'applique à la valeur locative cadastrale, pas au prix du logement : deux communes au même taux peuvent avoir des cotisations très différentes.",
            "La TEOM absente signifie que la commune finance les déchets autrement (redevance, budget général), pas qu'ils sont gratuits.",
            "Les taux votés changent chaque année ; le millésime affiché est celui de l'imposition.",
          ],
          communes,
        },
        null,
        1,
      ),
      "utf8",
    );
  }
  console.log(`${total} communes écrites${absentes ? `, ${absentes} absentes du REI` : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
