"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AttributionControl,
  Map as CarteMapLibre,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONFeatureDiff,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import departementsGeoJSON from "@/data/geo/departements.json";
import { CRITERES } from "@/lib/criteres";
import { nomDepartement } from "@/lib/departements";
import { valeurMesure } from "@/lib/format";
import { mesureVedette } from "@/lib/mesures";
import type { Commune } from "@/lib/types";

// Turbopack ne résout pas l'URL du worker de traitement des données que
// MapLibre construit lui-même via `import.meta.url` (elle arrive vide côté
// navigateur : le worker ne démarre jamais, sans la moindre erreur — juste
// des sources qui ne se chargent jamais). Contournement : servir le fichier
// nous-mêmes (copié dans `public/` à chaque dev/build, voir
// scripts/copier-worker-carte.mjs) et le désigner explicitement.
if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-worker.mjs");

/** Lit une couleur de thème résolue par le navigateur (clair/sombre), pour un
 * rendu WebGL qui vit hors de la cascade CSS et ne peut pas lire `var(...)`. */
function couleur(nomVariable: string): string {
  if (typeof window === "undefined") return "#000000";
  return getComputedStyle(document.documentElement).getPropertyValue(nomVariable).trim();
}

interface Palette {
  accentDoux: string;
  accent: string;
  accentFort: string;
  traitFort: string;
  fondDoux: string;
  fondCarte: string;
}

function lirePalette(): Palette {
  return {
    accentDoux: couleur("--accent-doux"),
    accent: couleur("--accent"),
    accentFort: couleur("--accent-fort"),
    traitFort: couleur("--trait-fort"),
    fondDoux: couleur("--fond-doux"),
    fondCarte: couleur("--fond-carte"),
  };
}

/**
 * Deux échelles de lecture. Dézoomée, la carte se lit par départements
 * (teintés) et par badges (les meilleures communes) : les milliers de points
 * individuels, qui à cette échelle ne font qu'un grain uniforme, sont
 * masqués. À partir de `ZOOM_VILLES`, ce sont les communes qui deviennent le
 * sujet : les points apparaissent, survolables et cliquables.
 */
const ZOOM_VILLES = 6.8;
/** Délai minimal entre deux envois de couleurs au worker pendant un glissement. */
const INTERVALLE_ENVOI = 120;
/** Score arrondi au centième : cent teintes suffisent, et la plupart des communes ne changent pas de teinte d'un tick à l'autre. */
const quantifier = (score: number | undefined) => (score === undefined ? -1 : Math.round(score * 100) / 100);
/** En dessous, cliquer un département zoome dessus ; au-dessus, l'ajoute au filtre. */
const SEUIL_ZOOM_FILTRE = 7;

/** Cadrage de la France métropolitaine : un `fitBounds`, jamais un centre et
 * un zoom fixes, pour que la carte remplisse tout le cadre qu'on lui donne —
 * une bande en haut d'un téléphone ou tout le fond d'un écran. */
const BORNES_FRANCE: LngLatBoundsLike = [
  [-5.3, 41.2],
  [9.8, 51.3],
];
/** Marge haute plus large : la recherche flotte en haut de la carte et ne
 * doit pas recouvrir la pointe nord (Dunkerque) sur un écran étroit. */
const CADRAGE_FRANCE = { padding: { top: 64, right: 24, bottom: 24, left: 24 } };

