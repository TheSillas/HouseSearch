/**
 * Vérification de bout en bout dans un vrai navigateur.
 *
 *   node scripts/verifier.mjs [baseUrl]
 *
 * Contrôle ce que le typage et les tests unitaires ne voient pas : le
 * réordonnancement sans rechargement, les cibles tactiles, le débordement
 * horizontal, la validité des listes de définitions, les erreurs d'hydratation,
 * le retour au classement depuis une fiche, la saisie des bornes de filtre,
 * et le poids réellement transféré.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3111";
const SORTIE = "apercus";
const MOBILE = { width: 390, height: 844 };

const echecs = [];
const rapport = [];
const verifier = (ok, libelle, detail = "") => {
  rapport.push(`${ok ? "  OK  " : "  KO  "} ${libelle}${detail ? ` — ${detail}` : ""}`);
  if (!ok) echecs.push(libelle);
};

/** `<dl>` : le contenu doit être (dt|dd)+ ou div+ contenant uniquement des dt/dd. */
function auditDl() {
  const fautes = [];
  for (const dl of document.querySelectorAll("dl")) {
    for (const enfant of dl.children) {
      const t = enfant.tagName;
      if (t === "DT" || t === "DD") continue;
      if (t !== "DIV") {
        fautes.push("<" + t + "> directement dans <dl>");
        continue;
      }
      for (const petit of enfant.children) {
        if (petit.tagName !== "DT" && petit.tagName !== "DD") {
          fautes.push("<" + petit.tagName + "> dans le groupe <div> d'un <dl>");
        }
      }
    }
  }
  return [...new Set(fautes)];
}

function ciblesTactiles() {
  return [...document.querySelectorAll("a, button, input[type=range], summary")]
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        texte: (el.textContent || el.id || "").trim().slice(0, 40),
        h: Math.round(r.height),
      };
    })
    .filter((c) => c.h > 4 && c.h < 32);
}

