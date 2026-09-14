#!/usr/bin/env node
/**
 * Loyers d'annonce par commune — « Carte des loyers » (ministère chargé du
 * Logement / ANIL), édition 2025.
 *
 *   node scripts/importer-loyers.mjs
 *
 * Télécharge les deux indicateurs nationaux (appartements, maisons), puis
 * écrit `data/raw/<région>/loyers.json` pour chaque région peuplée, en ne
 * retenant que les communes de son référentiel. Aucune valeur n'est inventée
 * ni héritée sans le dire : quand l'estimation n'est pas communale mais celle
 * d'un groupe de communes voisines (« maille » dans la source), la maille est
 * conservée telle quelle pour être déclarée à l'affichage.
 *
 * Pourquoi cette source : DVF (ventes réelles) ne couvre ni l'Alsace-Moselle
 * ni Mayotte ; cet indicateur, lui, couvre toutes les communes — et le loyer
 * est l'autre moitié du coût du logement.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(RACINE, "data", "raw");

const EDITION = {
  annee: "2025",
  page: "https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025",
  appartement:
    "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145010/pred-app-mef-dhup.csv",
  maison:
    "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145039/pred-mai-mef-dhup.csv",
};

async function telecharger(url) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`${reponse.status} ${url}`);
  // Fichiers encodés en Latin-1 (« La Bâtie » arrive sinon en « La B�tie »).
  return new TextDecoder("latin1").decode(new Uint8Array(await reponse.arrayBuffer()));
}

/** Découpe une ligne CSV « ; » en respectant les guillemets. */
function champs(ligne) {
  const out = [];
  let courant = "";
  let entreGuillemets = false;
  for (const c of ligne) {
    if (c === '"') entreGuillemets = !entreGuillemets;
    else if (c === ";" && !entreGuillemets) {
      out.push(courant);
      courant = "";
    } else courant += c;
  }
  out.push(courant);
  return out;
}

const nombre = (s) => {
  if (s === undefined || s === null || s === "" || s === "NA") return null;
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function parser(csv) {
  const lignes = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const entete = champs(lignes[0]);
  const col = (nom) => {
    const i = entete.indexOf(nom);
    if (i === -1) throw new Error(`Colonne « ${nom} » absente (en-tête : ${entete.join(", ")})`);
    return i;
  };
  const iInsee = col("INSEE_C");
  const iLoy = col("loypredm2");
  const iBas = col("lwr.IPm2");
  const iHaut = col("upr.IPm2");
  const iType = col("TYPPRED");
  const iNbCom = col("nbobs_com");
  const iNbMaille = col("nbobs_mail");

  const parCommune = new Map();
  for (const ligne of lignes.slice(1)) {
    const v = champs(ligne);
    parCommune.set(v[iInsee], {
      loyerM2: nombre(v[iLoy]),
      loyerM2Bas: nombre(v[iBas]),
      loyerM2Haut: nombre(v[iHaut]),
      // « commune » : estimation propre à la commune ; « maille » : estimation
      // d'un groupe de communes voisines, faute d'annonces suffisantes.
      niveau: v[iType] === "commune" ? "commune" : "maille",
      nbAnnoncesCommune: nombre(v[iNbCom]),
      nbAnnoncesMaille: nombre(v[iNbMaille]),
    });
  }
  return parCommune;
}

function arrondir(x, decimales = 2) {
  return x === null ? null : Math.round(x * 10 ** decimales) / 10 ** decimales;
}

async function main() {
  console.log("Téléchargement des indicateurs 2025 (appartements, maisons)…");
  const [app, mai] = await Promise.all([
    telecharger(EDITION.appartement).then(parser),
    telecharger(EDITION.maison).then(parser),
  ]);
  console.log(`  ${app.size} communes (appartements), ${mai.size} communes (maisons)`);

  const consulteLe = new Date().toISOString().slice(0, 10);
  let totalCommunes = 0;
  let niveauCommune = 0;
  let niveauMaille = 0;
  let absentes = 0;

  for (const dossier of (await readdir(RAW, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    const chemin = path.join(RAW, dossier.name);
    let referentiel;
    try {
      referentiel = JSON.parse(await readFile(path.join(chemin, "referentiel.json"), "utf8"));
    } catch {
      continue;
    }
    const communes = {};
    for (const c of referentiel.communes ?? []) {
      const a = app.get(c.codeInsee);
      const m = mai.get(c.codeInsee);
      totalCommunes += 1;
      if (!a && !m) {
        absentes += 1;
        continue;
      }
      const niveau = a?.niveau ?? m?.niveau;
      if (niveau === "commune") niveauCommune += 1;
      else niveauMaille += 1;
      communes[c.codeInsee] = {
        nom: c.nom,
        loyerM2Appartement: arrondir(a?.loyerM2 ?? null),
        loyerM2AppartementBas: arrondir(a?.loyerM2Bas ?? null),
        loyerM2AppartementHaut: arrondir(a?.loyerM2Haut ?? null),
        loyerM2AppartementNiveau: a?.niveau ?? null,
        nbAnnoncesAppartementCommune: a?.nbAnnoncesCommune ?? null,
        nbAnnoncesAppartementMaille: a?.nbAnnoncesMaille ?? null,
        loyerM2Maison: arrondir(m?.loyerM2 ?? null),
        loyerM2MaisonBas: arrondir(m?.loyerM2Bas ?? null),
        loyerM2MaisonHaut: arrondir(m?.loyerM2Haut ?? null),
        loyerM2MaisonNiveau: m?.niveau ?? null,
        nbAnnoncesMaisonCommune: m?.nbAnnoncesCommune ?? null,
        nbAnnoncesMaisonMaille: m?.nbAnnoncesMaille ?? null,
      };
    }

    await writeFile(
      path.join(chemin, "loyers.json"),
      JSON.stringify(
        {
          source: {
            nom: "« Carte des loyers » — indicateurs de loyers d'annonce par commune, édition 2025",
            producteur:
              "Ministère de la Transition écologique (DHUP) et ANIL, à partir d'annonces leboncoin et SeLoger",
            url: EDITION.page,
            urlRessource: [EDITION.appartement, EDITION.maison],
            annee: "annonces 2025 (édition publiée le 11 décembre 2025)",
            licence:
              "non précisée sur la fiche data.gouv.fr de l'édition 2025 (éditions précédentes : Licence Ouverte 2.0)",
            consulteLe,
          },
          methodologie:
            "Loyer mensuel d'annonce au m², charges comprises, estimé par un modèle statistique du ministère (DHUP) et de l'ANIL à partir des annonces leboncoin et SeLoger ; l'indicateur est fourni avec un intervalle de prédiction. Quand la commune compte trop peu d'annonces, l'estimation retenue est celle d'un groupe de communes voisines (« maille ») : elle est alors déclarée comme telle et jamais présentée comme communale.",
          caveats: [
            "Ce sont des loyers d'annonce estimés par un modèle, ni des loyers observés dans les baux signés, ni un relevé exhaustif : l'intervalle de prédiction donne l'ordre de grandeur de l'incertitude.",
            "Le nombre d'annonces observées dans la commune est indiqué ; à zéro, l'estimation est entièrement celle de la maille.",
          ],
          communes,
        },
        null,
        1,
      ),
    );
  }

  console.log(
    `${totalCommunes} communes du référentiel : ${niveauCommune} estimées au niveau communal, ${niveauMaille} au niveau d'une maille, ${absentes} absentes de la source.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