function echapper(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Bornes lon/lat d'une géométrie Polygon/MultiPolygon, pour cadrer la vue
 * sur un département au clic (parcours récursif, quelle que soit la
 * profondeur de nesting des anneaux). */
function bornesDe(geometrie: GeoJSON.Geometry): LngLatBoundsLike {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  const visiter = (coords: unknown): void => {
    if (typeof coords === "number") return;
    const tableau = coords as unknown[];
    if (typeof tableau[0] === "number") {
      const [lon, lat] = tableau as [number, number];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const c of tableau) visiter(c);
    }
  };
  visiter((geometrie as { coordinates: unknown }).coordinates);
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/** Contenu de l'infobulle d'une commune : sa donnée vedette sur chacun des
 * quatre critères, la même valeur brute que sur sa fiche — jamais une note. */
function contenuCommune(commune: Commune, rang?: number): string {
  const stats = CRITERES.map((critere) => {
    const donnees = commune.criteres[critere.id];
    const mesure = donnees ? mesureVedette(donnees.mesures) : undefined;
    const valeur = mesure ? valeurMesure(mesure) : "—";
    return `<div class="flex items-baseline justify-between gap-3"><span class="text-texte-faible">${echapper(
      critere.libelle,
    )}</span><span class="chiffres font-medium text-texte">${echapper(valeur)}</span></div>`;
  }).join("");
  const enTete = rang
    ? `<span class="chiffres mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-carte">${rang}</span>`
    : "";
  return `<div class="min-w-[200px] text-[13px] leading-snug">
    <p class="flex items-center text-[14px] font-semibold text-texte">${enTete}${echapper(commune.nom)}</p>
    <p class="text-texte-faible"><span class="chiffres">${commune.population.toLocaleString("fr-FR")}</span> hab. · ${echapper(nomDepartement(commune.departement))}</p>
    <div class="mt-1.5 space-y-0.5">${stats}</div>
    <p class="mt-1.5 text-[11.5px] text-texte-faible">Cliquez pour ouvrir sa fiche</p>
  </div>`;
}

/** Contenu de l'infobulle d'un département : un décompte réel de communes
 * comparées ici, et la meilleure d'entre elles — jamais un score de zone
 * inventé, seulement un chiffre concret et une commune qui existe vraiment. */
function contenuDepartement(
  nom: string,
  code: string,
  compteInclus: number,
  meilleure: Commune | null,
): string {
  const phraseCompte =
    compteInclus > 0
      ? `<span class="chiffres">${compteInclus}</span> commune${compteInclus > 1 ? "s" : ""} comparée${compteInclus > 1 ? "s" : ""} ici`
      : "aucune commune ne correspond ici à vos filtres";
  const phraseMeilleure = meilleure
    ? `<p class="mt-1 text-texte-faible">Meilleure correspondance : <span class="font-medium text-texte">${echapper(meilleure.nom)}</span></p>`
    : "";
  return `<div class="min-w-[200px] text-[13px] leading-snug">
    <p class="text-[14px] font-semibold text-texte">${echapper(nom)} <span class="chiffres text-texte-faible">(${echapper(code)})</span></p>
    <p class="mt-0.5 text-texte-faible">${phraseCompte}</p>
    ${phraseMeilleure}
    ${compteInclus > 0 ? `<p class="mt-1.5 text-[11.5px] text-texte-faible">Cliquez pour explorer ses communes</p>` : ""}
  </div>`;
}

const CLASSES_POPUP =
  "!rounded-2xl [&_.maplibregl-popup-content]:!rounded-2xl [&_.maplibregl-popup-content]:!border [&_.maplibregl-popup-content]:!border-trait [&_.maplibregl-popup-content]:!bg-carte [&_.maplibregl-popup-content]:!px-3.5 [&_.maplibregl-popup-content]:!py-3 [&_.maplibregl-popup-content]:!shadow-flottante";

/**
 * La carte de France, pensée comme une exploration à deux profondeurs plutôt
 * qu'un nuage de points :
 *
 *  - dézoomée, chaque département est teinté selon la position moyenne de
 *    ses communes (choroplèthe), et les meilleures communes du moment portent
 *    un badge numéroté — la réponse se lit d'un coup d'œil, et bouge en
 *    direct sous les curseurs ;
 *  - un clic sur un département zoome dessus : ses communes deviennent le
 *    sujet, chacune colorée, dimensionnée et plus ou moins opaque selon sa
 *    position relative — trois canaux pour un même signal, lisible même sans
 *    distinguer les teintes ; la meilleure y est mise en évidence ;
 *  - un second clic, une fois dans le département, bascule le filtre de
 *    localisation ;
 *  - au survol, une infobulle donne une donnée concrète (jamais une note) :
 *    la valeur vedette de chaque critère pour une commune, un décompte réel
 *    de communes et la meilleure correspondance pour un département.
 *
 * La liste lui parle aussi (voir Comparateur.tsx) : survoler une ligne met la
 * commune en évidence, demander à la voir fait voler la carte dessus.
 *
 * Rendu en WebGL (MapLibre) : recolorer des milliers de points au fil d'un
 * glissement de curseur ne touche jamais le DOM (`setFeatureState`), donc ne
 * revient jamais bloquer le fil principal comme le ferait un re-rendu de
 * liste.
 */
export function CarteFrance({
  communes,
  scores,
  exclues,
  meilleures,
  survolee,
  cible,
  departementsSelectionnes,
  onToggleDepartement,
  repere,
  placement,
  onPlacer,
}: {
  communes: Commune[];
  /** codeInsee -> position relative [0,1], recalculée en direct à chaque tick de curseur. */
  scores: Map<string, number>;
  /** codeInsee des communes écartées par les filtres actifs (localisation, valeur). */
  exclues: Set<string>;
  /** Les meilleures communes du moment, dans l'ordre : elles portent un badge numéroté. */
  meilleures: Commune[];
  /** Commune survolée dans la liste, à mettre en évidence sur la carte. */
  survolee: string | null;
  /** Commune qu'on a demandé à voir : la carte vole dessus (le compteur permet de la redemander). */
  cible: { codeInsee: string; n: number } | null;
  departementsSelectionnes: string[];
  onToggleDepartement: (code: string) => void;
  /** Le repère personnel, marqué sur la carte. */
  repere: { lat: number; lon: number; nom: string } | null;
  /** Le prochain clic sur la carte pose le repère. */
  placement: boolean;
  onPlacer: (lat: number, lon: number) => void;
}) {
  const router = useRouter();
  const conteneurRef = useRef<HTMLDivElement>(null);
  const carteRef = useRef<CarteMapLibre | null>(null);
  const popupRef = useRef<Popup | null>(null);
  // État (pas une simple ref) : la carte devient prête de façon asynchrone
  // (événement « load »), après le premier passage des effets ci-dessous —
  // sans re-rendu à ce moment-là, l'effet de coloration aurait déjà terminé
  // son unique passage (avec la carte pas encore prête) et ne serait jamais
  // rejoué, laissant les points sans couleur jusqu'au prochain changement.
  const [pret, setPret] = useState(false);
  const [zoomAvance, setZoomAvance] = useState(false);

  const communeParCode = useMemo(() => new Map(communes.map((c) => [c.codeInsee, c])), [communes]);
  const communesParDepartement = useMemo(() => {
    const groupes = new Map<string, Commune[]>();
    for (const commune of communes) {
      const liste = groupes.get(commune.departement);
      if (liste) liste.push(commune);
      else groupes.set(commune.departement, [commune]);
    }
    return groupes;
  }, [communes]);

  // Toujours la dernière version de ces valeurs dans les gestionnaires
  // d'événements MapLibre, posés une seule fois à l'initialisation.
  const etatRef = useRef({
    departementsSelectionnes,
    onToggleDepartement,
    placement,
    onPlacer,
    router,
    scores,
    exclues,
    meilleures,
    communeParCode,
    communesParDepartement,
  });
  etatRef.current = {
    departementsSelectionnes,
    onToggleDepartement,
    placement,
    onPlacer,
    router,
    scores,
    exclues,
    meilleures,
    communeParCode,
    communesParDepartement,
  };

  function popup(): Popup {
    if (!popupRef.current) {
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        maxWidth: "280px",
        className: CLASSES_POPUP,
      });
    }
    return popupRef.current;
  }

  function rangDe(codeInsee: string): number | undefined {
    const i = etatRef.current.meilleures.findIndex((c) => c.codeInsee === codeInsee);
    return i >= 0 ? i + 1 : undefined;
  }

  // La commune mise en évidence après un zoom sur son département, ou quand
  // la liste demande à la voir : sans ceci, la « meilleure correspondance »
  // suggérée au survol disparaissait sans laisser de trace une fois le zoom
  // terminé.
  const misEnAvantRef = useRef<string | null>(null);
  const popupMisEnAvantRef = useRef<Popup | null>(null);
  const minuterieMisEnAvantRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function meilleureCommuneDe(code: string): { compteInclus: number; meilleure: Commune | null } {
    const { scores: scoresActuels, exclues: excluesActuelles, communesParDepartement: groupes } =
      etatRef.current;
    const membres = groupes.get(code) ?? [];
    let meilleure: Commune | null = null;
    let meilleurScore = -Infinity;
    let compteInclus = 0;
    for (const membre of membres) {
      if (excluesActuelles.has(membre.codeInsee)) continue;
      compteInclus += 1;
      const s = scoresActuels.get(membre.codeInsee) ?? 0;
      if (s > meilleurScore) {
        meilleurScore = s;
        meilleure = membre;
      }
    }
    return { compteInclus, meilleure };
  }

  function mettreEnAvant(carte: CarteMapLibre, commune: Commune | null, libelle: string) {
    if (misEnAvantRef.current) {
      carte.setFeatureState({ source: "communes", id: misEnAvantRef.current }, { misEnAvant: false });
      misEnAvantRef.current = null;
    }
    if (minuterieMisEnAvantRef.current) clearTimeout(minuterieMisEnAvantRef.current);
    popupMisEnAvantRef.current?.remove();
    if (!commune || commune.lat == null || commune.lon == null) return;

    misEnAvantRef.current = commune.codeInsee;
    carte.setFeatureState({ source: "communes", id: commune.codeInsee }, { misEnAvant: true });

    if (!popupMisEnAvantRef.current) {
      popupMisEnAvantRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        maxWidth: "240px",
        className: CLASSES_POPUP.replace("!border-trait", "!border-accent-trait"),
      });
    }
    popupMisEnAvantRef.current
      .setLngLat([commune.lon, commune.lat])
      .setHTML(
        `<p class="text-[12.5px] font-medium leading-snug text-texte">${echapper(libelle)}<br/><span class="text-[13.5px] font-semibold">${echapper(commune.nom)}</span></p>`,
      )
      .addTo(carte);
    // S'efface d'elle-même : un repère ponctuel après le zoom, pas une
    // étiquette permanente qui finirait par gêner la lecture de la carte.
    minuterieMisEnAvantRef.current = setTimeout(() => {
      popupMisEnAvantRef.current?.remove();
    }, 4500);
  }

  useEffect(() => {
    if (!conteneurRef.current) return;
    const palette = lirePalette();

    // Score et exclusion voyagent en PROPRIÉTÉS des points, pas en état de
    // feature : à 34 746 communes, `setFeatureState` sur chaque point forçait
    // la réévaluation de la peinture de toutes les tuiles sur le fil principal
    // (une seconde par tick de curseur). Les propriétés, elles, se mettent à
    // jour par diff dans le worker de MapLibre (`updateData`), et seules les
    // communes dont la couleur change réellement sont envoyées.
    const { scores: scoresInitiaux, exclues: excluesInitiales } = dernierRef.current;
    envoyeRef.current = new Map();
    const communesGeoJSON: GeoJSON.FeatureCollection<
      GeoJSON.Point,
      { codeInsee: string; slug: string; score: number; exclue: boolean }
    > = {
      type: "FeatureCollection",
      features: communes
        .filter((c) => c.lat != null && c.lon != null)
        .map((c) => {
          const score = quantifier(scoresInitiaux.get(c.codeInsee));
          const exclue = excluesInitiales.has(c.codeInsee);
          envoyeRef.current.set(c.codeInsee, { score, exclue });
          return {
            type: "Feature",
            id: c.codeInsee,
            geometry: { type: "Point", coordinates: [c.lon!, c.lat!] },
            properties: { codeInsee: c.codeInsee, slug: c.slug, score, exclue },
          };
        }),
    };

    const carte = new CarteMapLibre({
      container: conteneurRef.current,
      style: { version: 8, sources: {}, layers: [] },
      bounds: BORNES_FRANCE,
      fitBoundsOptions: CADRAGE_FRANCE,
      minZoom: 4,
      maxZoom: 11,
      maxBounds: [
        [-6.5, 40.5],
        [11, 51.5],
      ],
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
    });
    carteRef.current = carte;
    carte.on("error", (e) => console.error("[CarteFrance]", e.error));
    carte.touchZoomRotate.disableRotation();
    carte.addControl(new NavigationControl({ showCompass: false }), "top-right");
    carte.addControl(
      new AttributionControl({ compact: false, customAttribution: "IGN Admin Express / INSEE" }),
      "bottom-left",
    );
    carte.on("zoom", () => {
      const avance = carte.getZoom() >= SEUIL_ZOOM_FILTRE;
      setZoomAvance((precedent) => (precedent === avance ? precedent : avance));
    });

    // Le zoom ne peut être l'entrée que d'une seule `interpolate` de premier
    // niveau par propriété : les autres dimensions (score, mise en évidence)
    // se glissent dans les sorties de chacun de ses paliers.
    const scoreOuAbsent: ExpressionSpecification = ["coalesce", ["get", "score"], -1];
    const enEvidence: ExpressionSpecification = [
      "any",
      ["boolean", ["feature-state", "misEnAvant"], false],
      ["boolean", ["feature-state", "survol"], false],
    ];
    const exclue: ExpressionSpecification = ["boolean", ["get", "exclue"], false];

    carte.on("load", () => {
      carte.addSource("departements", {
        type: "geojson",
        data: departementsGeoJSON as GeoJSON.FeatureCollection,
        promoteId: "code",
      });
      carte.addLayer({
        id: "departements-fill",
        type: "fill",
        source: "departements",
        paint: {
          // Le remplissage code la position moyenne des communes du
          // département (choroplèthe) ; la sélection du filtre de
          // localisation se lit sur le contour, pas sur cette couleur — les
          // deux informations restent distinctes et lisibles ensemble.
          "fill-color": [
            "interpolate",
            ["linear"],
            scoreOuAbsent,
            -1,
            palette.fondDoux,
            0,
            palette.accentDoux,
            0.5,
            palette.accent,
            1,
            palette.accentFort,
          ],
          // S'efface une fois qu'on explore les communes individuelles : au
          // premier plan, ce sont elles le sujet, le département redevient
          // un simple repère de fond.
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.92, ZOOM_VILLES - 0.3, 0.85, ZOOM_VILLES + 1, 0.28],
        },
      });
      carte.addLayer({
        id: "departements-ligne",
        type: "line",
        source: "departements",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selectionne"], false],
            palette.accent,
            palette.traitFort,
          ],
          "line-width": ["case", ["boolean", ["feature-state", "selectionne"], false], 2, 0.6],
        },
      });

      carte.addSource("communes", {
        type: "geojson",
        data: communesGeoJSON,
        promoteId: "codeInsee",
      });
      carte.addLayer({
        id: "communes-points",
        type: "circle",
        source: "communes",
        paint: {
          // Rayon, couleur et opacité codent tous les trois la même position
          // relative : une commune qui ressort le fait sur les trois canaux à
          // la fois (lisible même sans distinguer les teintes), jamais sur un
          // seul qu'un resserrement de la distribution rendrait invisible.
          // Une commune mise en évidence force un rayon plat, nettement plus
          // grand que n'importe quel score.
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            ["case", enEvidence, 5, ["interpolate", ["linear"], scoreOuAbsent, -1, 0.9, 0, 1.05, 0.5, 1.45, 1, 2.3]],
            7,
            ["case", enEvidence, 9, ["interpolate", ["linear"], scoreOuAbsent, -1, 1.75, 0, 2.1, 0.5, 2.9, 1, 4.6]],
            11,
            ["case", enEvidence, 14, ["interpolate", ["linear"], scoreOuAbsent, -1, 3.5, 0, 4.2, 0.5, 6, 1, 9.5]],
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            scoreOuAbsent,
            -1,
            palette.traitFort,
            0,
            palette.accentDoux,
            0.5,
            palette.accent,
            1,
            palette.accentFort,
          ],
          // Invisibles dézoomés (seule une commune mise en évidence perce),
          // ils apparaissent en entrant dans l'échelle des villes.
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            ZOOM_VILLES - 0.4,
            ["case", enEvidence, 1, 0],
            ZOOM_VILLES + 0.6,
            [
              "case",
              exclue,
              0.08,
              ["interpolate", ["linear"], scoreOuAbsent, -1, 0.25, 0, 0.35, 0.5, 0.55, 1, 1],
            ],
          ],
          "circle-stroke-width": ["case", enEvidence, 2.5, 0.4],
          "circle-stroke-color": ["case", enEvidence, palette.accentFort, palette.fondCarte],
          // Le contour a sa propre opacité : sans ce palier, les 5 000 liserés
          // blancs resteraient visibles dézoomés, en grain sur les départements.
          "circle-stroke-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            ZOOM_VILLES - 0.4,
            ["case", enEvidence, 1, 0],
            ZOOM_VILLES + 0.6,
            ["case", exclue, 0.08, 1],
          ],
        },
      });

      setPret(true);

      const pointsActifs = () => carte.getZoom() >= ZOOM_VILLES;

      // Une seule paire d'écouteurs génériques (non liés à une couche) pour le
      // survol : une commune et le département qui la contient occupent tous
      // deux le même pixel, et deux gestionnaires posés par couche («
      // communes-points » et « departements-fill » reçoivent chacun cet
      // événement) finissent par se marcher dessus — le second retirant
      // l'infobulle que le premier vient de poser. Une seule décision, avec
      // une priorité explicite (commune avant département), l'évite.
      carte.on("mousemove", (e) => {
        if (etatRef.current.placement) {
          carte.getCanvas().style.cursor = "crosshair";
          popup().remove();
          return;
        }
        if (pointsActifs()) {
          const surCommune = carte.queryRenderedFeatures(e.point, { layers: ["communes-points"] });
          const codeInsee = surCommune[0]?.properties?.codeInsee;
          const commune = codeInsee ? etatRef.current.communeParCode.get(codeInsee) : undefined;
          if (commune) {
            carte.getCanvas().style.cursor = "pointer";
            popup()
              .setLngLat(e.lngLat)
              .setHTML(contenuCommune(commune, rangDe(commune.codeInsee)))
              .addTo(carte);
            return;
          }
        }

        const surDepartement = carte.queryRenderedFeatures(e.point, { layers: ["departements-fill"] });
        const props = surDepartement[0]?.properties;
        if (!props) {
          carte.getCanvas().style.cursor = "";
          popup().remove();
          return;
        }
        carte.getCanvas().style.cursor = "pointer";
        const { compteInclus, meilleure } = meilleureCommuneDe(props.code);
        popup()
          .setLngLat(e.lngLat)
          .setHTML(contenuDepartement(props.nom, props.code, compteInclus, meilleure))
          .addTo(carte);
      });
      carte.on("mouseout", () => {
        carte.getCanvas().style.cursor = "";
        popup().remove();
      });

      // Pose du repère : un clic n'importe où, puis les autres clics reprennent leur sens.
      carte.on("click", (e) => {
        if (!etatRef.current.placement) return;
        etatRef.current.onPlacer(e.lngLat.lat, e.lngLat.lng);
      });

      carte.on("click", "communes-points", (e: MapLayerMouseEvent) => {
        if (etatRef.current.placement || !pointsActifs()) return;
        const slug = e.features?.[0]?.properties?.slug;
        // Navigation douce : depuis la carte, /ville/<slug> s'ouvre en volet
        // (route interceptée, voir (carte)/@detail), la carte reste en place.
        if (slug) etatRef.current.router.push(`/ville/${slug}`, { scroll: false });
      });

      carte.on("click", "departements-fill", (e: MapLayerMouseEvent) => {
        if (etatRef.current.placement) return;
        // Un point de commune est toujours à l'intérieur de son département :
        // sans cette vérification, cliquer une commune pour sa fiche
        // bascule aussi, par surprise, le filtre du département sous elle.
        if (
          pointsActifs() &&
          carte.queryRenderedFeatures(e.point, { layers: ["communes-points"] }).length > 0
        ) {
          return;
        }
        const feature = e.features?.[0];
        const code = feature?.properties?.code;
        if (!code || !feature) return;
        popup().remove();
        if (carte.getZoom() < SEUIL_ZOOM_FILTRE) {
          // Premier clic : on explore, on ne filtre pas encore — la carte se
          // comporte comme un plan à deux échelles (département puis ville).
          // La suggestion vue au survol ne doit pas disparaître au zoom :
          // calculée maintenant (avant que la vue bouge), elle ne se met en
          // évidence qu'une fois le cadrage terminé (« moveend »), à sa
          // position d'écran définitive.
          const { meilleure } = meilleureCommuneDe(code);
          carte.once("moveend", () =>
            mettreEnAvant(carte, meilleure, "★ Meilleure correspondance ici"),
          );
          carte.fitBounds(bornesDe(feature.geometry), { padding: 40, duration: 700 });
        } else {
          // Déjà cadré sur ce département : la seconde intention naturelle
          // est d'en faire un filtre, pas de zoomer davantage.
          etatRef.current.onToggleDepartement(code);
        }
      });
    });

    return () => {
      setPret(false);
      popupRef.current?.remove();
      popupRef.current = null;
      if (minuterieMisEnAvantRef.current) clearTimeout(minuterieMisEnAvantRef.current);
      popupMisEnAvantRef.current?.remove();
      popupMisEnAvantRef.current = null;
      misEnAvantRef.current = null;
      for (const { marqueur } of marqueursRef.current.values()) marqueur.remove();
      marqueursRef.current.clear();
      carte.remove();
    };
    // Reconstruit la carte seulement si le jeu de communes change ; scores,
    // sélection et badges se posent ensuite via feature-state et marqueurs,
    // sans jamais reconstruire la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communes]);

  // Recoloration en direct : appelée à chaque tick de curseur (voir
  // Comparateur.tsx). Aucun nœud DOM n'est touché, mais poser l'état de
  // chaque commune reste un aller-retour vers le moteur WebGL — sur 5 000+
  // points, ce passage à lui seul peut dépasser le budget d'une image (16 ms)
  // si deux ticks arrivent avant le prochain rendu. On ne garde donc jamais
  // que la dernière valeur demandée et on ne l'applique qu'une fois par
  // image. Le même passage accumule la moyenne par département (choroplèthe),
  // pour ne jamais reparcourir deux fois les mêmes 5 000 communes.
  const dernierRef = useRef<{ communes: Commune[]; scores: Map<string, number>; exclues: Set<string> }>(
    { communes, scores, exclues },
  );
  dernierRef.current = { communes, scores, exclues };
  // Ce que chaque point porte actuellement (score quantifié, exclusion) : on
  // n'envoie au worker que les communes dont l'un des deux change.
  const envoyeRef = useRef<Map<string, { score: number; exclue: boolean }>>(new Map());
  const minuterieEnvoiRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierEnvoiRef = useRef(0);
  useEffect(() => {
    const carte = carteRef.current;
    if (!carte || !pret || !carte.getSource("departements")) return;
    const id = requestAnimationFrame(() => {
      // La carte a pu être reconstruite entre-temps (nouveau jeu de communes) :
      // ses sources n'existent qu'après « load », qui rejouera cet effet.
      if (!carte.getSource("departements") || !carte.getSource("communes")) return;
      const { communes, scores, exclues } = dernierRef.current;
      const sommeParDepartement = new Map<string, { somme: number; compte: number }>();
      const changements: GeoJSONFeatureDiff[] = [];
      for (const commune of communes) {
        const score = scores.get(commune.codeInsee);
        const estExclue = exclues.has(commune.codeInsee);
        const q = quantifier(score);
        const avant = envoyeRef.current.get(commune.codeInsee);
        if (avant && (avant.score !== q || avant.exclue !== estExclue)) {
          envoyeRef.current.set(commune.codeInsee, { score: q, exclue: estExclue });
          changements.push({
            id: commune.codeInsee,
            addOrUpdateProperties: [
              { key: "score", value: q },
              { key: "exclue", value: estExclue },
            ],
          });
        }
        if (!estExclue) {
          const entree = sommeParDepartement.get(commune.departement) ?? { somme: 0, compte: 0 };
          entree.somme += score ?? 0.5;
          entree.compte += 1;
          sommeParDepartement.set(commune.departement, entree);
        }
      }
      // La choroplèthe (96 départements) reste en état de feature : négligeable,
      // et elle est ce qu'on voit dézoomé — elle doit suivre chaque tick.
      for (const feature of (departementsGeoJSON as GeoJSON.FeatureCollection).features) {
        const code = (feature.properties as { code: string }).code;
        const entree = sommeParDepartement.get(code);
        carte.setFeatureState(
          { source: "departements", id: code },
          { score: entree ? entree.somme / entree.compte : -1 },
        );
      }
      if (changements.length === 0) return;
      // Un envoi au plus toutes les `INTERVALLE_ENVOI` ms pendant un glissement
      // (les diffs en attente sont fusionnés côté MapLibre) : le worker n'est
      // jamais saturé, le fil principal jamais bloqué.
      const envoyer = () => {
        const source = carte.getSource("communes") as GeoJSONSource | undefined;
        if (!source) return;
        dernierEnvoiRef.current = performance.now();
        minuterieEnvoiRef.current = null;
        source.updateData({ update: changements });
      };
      const attente = INTERVALLE_ENVOI - (performance.now() - dernierEnvoiRef.current);
      if (minuterieEnvoiRef.current) clearTimeout(minuterieEnvoiRef.current);
      if (attente <= 0) envoyer();
      else minuterieEnvoiRef.current = setTimeout(envoyer, attente);
    });
    return () => cancelAnimationFrame(id);
  }, [communes, scores, exclues, pret]);

  useEffect(() => {
    const carte = carteRef.current;
    if (!carte || !pret || !carte.getSource("departements")) return;
    const source = carte.getSource("departements") as GeoJSONSource | undefined;
    if (!source) return;
    for (const feature of (departementsGeoJSON as GeoJSON.FeatureCollection).features) {
      const code = (feature.properties as { code: string }).code;
      carte.setFeatureState(
        { source: "departements", id: code },
        { selectionne: departementsSelectionnes.includes(code) },
      );
    }
  }, [departementsSelectionnes, pret]);

  // Badges des meilleures communes : des marqueurs DOM (pas une couche de
  // symboles, qui exigerait des glyphes servis par le réseau), réutilisés
  // d'une image à l'autre — seul le numéro change quand le classement bouge.
  // Le bouton fait 36 px pour le doigt ; la pastille visible est plus petite.
  // Le repère personnel : un marqueur à part, d'une forme différente des badges.
  const repereRef = useRef<Marker | null>(null);
  useEffect(() => {
    const carte = carteRef.current;
    if (!carte || !pret) return;
    if (!repere) {
      repereRef.current?.remove();
      repereRef.current = null;
      return;
    }
    if (!repereRef.current) {
      const element = document.createElement("div");
      element.className = "repere-carte";
      element.setAttribute("role", "img");
      repereRef.current = new Marker({ element, anchor: "bottom" }).setLngLat([repere.lon, repere.lat]).addTo(carte);
    } else {
      repereRef.current.setLngLat([repere.lon, repere.lat]);
    }
    repereRef.current.getElement().setAttribute("aria-label", `Repère : ${repere.nom}`);
    repereRef.current.getElement().title = `Repère : ${repere.nom}`;
  }, [repere, pret]);

  const marqueursRef = useRef(new Map<string, { marqueur: Marker; badge: HTMLSpanElement }>());
  useEffect(() => {
    const carte = carteRef.current;
    if (!carte || !pret || !carte.getSource("departements")) return;
    const actuels = marqueursRef.current;
    const voulus = new Set(meilleures.map((c) => c.codeInsee));
    for (const [code, { marqueur }] of actuels) {
      if (!voulus.has(code)) {
        marqueur.remove();
        actuels.delete(code);
      }
    }
    meilleures.forEach((commune, i) => {
      if (commune.lat == null || commune.lon == null) return;
      const rang = i + 1;
      let entree = actuels.get(commune.codeInsee);
      if (!entree) {
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "badge-commune-cible";
        const badge = document.createElement("span");
        badge.className = "badge-commune chiffres";
        bouton.appendChild(badge);
        bouton.addEventListener("mouseenter", () => {
          const c = etatRef.current.communeParCode.get(commune.codeInsee);
          if (!c || c.lat == null || c.lon == null) return;
          popup()
            .setLngLat([c.lon, c.lat])
            .setHTML(contenuCommune(c, rangDe(c.codeInsee)))
            .addTo(carte);
        });
        bouton.addEventListener("mouseleave", () => popup().remove());
        bouton.addEventListener("click", () =>
          etatRef.current.router.push(`/ville/${commune.slug}`, { scroll: false }),
        );
        const marqueur = new Marker({ element: bouton, anchor: "center" })
          .setLngLat([commune.lon, commune.lat])
          .addTo(carte);
        entree = { marqueur, badge };
        actuels.set(commune.codeInsee, entree);
      }
      entree.badge.textContent = String(rang);
      entree.badge.dataset.rang = rang <= 3 ? "tete" : "suite";
      const element = entree.marqueur.getElement();
      element.style.zIndex = String(200 - rang);
      element.setAttribute(
        "aria-label",
        `${rang === 1 ? "1re" : `${rang}e`} — ${commune.nom}, voir la fiche`,
      );
    });
  }, [meilleures, pret]);

  // Survol depuis la liste : la commune ressort sur la carte (point et badge).
  const survolPrecedentRef = useRef<string | null>(null);
  useEffect(() => {
    const carte = carteRef.current;
    if (!carte || !pret || !carte.getSource("departements")) return;
    const avant = survolPrecedentRef.current;
    if (avant && avant !== survolee) {
      carte.setFeatureState({ source: "communes", id: avant }, { survol: false });
      marqueursRef.current.get(avant)?.badge.removeAttribute("data-survol");
    }
    if (survolee) {
      carte.setFeatureState({ source: "communes", id: survolee }, { survol: true });
      marqueursRef.current.get(survolee)?.badge.setAttribute("data-survol", "true");
    }
    survolPrecedentRef.current = survolee;
  }, [survolee, pret]);

  // « Voir sur la carte » depuis la liste ou la recherche : la carte vole sur
  // la commune, assez près pour que ses voisines apparaissent, et la met en
  // évidence une fois arrivée.
  useEffect(() => {
    const carte = carteRef.current;
    if (!carte || !pret || !cible) return;
    const commune = communeParCode.get(cible.codeInsee);
    if (!commune || commune.lat == null || commune.lon == null) return;
    carte.once("moveend", () => mettreEnAvant(carte, commune, "Vous êtes ici"));
    carte.flyTo({
      center: [commune.lon, commune.lat],
      zoom: Math.max(carte.getZoom(), 9),
      duration: 900,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible, pret]);

  return (
    <div className="relative h-full w-full">
      {/* Remplit toujours son conteneur : c'est celui-ci (voir Comparateur.tsx)
          qui décide de la taille. */}
      <div ref={conteneurRef} className="h-full w-full" />
      {zoomAvance && (
        <button
          type="button"
          onClick={() => {
            if (carteRef.current) mettreEnAvant(carteRef.current, null, "");
            carteRef.current?.fitBounds(BORNES_FRANCE, { ...CADRAGE_FRANCE, duration: 700 });
          }}
          className="absolute left-3 top-[60px] z-10 rounded-full border border-trait bg-carte/95 px-3.5 py-2 text-[13px] font-medium text-texte-doux shadow-flottante backdrop-blur transition-colors hover:border-trait-fort hover:text-texte"
        >
          ← Toute la France
        </button>
      )}
    </div>
  );
}
