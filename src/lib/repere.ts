import { CRITERES } from "./criteres";
import type { Poids } from "./scoring";
import type { Commune, CritereDonnees, Source } from "./types";

/**
 * Le repère personnel : un lieu qui compte pour l'utilisateur (son travail, sa
 * famille), à partir duquel chaque commune reçoit une distance à vol d'oiseau.
 * Cette distance devient la mesure du critère « Proximité », classante comme les
 * autres, et un filtre de rayon. Sans repère, le critère n'existe pour aucune
 * commune et son curseur ne compte pas.
 *
 * Le repère est soit une commune (on retient son code INSEE et ses coordonnées
 * de centre), soit un point posé sur la carte. Il voyage dans l'URL (`r`).
 */
export interface Repere {
  lat: number;
  lon: number;
  nom: string;
  /** Renseigné quand le repère est une commune du référentiel. */
  codeInsee?: string;
}

export const PARAM_REPERE = "r";

export function encoderRepere(repere: Repere): string {
  return repere.codeInsee ?? `${repere.lat.toFixed(4)},${repere.lon.toFixed(4)}`;
}

/**
 * Décode `r` : un code INSEE (résolu par `communeParCode`, qui renvoie le nom et
 * le centre) ou un couple « lat,lon ». Invalide → null, jamais un repère deviné.
 */
export function decoderRepere(
  brut: string | string[] | undefined | null,
  communeParCode: (code: string) => { nom: string; lat: number; lon: number } | undefined,
): Repere | null {
  const texte = Array.isArray(brut) ? brut[0] : brut;
  if (!texte) return null;
  if (/^[0-9AB]{5}$/i.test(texte)) {
    const c = communeParCode(texte.toUpperCase());
    return c ? { lat: c.lat, lon: c.lon, nom: c.nom, codeInsee: texte.toUpperCase() } : null;
  }
  const m = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(texte);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (lat < 41 || lat > 51.5 || lon < -5.5 || lon > 10) return null;
  return { lat, lon, nom: "Point sur la carte" };
}

const RAYON_TERRE_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(a));
}

const SOURCE_REPERE: Source = {
  nom: "Distance à vol d'oiseau entre le centre de la commune et le repère choisi",
  nomCourt: "Calcul",
  producteur: "Où Vivre, d'après les centres de communes de geo.api.gouv.fr (IGN Admin Express, INSEE)",
  url: "https://geo.api.gouv.fr/",
  annee: "2025",
};

/**
 * Ajoute à chaque commune le critère « Proximité » : une mesure, la distance au
 * repère en kilomètres, arrondie à la centaine de mètres. Les communes sans
 * coordonnées n'ont pas le critère. Les objets d'origine ne sont pas modifiés.
 */
export function appliquerRepere(communes: Commune[], repere: Repere): Commune[] {
  const donneesCommunes = (valeur: number): CritereDonnees => ({
    mesures: [
      {
        id: "prox-distance",
        libelle: "Distance au repère",
        libelleCourt: "Distance",
        valeur,
        unite: "km",
        sens: "bas",
        classante: true,
        vedette: true,
        decimales: 1,
        comparatif: { mieux: "plus proche que", pire: "plus éloignée que" },
        precision: `à vol d'oiseau, depuis ${repere.nom}`,
      },
    ],
    source: SOURCE_REPERE,
    methodologie:
      "Distance orthodromique (formule de haversine, rayon terrestre de 6 371 km) entre le centre de la commune et le repère. Ce n'est ni un trajet routier ni un temps de parcours.",
    caveats: [
      "Une distance à vol d'oiseau : la route, le relief ou un fleuve peuvent allonger fortement le trajet réel.",
      "Le centre d'une grande commune peut être loin de ses quartiers périphériques.",
    ],
  });
  return communes.map((c) => {
    if (c.lat == null || c.lon == null) return c;
    const km = Math.round(distanceKm(c.lat, c.lon, repere.lat, repere.lon) * 10) / 10;
    return { ...c, criteres: { ...c.criteres, proximite: donneesCommunes(km) } };
  });
}

/** Sans repère, le curseur Proximité ne compte pas, quel que soit son réglage. */
export function poidsEffectifs(poids: Poids, repere: Repere | null): Poids {
  const effectifs = { ...poids };
  // Les critères informatifs (sans curseur) ne pèsent jamais, quoi que dise l'URL.
  for (const c of CRITERES) if (c.curseur === false) effectifs[c.id] = 0;
  if (!repere) effectifs.proximite = 0;
  return effectifs;
}
