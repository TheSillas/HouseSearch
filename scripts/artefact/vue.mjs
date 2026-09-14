/*
 * Couche de rendu de la version publiée.
 *
 * Ce fichier est concaténé après `moteur.mjs` et le jeu de données dans un seul
 * script classique : il s'appuie donc sur les fonctions et sur `JEU` comme sur
 * des variables globales, sans import.
 *
 * eslint-env browser
 * global JEU, CRITERES, POIDS_MIN, POIDS_MAX, POIDS_PAR_DEFAUT, libellePoids,
 * global construireReferentiel, classer, aucunePriorite, nombre, valeurMesure,
 * global phraseComparative, dateCourte, mesureVedette
 */

(function () {
  "use strict";

  const COMMUNES = JEU.communes;
  const REFERENTIEL = construireReferentiel(COMMUNES);
  const PAR_SLUG = new Map(COMMUNES.map((c) => [c.slug, c]));
  const CRITERE_PAR_ID = new Map(CRITERES.map((c) => [c.id, c]));

  const vue = document.getElementById("vue");
  const etat = { poids: Object.assign({}, POIDS_PAR_DEFAUT) };

  const douceur = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(valeur) {
    return String(valeur == null ? "" : valeur).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }

  const CHEVRON =
    '<svg class="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function jauge(position, epaisse) {
    if (!position) return '<span class="jauge' + (epaisse ? " epaisse" : "") + '"></span>';
    const pct = Math.max(Math.round(position.fraction * 100), 2);
    return (
      '<span class="jauge' + (epaisse ? " epaisse" : "") + '">' +
      '<i style="width:' + pct + '%"></i><u></u></span>'
    );
  }

  function positionDe(commune, mesure) {
    if (!mesure || mesure.comparable === false) return null;
    const p = REFERENTIEL.positions[commune.codeInsee];
    return (p && p[mesure.id]) || null;
  }

  // ------------------------------------------------------------- classement

  const cartes = new Map();

  function construireCarte(commune) {
    const li = document.createElement("li");
    const stats = CRITERES.map((critere) => {
      const donnees = commune.criteres[critere.id];
      const mesure = donnees ? mesureVedette(donnees.mesures) : null;
      const position = positionDe(commune, mesure);
      const phrase = mesure ? phraseComparative(mesure, position) : null;
      const etiquette = mesure
        ? esc((mesure.libelleCourt || mesure.libelle) + " : " + (phrase || "position non comparable"))
        : "";
      return (
        '<div data-critere="' + critere.id + '">' +
        "<dt>" + esc(mesure ? mesure.libelleCourt || critere.libelle : critere.libelle) + "</dt>" +
        '<dd><span class="valeur chiffres">' + esc(mesure ? valeurMesure(mesure) : "—") + "</span>" +
        (phrase
          ? '<span role="img" aria-label="' + etiquette + '">' + jauge(position) + "</span>"
          : jauge(position)) +
        "</dd></div>"
      );
    }).join("");

    li.innerHTML =
      '<div class="carte-ville">' +
      '<div class="ligne-tete">' +
      '<span class="rang" aria-hidden="true"></span>' +
      '<div class="identite">' +
      "<h3><span class=\"sr\"></span>" +
      '<a href="#/ville/' + esc(commune.slug) + '">' + esc(commune.nom) + "</a></h3>" +
      "<p><span class=\"chiffres\">" + nombre(commune.population) + "</span> habitants" +
      (commune.epci ? " · " + esc(commune.epci) : "") + "</p>" +
      "</div>" + CHEVRON +
      "</div>" +
      '<dl class="stats">' + stats + "</dl>" +
      '<p class="note-tete" hidden></p>' +
      '<p class="note-manque" hidden></p>' +
      "</div>";

    return {
      li,
      carte: li.querySelector(".carte-ville"),
      rang: li.querySelector(".rang"),
      srRang: li.querySelector(".identite h3 .sr"),
      colonnes: new Map(
        CRITERES.map((c) => [c.id, li.querySelector('[data-critere="' + c.id + '"]')]),
      ),
      noteTete: li.querySelector(".note-tete"),
      noteManque: li.querySelector(".note-manque"),
    };
  }

  function libelles(ids) {
    return ids
      .map((id) => (CRITERE_PAR_ID.get(id) || {}).libelle)
      .filter(Boolean)
      .map((l) => l.toLowerCase())
      .join(", ");
  }

  function raisonsDuRang(ligne) {
    return ligne.contributions
      .filter((c) => c.fraction >= 0.6)
      .sort((a, b) => b.part - a.part)
      .slice(0, 2)
      .map((c) => (CRITERE_PAR_ID.get(c.critere) || {}).libelle)
      .filter(Boolean)
      .map((l) => l.toLowerCase());
  }

  function majCarte(ligne, classe) {
    const ref = cartes.get(ligne.commune.codeInsee);
    const premier = classe && ligne.rang === 1;

    ref.carte.dataset.premier = premier ? "true" : "false";
    ref.rang.textContent = classe ? String(ligne.rang) : "";
    ref.rang.hidden = !classe;
    ref.srRang.textContent = classe ? (ligne.rang === 1 ? "1re — " : ligne.rang + "e — ") : "";

    for (const critere of CRITERES) {
      ref.colonnes.get(critere.id).dataset.compte = (etat.poids[critere.id] || 0) > 0 ? "true" : "false";
    }

    const raisons = premier ? raisonsDuRang(ligne) : [];
    ref.noteTete.hidden = raisons.length === 0;
    if (raisons.length) {
      ref.noteTete.innerHTML =
        "En tête de <b>vos</b> priorités, surtout sur " + esc(raisons.join(" et ")) + ".";
    }

    const manques = [];
    if (ligne.criteresIgnores.length) {
      manques.push(
        "Donnée manquante : " + libelles(ligne.criteresIgnores) +
        " — critère écarté du calcul pour cette commune.",
      );
    }
    if (ligne.criteresPartiels.length) {
      manques.push(
        libelles(ligne.criteresPartiels) +
        " : critère classé sur une partie seulement de ses mesures, faute de donnée.",
      );
    }
    ref.noteManque.hidden = manques.length === 0;
    ref.noteManque.textContent = manques.join(" ");
  }

  function reordonner(liste, lignes, anime) {
    const avant = anime ? new Map() : null;
    if (avant) {
      for (const [code, ref] of cartes) avant.set(code, ref.li.getBoundingClientRect().top);
    }

    for (const ligne of lignes) liste.appendChild(cartes.get(ligne.commune.codeInsee).li);

    if (!avant) return;
    for (const [code, ref] of cartes) {
      const ecart = avant.get(code) - ref.li.getBoundingClientRect().top;
      if (!ecart) continue;
      ref.li.animate(
        [{ transform: "translateY(" + ecart + "px)" }, { transform: "none" }],
        { duration: 420, easing: "cubic-bezier(0.22, 0.68, 0, 1)" },
      );
    }
  }

  // ------------------------------------------------------------------ vues

  function sourcesResumees() {
    const premiere = COMMUNES[0];
    return CRITERES.map((critere) => {
      const source = premiere.criteres[critere.id] && premiere.criteres[critere.id].source;
      return source ? { critere, source } : null;
    }).filter(Boolean);
  }

  function rendreAccueil() {
    const curseurs = CRITERES.filter((c) => c.curseur !== false).map((critere) => {
      const valeur = etat.poids[critere.id] || 0;
      const inactif = valeur <= 0;
      return (
        '<div class="curseur-bloc" data-inactif="' + inactif + '">' +
        '<label for="c-' + critere.id + '">' +
        '<span class="nom">' + esc(critere.libelle) + "</span>" +
        '<span class="niveau">' + esc(libellePoids(valeur)) + "</span></label>" +
        '<span class="sr" id="aide-' + critere.id + '">' + esc(critere.description) + "</span>" +
        '<input class="curseur" id="c-' + critere.id + '" type="range" min="' + POIDS_MIN +
        '" max="' + POIDS_MAX + '" step="1" value="' + valeur + '" data-critere="' + critere.id +
        '" data-inactif="' + inactif + '" aria-describedby="aide-' + critere.id +
        '" aria-valuetext="' + esc(libellePoids(valeur) + ", " + valeur + " sur 100") +
        '" style="--remplissage:' + valeur + '%">' +
        "</div>"
      );
    }).join("");

    const detailCurseurs = CRITERES.filter((c) => c.curseur !== false).map(
      (c) =>
        "<div><dt>" + esc(c.libelle) + " — </dt><dd>" + esc(c.description) + "</dd></div>",
    ).join("");

    const sources = sourcesResumees()
      .map(
        (s) =>
          "<li><b>" + esc(s.critere.libelle) + "</b> — " +
          esc(s.source.producteur || s.source.nom) + ", " + esc(s.source.annee) + "</li>",
      )
      .join("");

    vue.innerHTML =
      '<section class="hero">' +
      "<h1>Quelle ville vous correspond&nbsp;?</h1>" +
      '<p class="accroche">Réglez vos priorités : le classement se recalcule aussitôt, sur des ' +
      "données publiques brutes — jamais sur une note décidée à votre place.</p>" +
      '<p class="zone">' + COMMUNES.length + " communes · " + esc(JEU.zone) + "</p>" +
      "</section>" +

      '<section aria-labelledby="t-priorites">' +
      '<div class="barre-titre">' +
      '<h2 class="titre-section" id="t-priorites">Vos priorités</h2>' +
      '<button class="reinit" type="button" id="reinit">Réinitialiser</button>' +
      "</div>" +
      '<div class="grille-curseurs">' + curseurs + "</div>" +
      '<details class="repli"><summary>' +
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
      '<path d="m4.5 2.5 3 3.5-3 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
      "Ce que mesure chaque curseur</summary><dl>" + detailCurseurs + "</dl></details>" +
      "</section>" +

      '<div class="barre-classement">' +
      '<h2 class="titre-section" id="t-classement">Classement</h2>' +
      '<a href="#sources">sources et millésimes</a>' +
      "</div>" +
      '<p class="sr" aria-live="polite" id="annonce"></p>' +
      '<p class="avis-neutre" id="avis-neutre" hidden>Tous les curseurs sont à zéro : aucun ' +
      "classement n&#39;a de sens. Les communes sont listées par ordre alphabétique. Remontez un " +
      "curseur pour trier.</p>" +
      '<ul class="classement" id="classement"></ul>' +

      '<section class="sources" id="sources">' +
      '<h2 class="titre-section">D&#39;où viennent ces chiffres</h2>' +
      "<ul>" + sources + "</ul>" +
      '<p style="margin:0.5rem 0 0;font-size:12.5px">' +
      '<a class="lien" href="#/methode">Sources détaillées, méthode de calcul et limites</a></p>' +
      "</section>";

    cartes.clear();
    const liste = document.getElementById("classement");
    for (const commune of COMMUNES) cartes.set(commune.codeInsee, construireCarte(commune));

    document.getElementById("reinit").addEventListener("click", () => {
      etat.poids = Object.assign({}, POIDS_PAR_DEFAUT);
      for (const input of vue.querySelectorAll(".curseur")) {
        input.value = String(etat.poids[input.dataset.critere]);
        majCurseur(input);
      }
      majClassement(liste, true);
    });

    majClassement(liste, false);
  }

  function majCurseur(input) {
    const valeur = Number(input.value);
    const inactif = valeur <= 0;
    const bloc = input.closest(".curseur-bloc");
    bloc.dataset.inactif = String(inactif);
    input.dataset.inactif = String(inactif);
    input.style.setProperty("--remplissage", valeur + "%");
    input.setAttribute("aria-valuetext", libellePoids(valeur) + ", " + valeur + " sur 100");
    bloc.querySelector(".niveau").textContent = libellePoids(valeur);
    document.getElementById("reinit").disabled = CRITERES.every(
      (c) => (etat.poids[c.id] || 0) === POIDS_PAR_DEFAUT[c.id],
    );
  }

  function majClassement(liste, anime) {
    const neutre = aucunePriorite(etat.poids);
    const lignes = classer(COMMUNES, REFERENTIEL, etat.poids);

    document.getElementById("t-classement").textContent = neutre ? "Communes comparées" : "Classement";
    document.getElementById("avis-neutre").hidden = !neutre;
    document.getElementById("reinit").disabled = CRITERES.every(
      (c) => (etat.poids[c.id] || 0) === POIDS_PAR_DEFAUT[c.id],
    );

    for (const ligne of lignes) majCarte(ligne, !neutre);
    reordonner(liste, lignes, anime && douceur());

    document.getElementById("annonce").textContent = neutre
      ? "Aucune priorité réglée : les communes sont listées par ordre alphabétique, sans rang."
      : "Classement mis à jour. En tête : " + lignes[0].commune.nom + ", devant " +
        lignes.slice(1, 3).map((l) => l.commune.nom).join(" et ") + ".";
  }

  // ------------------------------------------------------------------ fiche

  function rendreMesure(commune, mesure) {
    const comparable = mesure.comparable !== false;
    const position = comparable ? positionDe(commune, mesure) : null;
    const phrase = phraseComparative(mesure, position);
    const absente = mesure.valeur === null;

    let detail = "";
    if (mesure.precision && !absente) {
      detail += '<p class="precision chiffres">' + esc(mesure.precision) + "</p>";
    }
    if (mesure.repartition && mesure.repartition.length && !absente) {
      detail +=
        '<ul class="repartition">' +
        mesure.repartition
          .map((p) => "<li><span>" + esc(p.libelle) + "</span><span class=\"chiffres\">" + esc(String(p.effectif)) + "</span></li>")
          .join("") +
        "</ul>";
    }
    if (mesure.maille) {
      detail +=
        '<p class="precision" style="color:var(--signal)">Donnée de maille ' +
        esc(mesure.maille) + ", et non communale.</p>";
    }
    if (!absente && comparable && phrase) {
      detail +=
        '<div class="position">' + jauge(position, true) +
        '<p class="phrase">' + esc(phrase) +
        (position
          ? ' <span>· <span class="chiffres">' + position.effectif.toLocaleString("fr-FR") + "</span> communes renseignées</span>"
          : "") +
        "</p></div>";
    }
    if (absente) {
      detail +=
        '<p class="absente">' +
        (mesure.statut === "secret_statistique"
          ? "Valeur couverte par le secret statistique : le producteur ne la publie pas pour cette commune."
          : mesure.statut === "seuil_diffusion"
            ? "Valeur non diffusée par le producteur pour cette commune (seuils de diffusion ou de qualité)."
            : mesure.statut === "sans_objet"
              ? "Sans objet pour cette commune : ce prélèvement n'y est pas appliqué."
              : "Aucune valeur publiée pour cette commune.") +
        " Elle n&#39;est remplacée ni par une estimation, ni par une moyenne.</p>";
    }

    return (
      '<div class="mesure">' +
      "<dt>" + esc(mesure.libelle) + "</dt>" +
      '<dd class="val chiffres" data-absente="' + absente + '">' + esc(valeurMesure(mesure)) + "</dd>" +
      '<dd class="detail">' + detail + "</dd>" +
      "</div>"
    );
  }

  function rendreBloc(commune, critere) {
    const donnees = commune.criteres[critere.id];
    if (!donnees) {
      return (
        '<section class="bloc"><h2>' + esc(critere.libelle) + "</h2>" +
        '<p class="partiel" style="color:var(--texte-faible)">Aucune donnée disponible pour cette commune.</p></section>'
      );
    }

    const pc = REFERENTIEL.positionsCriteres[commune.codeInsee][critere.id];
    const partiel = pc && pc.mesuresRetenues < pc.mesuresAttendues;

    const limites = donnees.caveats.length
      ? '<div class="limites">' + donnees.caveats.map((c) => "<p><span>" + esc(c) + "</span></p>").join("") + "</div>"
      : "";

    return (
      '<section class="bloc">' +
      "<h2>" + esc(critere.libelle) + "</h2>" +
      (partiel
        ? '<p class="partiel">Critère classé sur ' + pc.mesuresRetenues + " de ses " +
          pc.mesuresAttendues + " mesures pour cette commune : la donnée manquante est écartée du " +
          "calcul plutôt que remplacée.</p>"
        : "") +
      '<dl class="mesures">' + donnees.mesures.map((m) => rendreMesure(commune, m)).join("") + "</dl>" +
      '<div class="source-bloc">' +
      '<p><span class="etiquette">Source :</span> ' + esc(donnees.source.nom) + " — " +
      esc(donnees.source.producteur) + ", données " + esc(donnees.source.annee) + ". " +
      '<a class="lien" href="' + esc(donnees.source.url) + '" target="_blank" rel="noreferrer noopener">Jeu de données</a></p>' +
      (donnees.methodologie || limites
        ? "<details><summary>Méthode et limites</summary>" +
          (donnees.methodologie ? '<p style="margin-top:0.5rem">' + esc(donnees.methodologie) + "</p>" : "") +
          limites + "</details>"
        : "") +
      "</div></section>"
    );
  }

  function rendrePolitique(commune) {
    const pol = commune.politique;
    if (!pol.maire && !pol.scrutins.length) return "";

    const maire = pol.maire
      ? '<div class="maire"><p><span style="color:var(--texte-doux)">Maire en exercice :</span> ' +
        "<b>" + esc(pol.maire.nom) + "</b>" +
        (pol.maire.nuance ? '<span class="nuance">' + esc(pol.maire.nuance) + "</span>" : "") +
        (pol.maire.depuis ? " · depuis le " + esc(dateCourte(pol.maire.depuis)) : "") +
        '</p><p class="src">Source : ' + esc(pol.maire.source.nom) + " — " +
        esc(pol.maire.source.producteur) + ", " + esc(pol.maire.source.annee) + ".</p></div>"
      : "";

    const scrutins = pol.scrutins
      .map((s) => {
        const resultats = s.resultats
          .slice()
          .sort((a, b) => b.pourcentage - a.pourcentage)
          .map(
            (r) =>
              "<li>" +
              '<div class="rang-liste"><p class="libelle">' + esc(r.libelle) +
              (r.nuance ? '<span class="nuance">' + esc(r.nuance) + "</span>" : "") + "</p>" +
              '<p class="pct chiffres">' + nombre(r.pourcentage, 1) + "&nbsp;%</p></div>" +
              (r.nuanceLibelle || r.precision
                ? '<p class="sous">' + esc([r.nuanceLibelle, r.precision].filter(Boolean).join(" · ")) + "</p>"
                : "") +
              '<div class="barre"><i style="width:' +
              Math.min(Math.max(r.pourcentage, 0), 100) + '%"></i></div>' +
              (r.voix !== undefined ? '<p class="voix chiffres">' + nombre(r.voix) + " voix</p>" : "") +
              "</li>",
          )
          .join("");

        return (
          '<article class="scrutin">' +
          '<span class="date chiffres">' + esc(dateCourte(s.date)) + "</span>" +
          "<h3>" + esc(s.nom) + (s.tour ? " <em>— " + esc(s.tour) + "</em>" : "") + "</h3>" +
          (s.participation !== null
            ? '<p class="participation chiffres">Participation ' + nombre(s.participation, 1) + "&nbsp;%" +
              (s.inscrits ? " · " + nombre(s.inscrits) + " inscrits" : "") + "</p>"
            : "") +
          "<ol>" + resultats + "</ol>" +
          (s.note ? '<p class="note">' + esc(s.note) + "</p>" : "") +
          '<p class="note">Source : ' + esc(s.source.nom) + " — " + esc(s.source.producteur) + ", " +
          esc(s.source.annee) + ". " +
          '<a class="lien" href="' + esc(s.source.url) + '" target="_blank" rel="noreferrer noopener">Résultats officiels</a></p>' +
          "</article>"
        );
      })
      .join("");

    return (
      '<section class="bloc">' +
      "<h2>Historique électoral</h2>" +
      '<p class="partiel" style="color:var(--texte-faible)">Résultats officiels des derniers ' +
      "scrutins, repris sans commentaire ni interprétation. Les nuances affichées sont celles " +
      "attribuées par le ministère de l&#39;Intérieur.</p>" +
      maire +
      '<div style="margin-top:1.25rem">' + scrutins + "</div>" +
      "</section>"
    );
  }

  function rendreVille(slug) {
    const commune = PAR_SLUG.get(slug);
    if (!commune) {
      vue.innerHTML =
        '<div style="padding:4rem 0"><h1 style="margin:0;font-size:26px;font-weight:600">Page introuvable</h1>' +
        '<p class="prose" style="margin-top:0.75rem">Cette commune ne fait pas partie du jeu de test.</p>' +
        '<p style="margin-top:1.25rem"><a class="puce" href="#/">Revenir au classement</a></p></div>';
      return;
    }

    vue.innerHTML =
      '<a class="retour" href="#/">' +
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="m10 3-5 5 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      "Retour au classement</a>" +
      '<header class="fiche-tete">' +
      "<h1>" + esc(commune.nom) + "</h1>" +
      '<p class="meta"><span class="chiffres">' + nombre(commune.population) + "</span> habitants " +
      "<em>(recensement " + commune.anneePopulation + ")</em>" +
      (commune.epci ? " · " + esc(commune.epci) : "") + "</p>" +
      '<p class="codes chiffres">Code INSEE ' + esc(commune.codeInsee) +
      (commune.surfaceKm2 ? " · " + nombre(commune.surfaceKm2, 1) + " km²" : "") +
      (commune.codesPostaux && commune.codesPostaux.length
        ? " · " + esc(commune.codesPostaux.join(", "))
        : "") + "</p>" +
      (commune.note ? '<p class="note">' + esc(commune.note) + "</p>" : "") +
      "</header>" +
      '<div class="blocs">' +
      CRITERES.map((c) => rendreBloc(commune, c)).join("") +
      rendrePolitique(commune) +
      "</div>" +
      '<p class="prose" style="margin-top:1.5rem;font-size:12.5px">Les mentions « devance X&nbsp;% ' +
      "des autres villes comparées » se rapportent uniquement aux " + COMMUNES.length +
      " communes de ce comparateur, pas à la France entière.</p>";
  }

  // ---------------------------------------------------------------- méthode

  function rendreMethode() {
    const parCritere = CRITERES.map((critere) => {
      const vues = new Map();
      for (const commune of COMMUNES) {
        const s = commune.criteres[critere.id] && commune.criteres[critere.id].source;
        if (s) vues.set(s.url + "|" + s.annee, s);
      }
      return (
        '<section class="bloc"><h2>' + esc(critere.libelle) + "</h2><ul class=\"liste-sources\">" +
        [...vues.values()]
          .map(
            (s) =>
              '<li style="margin-top:0.75rem;font-size:13.5px;line-height:1.6">' +
              '<a class="lien" href="' + esc(s.url) + '" target="_blank" rel="noreferrer noopener">' +
              esc(s.nom) + "</a>" +
              '<span style="color:var(--texte-doux)"> — ' + esc(s.producteur) + ", données " +
              esc(s.annee) + (s.licence ? ", " + esc(s.licence) : "") + ".</span>" +
              (s.consulteLe
                ? '<span style="color:var(--texte-faible)"> Consulté le ' + esc(dateCourte(s.consulteLe)) + ".</span>"
                : "") +
              "</li>",
          )
          .join("") +
        "</ul></section>"
      );
    }).join("");

    const electorales = new Map();
    for (const commune of COMMUNES) {
      for (const s of commune.politique.scrutins) electorales.set(s.source.url + "|" + s.source.annee, s.source);
      if (commune.politique.maire) {
        const s = commune.politique.maire.source;
        electorales.set(s.url + "|" + s.annee, s);
      }
    }

    vue.innerHTML =
      '<a class="retour" href="#/">' +
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="m10 3-5 5 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      "Retour au classement</a>" +
      '<header class="fiche-tete">' +
      "<h1>Sources et méthode</h1>" +
      '<p class="accroche" style="margin-top:0.75rem;max-width:52ch;font-size:15px;line-height:1.6;color:var(--texte-doux)">' +
      "Ce comparateur n&#39;a d&#39;intérêt que si l&#39;on peut vérifier ce qu&#39;il affiche. " +
      "Cette page dit d&#39;où vient chaque chiffre, comment le classement est calculé, et ce que " +
      "la méthode ne permet pas de conclure.</p>" +
      "</header>" +

      '<div class="blocs">' +
      '<section class="bloc"><h2>Comment le classement est calculé</h2>' +
      '<div class="prose" style="margin-top:0.75rem">' +
      "<p>Aucune note n&#39;est attribuée à une commune. Pour chaque mesure, on compte simplement " +
      "<strong>combien des autres communes comparées celle-ci devance</strong> — c&#39;est " +
      "exactement la phrase affichée : « moins cher que 72&nbsp;% des autres villes comparées ». " +
      "Quand beaucoup de communes ont la même valeur, la part à égalité est annoncée à côté, parce " +
      "qu&#39;une commune sans gare n&#39;est pas « devancée » par les seize autres qui n&#39;en " +
      "ont pas non plus.</p>" +
      "<p>Pour <em>trier</em>, en revanche, les ex æquo comptent pour une demi-victoire de part et " +
      "d&#39;autre : sans cela, une valeur très répandue écraserait le classement. Ce rang sert au " +
      "tri et à la longueur des barres ; il n&#39;est jamais transformé en une affirmation sur un " +
      "nombre de communes.</p>" +
      "<p>Quand un critère repose sur plusieurs mesures — les écoles combinent densité " +
      "d&#39;établissements et taux de réussite — sa position est la moyenne simple des positions " +
      "de ces mesures. Aucune pondération cachée : chaque fiche détaille les mesures retenues.</p>" +
      "<p><strong>Donnée manquante :</strong> le critère concerné est retiré du calcul pour cette " +
      "commune — du numérateur comme du dénominateur. Elle n&#39;est ni avantagée ni pénalisée, et " +
      "l&#39;omission est signalée sur sa ligne.</p>" +
      "</div></section>" +

      '<section class="bloc"><h2>Ce que ce comparateur ne dit pas</h2>' +
      '<div class="prose" style="margin-top:0.75rem"><ul>' +
      "<li>Les positions se rapportent aux " + COMMUNES.length + " communes de ce jeu de test, pas " +
      "à la France entière. Une commune « dans la moyenne » ici peut être atypique à " +
      "l&#39;échelle nationale.</li>" +
      "<li>Une moyenne communale masque les écarts entre quartiers, parfois considérables sur le " +
      "prix comme sur la sécurité.</li>" +
      "<li>Les millésimes diffèrent d&#39;un critère à l&#39;autre : chaque chiffre porte son " +
      "année, il n&#39;y a pas de photographie à une date unique.</li>" +
      "<li>L&#39;historique électoral est présenté à titre d&#39;information factuelle. Il " +
      "n&#39;entre dans aucun calcul et n&#39;influence aucun classement.</li>" +
      "</ul></div></section>" +

      parCritere +

      '<section class="bloc"><h2>Résultats électoraux</h2><ul>' +
      [...electorales.values()]
        .map(
          (s) =>
            '<li style="margin-top:0.75rem;font-size:13.5px;line-height:1.6;list-style:none">' +
            '<a class="lien" href="' + esc(s.url) + '" target="_blank" rel="noreferrer noopener">' +
            esc(s.nom) + "</a>" +
            '<span style="color:var(--texte-doux)"> — ' + esc(s.producteur) + ", données " +
            esc(s.annee) + (s.licence ? ", " + esc(s.licence) : "") + ".</span></li>",
        )
        .join("") +
      "</ul></section>" +
      "</div>" +
      '<p class="chiffres" style="margin-top:1.5rem;font-size:12.5px;color:var(--texte-faible)">' +
      "Jeu de données assemblé le " + esc(dateCourte(JEU.genereLe)) + ". Zone couverte : " +
      esc(JEU.zone) + ".</p>";
  }

  // ------------------------------------------------------------------ route

  function router() {
    const route = window.location.hash.replace(/^#/, "");
    const ville = /^\/ville\/(.+)$/.exec(route);
    if (ville) rendreVille(decodeURIComponent(ville[1]));
    else if (route === "/methode") rendreMethode();
    else if (route === "sources" || route === "") {
      rendreAccueil();
      if (route === "sources") {
        const cible = document.getElementById("sources");
        if (cible) cible.scrollIntoView({ behavior: douceur() ? "smooth" : "auto" });
        return;
      }
    } else rendreAccueil();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  vue.addEventListener("input", (e) => {
    const cible = e.target;
    if (!cible.classList || !cible.classList.contains("curseur")) return;
    const liste = document.getElementById("classement");
    if (!liste) return;
    etat.poids[cible.dataset.critere] = Number(cible.value);
    majCurseur(cible);
    majClassement(liste, true);
  });

  window.addEventListener("hashchange", router);
  router();
})();
