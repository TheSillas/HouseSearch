import { chromium } from "playwright";

/**
 * Capture de contrôle de la version publiée (`scripts/build-artefact.mjs`).
 *
 * L'enveloppe de publication ajoute la balise viewport ; en local le fichier
 * n'en a pas, d'où `isMobile: false`, qui fait coïncider largeur de fenêtre et
 * largeur de mise en page comme sur un vrai téléphone.
 */
const f = process.argv[2] ?? "file:///C:/Users/alexa/AppData/Local/Temp/claude/C--Users-alexa-Desktop-Git-OuVivre/3dee9704-2310-4ac2-b097-1498b2366d88/scratchpad/ou-vivre.html";
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: "fr-FR" });
const p = await ctx.newPage();
const erreurs = [];
p.on("pageerror", (e) => erreurs.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });

await p.goto(f, { waitUntil: "networkidle" });
await p.waitForSelector("#classement li");
const avant = await p.$$eval("#classement h3", (n) => n.map((x) => x.textContent.trim()).slice(0, 3));
const haut = await p.evaluate(() => Math.round(document.querySelector("#classement li").getBoundingClientRect().top));
await p.screenshot({ path: "apercus/art-accueil.png" });

await p.evaluate(() => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  for (const [id, v] of [["c-immobilier", 100], ["c-securite", 0], ["c-ecoles", 0], ["c-transports", 0]]) {
    const el = document.getElementById(id);
    set.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await p.waitForTimeout(700);
const apres = await p.$$eval("#classement h3", (n) => n.map((x) => x.textContent.trim()).slice(0, 3));
await p.screenshot({ path: "apercus/art-prix.png" });

const slug = await p.$eval("#classement li a", (a) => a.getAttribute("href"));
await p.goto(f + slug, { waitUntil: "networkidle" });
await p.screenshot({ path: "apercus/art-fiche.png" });
const deborde = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

await p.goto(f + "#/methode", { waitUntil: "networkidle" });
await p.screenshot({ path: "apercus/art-methode.png" });

const sombre = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", locale: "fr-FR" });
const ps = await sombre.newPage();
await ps.goto(f, { waitUntil: "networkidle" });
await ps.waitForSelector("#classement li");
await ps.screenshot({ path: "apercus/art-sombre.png" });

const bureau = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
const pb = await bureau.newPage();
await pb.goto(f, { waitUntil: "networkidle" });
await pb.waitForSelector("#classement li");
await pb.screenshot({ path: "apercus/art-bureau.png" });

await nav.close();
console.log(JSON.stringify({ avant, apres, reordonne: JSON.stringify(avant) !== JSON.stringify(apres), hautPremiereCarte: haut, deborde, erreurs }, null, 1));