async function main() {
  await mkdir(SORTIE, { recursive: true });
  const navigateur = await chromium.launch();
  const ctx = await navigateur.newContext({
    viewport: MOBILE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "fr-FR",
  });
  const page = await ctx.newPage();

  const problemes = [];
  // L'URL courante est notée avec chaque problème : elle dit quelle page du
  // parcours a émis l'erreur, ce que le texte seul ne permet pas de retrouver.
  page.on("pageerror", (e) => problemes.push(`erreur JS sur ${page.url()} : ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat|did not match/i.test(m.text())) {
      problemes.push(`sur ${page.url()} : ${m.text()}`);
    }
  });

  // ------------------------------------------------------- page d'accueil
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("ul li h3");
  // La carte n'existe qu'après le montage côté client : l'attendre garantit que
  // l'application est hydratée avant qu'on touche aux curseurs. Sinon, en dev,
  // les valeurs injectées avant l'hydratation sont signalées comme des écarts.
  await page.waitForSelector(".maplibregl-canvas", { timeout: 120_000 });

  const ordre = () => page.$$eval("ul li h3", (t) => t.map((x) => x.textContent.trim()));
  const avant = await ordre();

  const hautPremiereCarte = await page.evaluate(() =>
    Math.round(document.querySelector("ul li").getBoundingClientRect().top),
  );
  verifier(
    hautPremiereCarte < 844,
    "la première commune est visible sans défiler",
    `${hautPremiereCarte} px sur 844`,
  );

  await page.screenshot({ path: `${SORTIE}/mobile-accueil.png` });

  // Réordonnancement sans rechargement. Le classement n'est recalculé qu'au
  // relâchement du curseur (voir Curseurs.tsx) : `input` seul ne suffit plus,
  // il faut aussi le geste de commit (`pointerup`) que l'utilisateur produit
  // naturellement en lâchant la souris ou le doigt.
  const urlAvant = page.url();
  await page.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    for (const [id, v] of [["immobilier", 100], ["securite", 0], ["ecoles", 0], ["transports", 0], ["emploi", 0], ["sante", 0], ["quotidien", 0], ["fiscalite", 0], ["proximite", 0], ["risques", 0], ["climat", 0]]) {
      const el = document.getElementById(`curseur-${id}`);
      if (!el) continue; // critère informatif : pas de curseur
      set.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("pointerup", { bubbles: true }));
    }
  });
  await page.waitForTimeout(900);
  const apres = await ordre();
  verifier(
    JSON.stringify(avant) !== JSON.stringify(apres) &&
      page.url().split("?")[0] === urlAvant.split("?")[0],
    "le classement se réordonne sans rechargement",
    `${avant[0]?.slice(0, 28)} → ${apres[0]?.slice(0, 28)}`,
  );
  // Les quatre premiers curseurs sont réglés ; les suivants gardent leur
  // valeur par défaut et s'écrivent à leur suite.
  verifier(
    /[?&]p=100-0-0-0-0-0-0-0-0-0-0($|&)/.test(page.url()),
    "les priorités sont écrites dans l'URL",
    new URL(page.url()).search || "(vide)",
  );
  await page.screenshot({ path: `${SORTIE}/mobile-prix-max.png` });

  // Cibles tactiles et débordement.
  const petites = await page.evaluate(ciblesTactiles);
  verifier(
    petites.filter((c) => c.tag === "INPUT" || c.tag === "BUTTON").length === 0,
    "curseurs et boutons offrent une cible tactile suffisante",
    petites.map((c) => `${c.tag} ${c.h}px`).join(", ") || "aucun",
  );

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  verifier(!deborde, "aucun débordement horizontal sur mobile");

  const dlAccueil = await page.evaluate(auditDl);
  verifier(dlAccueil.length === 0, "listes de définitions valides sur l'accueil", dlAccueil.join(", "));

  // Le défilement vertical doit rester possible depuis un curseur.
  const touchAction = await page.evaluate(
    () => getComputedStyle(document.getElementById("curseur-immobilier")).touchAction,
  );
  verifier(
    touchAction.includes("pan-y"),
    "le défilement vertical reste possible depuis un curseur",
    touchAction,
  );

  // Nom accessible du lien de carte.
  const nomLien = await page.$eval("ul li a", (a) => a.textContent.trim().length);
  verifier(nomLien < 60, "le lien d'une carte a un nom accessible court", `${nomLien} caractères`);

  // --------------------------------------------------------- fiche ville
  const href = await page.getAttribute("ul li a", "href");
  await page.goto(base + href, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SORTIE}/mobile-fiche.png`, fullPage: true });

  const dlFiche = await page.evaluate(auditDl);
  verifier(dlFiche.length === 0, "listes de définitions valides sur la fiche", dlFiche.join(", "));

  const debordeFiche = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  verifier(!debordeFiche, "aucun débordement horizontal sur la fiche");

  // Aucune phrase comparative ne doit être annoncée deux fois.
  const doublons = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"));
    const textes = document.body.innerText;
    return labels.filter((l) => l && textes.includes(l));
  });
  verifier(doublons.length === 0, "aucune phrase annoncée en double", doublons.slice(0, 2).join(" / "));

  // ------------------------------------------------------- lien partagé
  await page.goto(`${base}/?p=0-0-0-100`, { waitUntil: "domcontentloaded" });
  const premierPeint = (await ordre())[0];
  await page.waitForTimeout(1200);
  const apresHydratation = (await ordre())[0];
  verifier(
    premierPeint === apresHydratation,
    "un lien partagé affiche le bon classement dès le premier rendu",
    `${premierPeint?.slice(0, 30)} → ${apresHydratation?.slice(0, 30)}`,
  );

  // --------------------------------------------------------- comparaison
  await page.goto(`${base}/comparer?communes=biarritz,anglet`, { waitUntil: "networkidle" });
  const entetes = await page.$$eval("table thead th", (l) => l.map((t) => t.textContent.trim().split(/\r?\n/)[0]));
  verifier(entetes.length === 3, "la comparaison met deux communes côte à côte", entetes.join(" | "));
  const lignesRepliees = await page.$$eval("table tbody tr", (l) => l.length);
  await page.click("table tbody th button[aria-expanded='false']");
  await page.waitForTimeout(200);
  const lignesDepliees = await page.$$eval("table tbody tr", (l) => l.length);
  verifier(lignesDepliees > lignesRepliees, "une ligne synthétique de la comparaison se déplie sur ses mesures", `${lignesRepliees} → ${lignesDepliees} lignes`);
  verifier(Boolean(await page.$("table tbody th button[aria-controls='detail-politique']")), "la comparaison a une section Vie politique");
  verifier(
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)),
    "aucun débordement horizontal sur la comparaison (mobile)",
  );
  await page.screenshot({ path: `${SORTIE}/mobile-comparaison.png` });

  // --------------------------------------------------------- méthodologie
  await page.goto(`${base}/methodologie`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SORTIE}/mobile-methodologie.png`, fullPage: true });

  verifier(problemes.length === 0, "aucune erreur console ni écart d'hydratation", problemes.slice(0, 2).join(" | "));

  // ------------------------------------------------------------- sombre
  const sombre = await navigateur.newContext({
    viewport: MOBILE,
    deviceScaleFactor: 2,
    colorScheme: "dark",
    locale: "fr-FR",
  });
  const pageSombre = await sombre.newPage();
  await pageSombre.goto(base, { waitUntil: "networkidle" });
  await pageSombre.screenshot({ path: `${SORTIE}/mobile-sombre.png` });
  await sombre.close();

  // ------------------------------------------------------------ bureau
  const bureau = await navigateur.newContext({ viewport: { width: 1280, height: 950 }, locale: "fr-FR" });
  const pageBureau = await bureau.newPage();
  await pageBureau.goto(base, { waitUntil: "networkidle" });
  await pageBureau.screenshot({ path: `${SORTIE}/bureau-accueil.png` });
  verifier(
    await pageBureau.$eval("#curseur-proximite", (i) => i.disabled),
    "sans repère, le curseur Proximité est désactivé",
  );

  // Un lien partagé avec un repère (Biarritz) et la seule Proximité active :
  // la commune repère est en tête dès le rendu serveur, le marqueur est posé,
  // et le curseur est actif.
  // Une page neuve pour ce lien : un second MapLibre dans la même page
  // headless n'obtient pas toujours son contexte WebGL, et le marqueur ne
  // serait alors jamais posé — un aléa du navigateur de test, pas de l'application.
  await pageBureau.close();
  const pageRepere = await bureau.newPage();
  await pageRepere.goto(`${base}/?r=64122&p=0-0-0-0-0-0-0-0-100-0-0`, { waitUntil: "networkidle" });
  await pageRepere.waitForSelector(".maplibregl-canvas", { timeout: 120_000 });
  const premiereAvecRepere = await pageRepere.$eval("ul li h3", (h) => h.textContent.trim());
  verifier(/Biarritz$/.test(premiereAvecRepere), "lien partagé avec repère : la commune repère est en tête", premiereAvecRepere);
  // Le marqueur est posé une fois la carte prête, après le premier rendu : on lui laisse le temps d'arriver.
  const marqueur = await pageRepere.waitForSelector(".repere-carte", { timeout: 30_000 }).catch(() => null);
  verifier(Boolean(marqueur), "lien partagé avec repère : le marqueur est posé sur la carte");
  verifier(
    await pageRepere.$eval("#curseur-proximite", (i) => !i.disabled),
    "avec repère, le curseur Proximité est actif",
  );
  await pageRepere.screenshot({ path: `${SORTIE}/bureau-repere.png` });
  await pageRepere.close();
  const pageSelection = await bureau.newPage();

  // Ma sélection : deux étoiles depuis le classement, un bandeau qui compte,
  // un lien de comparaison qui porte les deux communes, et une sélection qui
  // survit au rechargement (stockage du navigateur).
  await pageSelection.goto(base, { waitUntil: "networkidle" });
  await pageSelection.waitForSelector(".maplibregl-canvas", { timeout: 120_000 });
  const etoiles = await pageSelection.$$("ul li button[aria-label^='Ajouter']");
  verifier(etoiles.length >= 2, "chaque ligne du classement porte une étoile", `${etoiles.length} étoiles`);
  await etoiles[0].click();
  await etoiles[1].click();
  await pageSelection.waitForSelector("a:has-text('Comparer ces 2 communes')", { timeout: 10_000 });
  const lienComparer = await pageSelection.$eval("a:has-text('Comparer ces 2 communes')", (a) => a.getAttribute("href"));
  verifier(/^\/comparer\?communes=[a-z0-9-]+,[a-z0-9-]+$/.test(lienComparer ?? ""), "le bandeau propose de comparer les deux communes étoilées", lienComparer);
  await pageSelection.reload({ waitUntil: "networkidle" });
  await pageSelection.waitForSelector(".maplibregl-canvas", { timeout: 120_000 });
  verifier(
    Boolean(await pageSelection.$("a:has-text('Comparer ces 2 communes')")),
    "la sélection survit au rechargement",
  );
  await pageSelection.evaluate(() => localStorage.clear());
  await pageSelection.close();

  // Revenir au classement : on enchaîne deux fiches depuis la carte, puis la
  // flèche du volet doit rendre la main à la liste — pas à la fiche
  // précédente — en gardant les priorités réglées. Ces deux points ne se
  // voient qu'ici : le typage ne dit rien d'un historique de navigation, et
  // une navigation douce laisse la sous-page active d'un emplacement
  // parallèle en place tant qu'on ne la retire pas soi-même.
  const pageRetour = await bureau.newPage();
  const REGLAGE = "?p=100-0-0-0-0-0-0-0-0-0-0";
  await pageRetour.goto(`${base}/${REGLAGE}`, { waitUntil: "networkidle" });
  await pageRetour.waitForSelector(".maplibregl-canvas", { timeout: 120_000 });

  const liens = await pageRetour.$$eval("ul li a[href^='/ville/']", (as) =>
    as.slice(0, 2).map((a) => a.getAttribute("href")),
  );
  verifier(
    liens.every((h) => (h ?? "").includes("p=100-")),
    "les liens du classement emportent les priorités réglées",
    liens[0],
  );

  // La première fiche s'ouvre depuis la liste ; la seconde par la recherche,
  // seul chemin réel une fois le volet ouvert — sur ordinateur il couvre le
  // classement. C'est exactement l'enchaînement qui piégeait `router.back()`.
  await pageRetour.click(`ul li a[href='${liens[0]}']`);
  await pageRetour.waitForSelector("[aria-label^='Fiche de']", { timeout: 20_000 });
  await pageRetour.fill("input[role='combobox']", "Annecy");
  await pageRetour.click("li[role='option'] button");
  await pageRetour.waitForFunction(
    () => location.pathname === "/ville/annecy",
    undefined,
    { timeout: 20_000 },
  );
  const avantRetour = new URL(pageRetour.url()).pathname;
  await pageRetour.click("button[aria-label='Fermer la fiche et revenir au classement']");
  await pageRetour.waitForTimeout(800);
  const apresRetour = new URL(pageRetour.url());
  verifier(
    apresRetour.pathname === "/" && apresRetour.search.includes("p=100-"),
    "la flèche du volet revient au classement réglé, pas à la fiche précédente",
    `${avantRetour} → ${apresRetour.pathname}${apresRetour.search}`,
  );
  verifier(
    (await pageRetour.$$("[aria-label^='Fiche de']")).length === 0,
    "le volet disparaît vraiment quand on revient au classement",
  );

  // Les bornes des filtres se saisissent au clavier : sur un prix au m² qui
  // court jusqu'à plusieurs dizaines de milliers d'euros, le rail ne permet
  // pas de viser une valeur précise.
  await pageRetour.click("summary:has-text('Filtres avancés')");
  const champMax = pageRetour.locator("input[aria-label*='maximum (valeur à saisir)']").first();
  await champMax.waitFor({ timeout: 10_000 });
  await champMax.fill("2500");
  await champMax.press("Enter");
  await pageRetour.waitForTimeout(900);
  verifier(
    new URL(pageRetour.url()).searchParams.get("f")?.includes("_2500") ?? false,
    "une borne de filtre se saisit au clavier et s'applique",
    await champMax.inputValue(),
  );
  await pageRetour.close();

  await bureau.close();

  await navigateur.close();

  console.log(rapport.join("\n"));
  console.log(
    echecs.length === 0
      ? `\n${rapport.length} contrôles, tous passés.`
      : `\n${echecs.length} échec(s) sur ${rapport.length} contrôles.`,
  );
  process.exit(echecs.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
