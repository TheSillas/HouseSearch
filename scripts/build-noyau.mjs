#!/usr/bin/env node
/**
 * Noyau national — tout ce dont le classement et la carte ont besoin, pour
 * toutes les communes, dans un seul fichier compact en colonnes.
 *
 *   node scripts/build-noyau.mjs
 *
 * Lit chaque `data/dist/<région>.json` (format compact v2 de build-dataset.mjs),
 * ne retient que les mesures qui entrent dans le classement ou qui sont mises
 * en avant (une par critère), et écrit `data/dist/noyau.json`. Les libellés,
 * unités et formulations de chaque mesure sont écrits une seule fois ; chaque
 * commune n'y pèse que ses valeurs. La forme est décrite et dilatée par
 * `src/lib/noyau.ts`.
 *
 * Deux communes de départements différents peuvent porter le même nom : leurs
 * slugs entrent en collision et sont TOUS deux suffixés du département, jamais
 * l'un au détriment de l'autre.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dilater } from "./lib/jeu-compact.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(RACINE, "data", "dist");
const SORTIE = path.join(DIST, "noyau.json");
const ORDRE_CRITERES = ["immobilier", "securite", "ecoles", "transports", "emploi", "sante", "quotidien", "fiscalite", "proximite", "risques", "climat"];

function slugifier(nom) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const fichiers = (await readdir(DIST)).filter((f) => f.endsWith(".json") && f !== "noyau.json").sort();
  const zones = [];
  const communes = [];
  // Dictionnaire des mesures retenues : par critère, dans l'ordre de première
  // rencontre ; leurs métadonnées doivent être identiques d'une région à l'autre.
  const mesures = [];
  const indexMesure = new Map();
  const sourcesVues = new Map();
  // Sources complètes (avec URL) pour la page de méthode : par critère, puis électorales.
  const sourcesDetail = new Map();
  const sourcesElectorales = new Map();

  for (const fichier of fichiers) {
    const jeu = JSON.parse(await readFile(path.join(DIST, fichier), "utf8"));
    const slug = fichier.replace(/\.json$/, "");
    const dilatees = dilater(jeu);
    zones.push({ slug, zone: jeu.zone, departement: jeu.departement, nbCommunes: dilatees.length, genereLe: jeu.genereLe });

    for (const id of ORDRE_CRITERES) {
      const dico = jeu.criteres[id];
      if (!dico) continue;
      for (const meta of dico.mesures) {
        if (!meta.classante && !meta.vedette) continue;
        const { sourceRef, ...reste } = meta;
        void sourceRef;
        const cle = `${id}|${meta.id}`;
        if (!indexMesure.has(cle)) {
          indexMesure.set(cle, mesures.length);
          mesures.push({ critere: id, meta: reste });
        } else {
          // L'unité peut s'accorder au nombre (« 1 établissement », « 4 établissements ») :
          // elle est portée par la commune quand elle s'écarte du dictionnaire (voir plus
          // bas) ; tout le reste doit être identique d'une région à l'autre.
          const { unite: u1, ...a } = mesures[indexMesure.get(cle)].meta;
          const { unite: u2, ...b } = reste;
          void u1;
          void u2;
          if (JSON.stringify(a) !== JSON.stringify(b)) {
            throw new Error(`${slug} / ${meta.id} : métadonnées différentes d'une autre région`);
          }
        }
      }
      // Résumé des sources : la source du critère puis celles propres à des mesures.
      const sources = [dico.source, ...(jeu.sources ?? [])];
      for (const source of sources) {
        const libelle = source.producteur || source.nom;
        sourcesVues.set(`${id}|${libelle}|${source.annee}`, { critere: id, libelle, annee: source.annee });
      }
    }

    for (const c of dilatees) {
      communes.push({ region: slug, commune: c });
      for (const [id, donnees] of Object.entries(c.criteres)) {
        sourcesDetail.set(`${id}|${donnees.source.url}|${donnees.source.annee}`, { critere: id, source: donnees.source });
      }
      for (const scrutin of c.politique?.scrutins ?? []) {
        sourcesElectorales.set(`${scrutin.source.url}|${scrutin.source.annee}`, scrutin.source);
      }
      const maire = c.politique?.maire;
      if (maire?.source) sourcesElectorales.set(`${maire.source.url}|${maire.source.annee}`, maire.source);
    }
  }

  // Slugs : collision nationale → suffixe département pour toutes les homonymes.
  const parSlug = new Map();
  for (const { commune } of communes) {
    const s = slugifier(commune.nom);
    (parSlug.get(s) ?? parSlug.set(s, []).get(s)).push(commune);
  }
  const slugDe = (c) => {
    const base = slugifier(c.nom);
    return parSlug.get(base).length > 1 ? `${base}-${c.departement}` : base;
  };

  const epcis = [];
  const indexEpci = new Map();
  const colonnes = {
    codeInsee: [],
    nom: [],
    slug: [],
    departement: [],
    epci: [],
    population: [],
    anneePopulation: [],
    lat: [],
    lon: [],
    criteresPresents: [],
  };
  const valeurs = mesures.map(() => []);
  const absences = {};
  // indexMesure → indexCommune → unité, quand elle diffère de celle du dictionnaire.
  const unites = {};

  communes.sort((a, b) => a.commune.codeInsee.localeCompare(b.commune.codeInsee));
  communes.forEach(({ commune: c }, i) => {
    colonnes.codeInsee.push(c.codeInsee);
    colonnes.nom.push(c.nom);
    const slug = slugDe(c);
    colonnes.slug.push(slug === slugifier(c.nom) ? 0 : slug);
    colonnes.departement.push(c.departement);
    if (c.epci) {
      if (!indexEpci.has(c.epci)) {
        indexEpci.set(c.epci, epcis.length);
        epcis.push(c.epci);
      }
      colonnes.epci.push(indexEpci.get(c.epci));
    } else {
      colonnes.epci.push(-1);
    }
    colonnes.population.push(c.population);
    colonnes.anneePopulation.push(c.anneePopulation);
    colonnes.lat.push(c.lat ?? null);
    colonnes.lon.push(c.lon ?? null);

    let bits = 0;
    ORDRE_CRITERES.forEach((id, k) => {
      if (c.criteres[id]) bits |= 1 << k;
    });
    colonnes.criteresPresents.push(bits);

    mesures.forEach(({ critere, meta }, j) => {
      const donnees = c.criteres[critere];
      if (!donnees) {
        valeurs[j].push(null);
        return;
      }
      const m = donnees.mesures.find((x) => x.id === meta.id);
      if (!m) {
        // Mesure absente pour cette commune (pas seulement nulle) : notée à part
        // pour que le nombre de mesures attendues du critère reste exact.
        (absences[j] ??= []).push(i);
        valeurs[j].push(null);
        return;
      }
      valeurs[j].push(m.valeur);
      if (m.unite !== meta.unite) (unites[j] ??= {})[i] = m.unite;
    });
  });

  const noyau = {
    version: 1,
    genereLe: new Date().toISOString(),
    criteres: ORDRE_CRITERES,
    zones,
    sources: ORDRE_CRITERES.flatMap((id) => [...sourcesVues.values()].filter((v) => v.critere === id)),
    sourcesDetail: ORDRE_CRITERES.flatMap((id) => [...sourcesDetail.values()].filter((v) => v.critere === id)),
    sourcesElectorales: [...sourcesElectorales.values()],
    mesures,
    epcis,
    communes: colonnes,
    valeurs,
    absences,
    unites,
  };
  // Empreinte du contenu : elle nomme l'URL sous laquelle le navigateur reçoit le
  // noyau (voir src/app/donnees/noyau/[empreinte]/route.ts), mise en cache sans
  // limite — un nouveau jeu de données change d'URL, jamais de contenu sous la même.
  noyau.empreinte = createHash("sha1").update(JSON.stringify(noyau)).digest("hex").slice(0, 12);
  const texte = JSON.stringify(noyau);
  await writeFile(SORTIE, `${texte}\n`, "utf8");
  // Pré-compressé une fois ici plutôt qu'à chaque requête : compresser 5 Mo
  // coûtait plus de deux secondes par visiteur au serveur.
  await writeFile(`${SORTIE}.gz`, gzipSync(texte, { level: 9 }));

  const octets = Buffer.byteLength(texte);
  console.log(
    `${communes.length} communes, ${zones.length} régions, ${mesures.length} mesures retenues, ` +
      `${epcis.length} EPCI → ${path.relative(RACINE, SORTIE)} (${(octets / 1e6).toFixed(1)} Mo)`,
  );
  const homonymes = [...parSlug.values()].filter((l) => l.length > 1).length;
  console.log(`${homonymes} noms de commune partagés, slugs suffixés du département.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
