"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";

import { BandeauSelection } from "./BandeauSelection";
import { Curseurs } from "./Curseurs";
import { FiltresAvances } from "./FiltresAvances";
import { LigneResultat } from "./LigneResultat";
import { PhotosCommune } from "./PhotosCommune";
import { RechercheCommune } from "./RechercheCommune";
import { CRITERE_PAR_ID, POIDS_PAR_DEFAUT } from "@/lib/criteres";
import {
  appliquerFiltres,
  calculerBornes,
  encoderFiltres,
  estFiltresVides,
  filtresActifs,
  PARAM_FILTRES,
  type Filtres,
} from "@/lib/filtres";
import {
  appliquerFiltreDepartements,
  departementsDisponibles,
  encoderDepartements,
  PARAM_DEPARTEMENTS,
  type FiltreDepartements,
} from "@/lib/localisation";
import { encoderPoids, estParDefaut, PARAM_POIDS } from "@/lib/poids";
import {
  aucunePriorite,
  classer,
  construireReferentiel,
  positionsDeScore,
  scoresSeuls,
  type Poids,
  type Referentiel,
} from "@/lib/scoring";
import { communesDepuisNoyau, type Noyau } from "@/lib/noyau";
import { PAGE_CLASSEMENT, type Apercu } from "@/lib/apercu";
import { appliquerRepere, encoderRepere, PARAM_REPERE, poidsEffectifs, type Repere as ReperePoint } from "@/lib/repere";
import {
  appliquerCouverture,
  TOLERANCE_PAR_DEFAUT,
  encoderCouverture,
  PARAM_COUVERTURE,
} from "@/lib/couverture";

interface ReglagesUrl {
  poids: Poids;
  filtres: Filtres;
  departements: FiltreDepartements;
  couverture: number;
  repere: ReperePoint | null;
}
import type { Commune, CritereId } from "@/lib/types";

/**
 * MapLibre s'appuie sur WebGL et le DOM : chargée dynamiquement, sans rendu
 * serveur, pour ne jamais s'exécuter côté Node pendant le rendu initial.
 */
const CarteFrance = dynamic(() => import("./CarteFrance").then((m) => m.CarteFrance), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-doux" />,
});

/** Laisse le temps de relâcher un curseur avant d'écrire dans l'URL. */
const DELAI_URL = 350;

/**
 * À l'échelle nationale (plusieurs milliers de communes), afficher — et
 * animer à chaque réordonnancement — la totalité du classement d'un coup
 * serait à la fois illisible et coûteux. On n'affiche donc d'abord que les
 * meilleures, avec un moyen explicite d'en voir plus : jamais une troncature
 * silencieuse, toujours un chiffre exact de ce qui reste.
 */

/** Communes signalées par un badge numéroté sur la carte dézoomée. */
export const NB_MEILLEURES = 15;

/**
 * Le référentiel de positions d'un jeu de communes donné, calculé une seule
 * fois par jeu : `useMemo` ne survit pas d'une requête à l'autre côté serveur,
 * et recalculer 34 746 × 16 positions à chaque rendu de la page coûtait plus
 * d'une seconde par visiteur. Le jeu de communes est lui-même mémorisé sur le
 * noyau (voir noyau.ts), donc la clé est stable.
 */
const MEMO_REFERENTIELS = new WeakMap<Commune[], Referentiel>();
function referentielMemorise(communes: Commune[]): Referentiel {
  let ref = MEMO_REFERENTIELS.get(communes);
  if (!ref) {
    ref = construireReferentiel(communes);
    MEMO_REFERENTIELS.set(communes, ref);
  }
  return ref;
}

/**
 * Les N meilleures communes sans trier toute la liste : à 34 746 communes, un
 * tri complet à chaque tick de curseur coûte plus que le calcul des scores.
 * Insertion dans un tableau court, départage alphabétique comme `classer`.
 */
function selectionnerMeilleures(communes: Commune[], scores: Map<string, number>, n: number): Commune[] {
  const tete: { c: Commune; s: number }[] = [];
  const avant = (a: { c: Commune; s: number }, b: { c: Commune; s: number }) =>
    a.s > b.s || (a.s === b.s && a.c.nom.localeCompare(b.c.nom, "fr") < 0);
  for (const c of communes) {
    const e = { c, s: scores.get(c.codeInsee) ?? 0 };
    if (tete.length === n && !avant(e, tete[n - 1])) continue;
    let i = tete.length;
    while (i > 0 && avant(e, tete[i - 1])) i -= 1;
    tete.splice(i, 0, e);
    if (tete.length > n) tete.pop();
  }
  return tete.map((e) => e.c);
}

export interface SourceResumee {
  critere: CritereId;
  libelle: string;
  annee: string;
}

/**
 * L'application tient dans l'écran : la carte d'un côté, un panneau de
 * l'autre — priorités en tête, classement en dessous, sources en pied. Rien
 * ne défile hors des listes. Sur téléphone, la carte prend le haut de l'écran
 * et le panneau défile en dessous.
 *
 * Deux flux distincts alimentent l'écran (voir Curseurs.tsx) :
 *  - la valeur *commise* d'un curseur (au relâchement) recalcule le classement
 *    de la liste ;
 *  - la valeur *en direct* (à chaque tick) ne recolore que la carte et
 *    déplace les badges des meilleures communes — sans toucher au DOM de la
 *    liste, donc sans jamais bloquer le glissement.
 */
export function Comparateur({
  apercu,
  noyauUrl,
  sources,
  poidsInitiaux,
  filtresInitiaux,
  departementsInitiaux,
  couvertureInitiale,
  repereInitial,
}: {
  /** Le classement demandé, déjà calculé côté serveur : ce qui s'affiche avant l'arrivée du noyau. */
  apercu: Apercu;
  /** Le noyau national (voir noyau.ts), chargé à côté et mis en cache sans limite. */
  noyauUrl: string;
  sources: SourceResumee[];
  /** Poids et filtres décodés depuis l'URL au rendu : serveur et client partent du même état. */
  poidsInitiaux: Poids;
  filtresInitiaux: Filtres;
  departementsInitiaux: FiltreDepartements;
  /** Critères activés manquants tolérés pour rester classée (voir couverture.ts). */
  couvertureInitiale: number;
  /** Le repère personnel décodé de l'URL, s'il y en a un (voir repere.ts). */
  repereInitial: ReperePoint | null;
}) {
  // Le noyau arrive après le premier rendu (1 Mo compressé, une fois par
  // navigateur puis en cache) : d'ici là, l'écran montre l'aperçu calculé par le
  // serveur — les mêmes lignes, les mêmes barres — et les réglages attendent.
  const [noyau, setNoyau] = useState<Noyau | null>(null);
  const [erreurNoyau, setErreurNoyau] = useState(false);
  useEffect(() => {
    let annule = false;
    fetch(noyauUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Noyau>;
      })
      .then((n) => {
        if (!annule) setNoyau(n);
      })
      .catch(() => {
        if (!annule) setErreurNoyau(true);
      });
    return () => {
      annule = true;
    };
  }, [noyauUrl]);
  const communesApercu = useMemo(() => apercu.lignes.map((l) => l.commune), [apercu]);
  const communesBase = useMemo(() => (noyau ? communesDepuisNoyau(noyau) : communesApercu), [noyau, communesApercu]);
  // Le repère personnel ajoute à chaque commune le critère Proximité (distance au
  // repère) ; tout l'aval — référentiel, bornes, classement, carte — travaille sur
  // ce jeu augmenté. L'aperçu du serveur a déjà appliqué le même repère.
  const [repere, setRepere] = useState<ReperePoint | null>(repereInitial);
  const [placement, setPlacement] = useState(false);
  const communes = useMemo(
    () => (repere && noyau ? appliquerRepere(communesBase, repere) : communesBase),
    [communesBase, repere, noyau],
  );
  const nbCommunes = noyau ? communes.length : apercu.nbCommunes;
  const [poids, setPoids] = useState<Poids>(poidsInitiaux);
  // Reflète chaque tick de glissement, sans attendre le relâchement : c'est ce
  // qui fait vivre la carte en continu pendant que la liste, elle, n'est
  // recalculée qu'à la valeur commise de `poids`.
  const [poidsEnDirect, setPoidsEnDirect] = useState<Poids>(poidsInitiaux);
  const [filtres, setFiltres] = useState<Filtres>(filtresInitiaux);
  const [departements, setDepartements] = useState<FiltreDepartements>(departementsInitiaux);
  const [couvertureMin, setCouvertureMin] = useState(couvertureInitiale);
  // Sans repère, le curseur Proximité ne compte pas, quel que soit son réglage.
  const poidsEff = useMemo(() => poidsEffectifs(poids, repere), [poids, repere]);
  // Figé au montage : un lien partagé avec un filtre déjà réglé ouvre le
  // panneau, mais un reset ultérieur ne doit pas le refermer sous l'utilisateur.
  const [ouvertParDefaut] = useState(
    () => !estFiltresVides(filtresInitiaux) || departementsInitiaux.length > 0,
  );
  const [limiteAffichage, setLimiteAffichage] = useState(PAGE_CLASSEMENT);
  const [pretAAnimer, setPretAAnimer] = useState(false);
  // Liaison liste → carte : la commune survolée dans la liste, et la dernière
  // commune qu'on a demandé à voir (compteur pour redemander la même).
  const [survolee, setSurvolee] = useState<string | null>(null);
  const [cible, setCible] = useState<{ codeInsee: string; n: number } | null>(null);
  const reduitLesAnimations = useReducedMotion();
  const minuterieUrl = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enAttente = useRef<ReglagesUrl | null>(
    null,
  );

  // Le référentiel de positions se calcule sur TOUTES les communes, filtres ou
  // non — localisation comprise : les phrases comparatives (« devance 72 % des
  // autres villes ») restent ainsi calibrées sur le même jeu de test quel que
  // soit le filtrage en cours, conformément à /methodologie. Filtrer ne change
  // QUI est classé, jamais contre quoi une commune est comparée.
  const referentiel = useMemo(
    () => (noyau ? referentielMemorise(communes) : apercu.referentiel),
    [noyau, communes, apercu],
  );
  const bornesFiltres = useMemo(() => (noyau ? calculerBornes(communes) : apercu.bornes), [noyau, communes, apercu]);
  const departementsOptions = useMemo(
    () => (noyau ? departementsDisponibles(communes) : apercu.departements),
    [noyau, communes, apercu],
  );

  const communesLocalisees = useMemo(
    () => (noyau ? appliquerFiltreDepartements(communes, departements) : communes),
    [noyau, communes, departements],
  );
  const horsLocalisation = noyau ? communes.length - communesLocalisees.length : apercu.exclues.horsLocalisation;

  // Couverture : une commune non renseignée sur un critère activé n'est pas
  // classée. Elle reste sur la carte (grisée) et consultable ; jamais cachée.
  // Dépend des poids commis, pas des ticks en direct : la liste ne bouge qu'au
  // relâchement du curseur.
  const { communes: communesCouvertes, ecartees: sousCouverture } = useMemo(
    () =>
      noyau
        ? appliquerCouverture(communesLocalisees, referentiel, poidsEff, couvertureMin)
        : { communes: communesLocalisees, ecartees: apercu.exclues.sousCouverture },
    [noyau, communesLocalisees, referentiel, poidsEff, couvertureMin, apercu],
  );

  const { communes: communesFiltrees, sansDonnee, horsPlage } = useMemo(
    () =>
      noyau
        ? appliquerFiltres(communesCouvertes, filtres, bornesFiltres)
        : { communes: communesCouvertes, sansDonnee: apercu.exclues.sansDonnee, horsPlage: apercu.exclues.horsPlage },
    [noyau, communesCouvertes, filtres, bornesFiltres, apercu],
  );
  const nbClassees = noyau ? communesFiltrees.length : apercu.nbClassees;

  // Recalculé en mémoire, sans aller-retour réseau — mais seulement à la
  // valeur commise d'un curseur (voir Curseurs.tsx), jamais à chaque pixel
  // glissé : à l'échelle nationale, refaire ce calcul et rejouer l'animation
  // du classement cent fois par seconde pendant un glissement serait
  // perceptible.
  const classement = useMemo(
    () => (noyau ? classer(communesFiltrees, referentiel, poidsEff) : apercu.lignes),
    [noyau, communesFiltrees, referentiel, poidsEff, apercu],
  );

  // Un nouveau contexte de filtrage repart sur les meilleures communes,
  // jamais sur un « afficher plus » hérité d'un filtre précédent.
  useEffect(() => {
    setLimiteAffichage(PAGE_CLASSEMENT);
  }, [communesFiltrees]);

  // La valeur en direct repart de la valeur commise chaque fois que celle-ci
  // change pour une raison qui n'est pas un glissement en cours (relâchement,
  // réinitialisation, lien partagé) : les deux ne doivent diverger que
  // pendant un glissement actif.
  useEffect(() => {
    setPoidsEnDirect(poids);
  }, [poids]);

  // Ce que la carte montre en direct : la position relative de chaque commune
  // (sa couleur) et les quelques meilleures sous les filtres en cours (ses
  // badges). `scoresSeuls` plutôt que `classer` : ni rang ni tri n'est
  // nécessaire sur l'ensemble, seulement une valeur — puis `positionsDeScore`
  // étale ces valeurs sur tout [0, 1] avant de colorer, sans quoi la carte
  // resterait quasi monochrome (un score moyenné se resserre presque toujours
  // vers le centre, voir scoring.ts). Ces tris ont un coût réel sur 5 000+
  // communes : jamais plus d'une fois par image, sur la dernière valeur
  // demandée — même principe que le lissage de CarteFrance pour
  // `setFeatureState`, un cran plus tôt dans le calcul.
  const [scoresCarte, setScoresCarte] = useState<Map<string, number>>(() =>
    positionsDeScore(scoresSeuls(communes, referentiel, poidsEffectifs(poidsEnDirect, repere))),
  );
  const [meilleures, setMeilleures] = useState<Commune[]>([]);
  const poidsEnDirectRef = useRef(poidsEnDirect);
  poidsEnDirectRef.current = poidsEnDirect;
  const repereRef = useRef(repere);
  repereRef.current = repere;
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const p = poidsEffectifs(poidsEnDirectRef.current, repereRef.current);
      const bruts = scoresSeuls(communes, referentiel, p);
      setScoresCarte(positionsDeScore(bruts));
      if (aucunePriorite(p)) {
        setMeilleures([]);
        return;
      }
      // Même départage que `classer` (score, puis ordre alphabétique) : au
      // repos, le badge n° 3 sur la carte est bien la 3e ligne de la liste.
      setMeilleures(selectionnerMeilleures(communesFiltrees, bruts, NB_MEILLEURES));
    });
    return () => cancelAnimationFrame(id);
  }, [poidsEnDirect, repere, communes, referentiel, communesFiltrees]);

  const excluesCarte = useMemo(() => {
    const inclus = new Set(communesFiltrees.map((c) => c.codeInsee));
    const set = new Set<string>();
    for (const c of communes) if (!inclus.has(c.codeInsee)) set.add(c.codeInsee);
    return set;
  }, [communes, communesFiltrees]);

  // L'animation de réordonnancement ne doit pas se déclencher au premier rendu,
  // sinon les lignes glissent depuis leur position d'hydratation.
  useEffect(() => {
    const id = requestAnimationFrame(() => setPretAAnimer(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const ecrireUrl = useCallback(
    (valeurs: ReglagesUrl) => {
      const url = new URL(window.location.href);
      if (valeurs.repere) url.searchParams.set(PARAM_REPERE, encoderRepere(valeurs.repere));
      else url.searchParams.delete(PARAM_REPERE);
      if (valeurs.couverture === TOLERANCE_PAR_DEFAUT) url.searchParams.delete(PARAM_COUVERTURE);
      else url.searchParams.set(PARAM_COUVERTURE, encoderCouverture(valeurs.couverture));
      if (estParDefaut(valeurs.poids)) url.searchParams.delete(PARAM_POIDS);
      else url.searchParams.set(PARAM_POIDS, encoderPoids(valeurs.poids));
      if (estFiltresVides(valeurs.filtres)) url.searchParams.delete(PARAM_FILTRES);
      else url.searchParams.set(PARAM_FILTRES, encoderFiltres(valeurs.filtres));
      if (valeurs.departements.length === 0) url.searchParams.delete(PARAM_DEPARTEMENTS);
      else url.searchParams.set(PARAM_DEPARTEMENTS, encoderDepartements(valeurs.departements));
      window.history.replaceState(null, "", url);
      enAttente.current = null;
    },
    [],
  );

  // L'URL suit les curseurs et les filtres pour que le réglage soit
  // partageable, sans entrée d'historique à chaque pixel parcouru. Le dernier
  // réglage est écrit même si le composant est démonté avant la fin du délai.
  useEffect(() => {
    return () => {
      if (minuterieUrl.current) clearTimeout(minuterieUrl.current);
      if (enAttente.current) ecrireUrl(enAttente.current);
    };
  }, [ecrireUrl]);

  const programmerEcriture = useCallback(
    (valeurs: ReglagesUrl) => {
      enAttente.current = valeurs;
      if (minuterieUrl.current) clearTimeout(minuterieUrl.current);
      minuterieUrl.current = setTimeout(() => ecrireUrl(valeurs), DELAI_URL);
    },
    [ecrireUrl],
  );

  const modifierPoids = useCallback(
    (critere: CritereId, valeur: number) => {
      setPoids((actuel) => {
        const suivant = { ...actuel, [critere]: valeur };
        programmerEcriture({ poids: suivant, filtres, departements, couverture: couvertureMin, repere });
        return suivant;
      });
    },
    [filtres, departements, couvertureMin, repere, programmerEcriture],
  );

  const reinitialiserPoids = useCallback(() => {
    setPoids(POIDS_PAR_DEFAUT);
    programmerEcriture({ poids: POIDS_PAR_DEFAUT, filtres, departements, couverture: couvertureMin, repere });
  }, [filtres, departements, couvertureMin, repere, programmerEcriture]);

  const modifierPoidsEnDirect = useCallback((critere: CritereId, valeur: number) => {
    setPoidsEnDirect((actuel) => ({ ...actuel, [critere]: valeur }));
  }, []);

  const modifierFiltre = useCallback(
    (critere: CritereId, valeur: { min: number; max: number }) => {
      setFiltres((actuel) => {
        const borne = bornesFiltres[critere];
        // Revenu à la plage complète : on retire l'entrée plutôt que de garder
        // un filtre qui ne filtre plus rien, pour que « Réinitialiser » et
        // l'URL reflètent fidèlement qu'aucun filtre n'est actif.
        const suivant = { ...actuel };
        if (borne && valeur.min <= borne.min && valeur.max >= borne.max) {
          delete suivant[critere];
        } else {
          suivant[critere] = valeur;
        }
        programmerEcriture({ poids, filtres: suivant, departements, couverture: couvertureMin, repere });
        return suivant;
      });
    },
    [poids, departements, bornesFiltres, couvertureMin, repere, programmerEcriture],
  );

  const modifierDepartements = useCallback(
    (suivant: FiltreDepartements) => {
      setDepartements(suivant);
      programmerEcriture({ poids, filtres, departements: suivant, couverture: couvertureMin, repere });
    },
    [poids, filtres, couvertureMin, repere, programmerEcriture],
  );

  const modifierCouverture = useCallback(
    (suivant: number) => {
      setCouvertureMin(suivant);
      programmerEcriture({ poids, filtres, departements, couverture: suivant, repere });
    },
    [poids, filtres, departements, repere, programmerEcriture],
  );

  const communeBaseParCode = useMemo(() => new Map(communesBase.map((c) => [c.codeInsee, c])), [communesBase]);
  const definirRepere = useCallback(
    (suivant: ReperePoint | null) => {
      setRepere(suivant);
      setPlacement(false);
      programmerEcriture({ poids, filtres, departements, couverture: couvertureMin, repere: suivant });
    },
    [poids, filtres, departements, couvertureMin, programmerEcriture],
  );
  const choisirRepereCommune = useCallback(
    (codeInsee: string) => {
      const c = communeBaseParCode.get(codeInsee);
      if (c && c.lat != null && c.lon != null) definirRepere({ lat: c.lat, lon: c.lon, nom: c.nom, codeInsee: c.codeInsee });
    },
    [communeBaseParCode, definirRepere],
  );
  // Rappels stables pour le panneau des filtres, mémoïsé : une fonction
  // fléchée inline le re-rendrait à chaque tick de curseur.
  const demanderPlacement = useCallback(() => setPlacement((p) => !p), []);
  const retirerRepere = useCallback(() => definirRepere(null), [definirRepere]);
  const commettreProximite = useCallback((valeur: number) => modifierPoids("proximite", valeur), [modifierPoids]);
  const glisserProximite = useCallback((valeur: number) => modifierPoidsEnDirect("proximite", valeur), [modifierPoidsEnDirect]);
  const placerRepere = useCallback(
    (lat: number, lon: number) => definirRepere({ lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, nom: "Point sur la carte" }),
    [definirRepere],
  );

  const reinitialiserFiltres = useCallback(() => {
    setFiltres({});
    setDepartements([]);
    setCouvertureMin(TOLERANCE_PAR_DEFAUT);
    programmerEcriture({ poids, filtres: {}, departements: [], couverture: TOLERANCE_PAR_DEFAUT, repere });
  }, [poids, repere, programmerEcriture]);

  const basculerDepartementCarte = useCallback(
    (code: string) => {
      modifierDepartements(
        departements.includes(code)
          ? departements.filter((d) => d !== code)
          : [...departements, code],
      );
    },
    [departements, modifierDepartements],
  );

  const ciblerCommune = useCallback((codeInsee: string) => {
    setCible((precedente) => ({ codeInsee, n: (precedente?.n ?? 0) + 1 }));
  }, []);

  // Une fiche ouverte depuis la carte vit à l'adresse /ville/<slug> (route
  // interceptée, rendue en volet par-dessus le panneau) : c'est l'adresse qui
  // dit quelle commune est ouverte, et la carte la suit — elle vole dessus et
  // la met en évidence, que l'ouverture vienne d'un point, d'un badge, d'une
  // ligne de la liste ou du bouton « suivant » du navigateur.
  const pathname = usePathname();
  const router = useRouter();
  const communeParSlug = useMemo(() => new Map(communes.map((c) => [c.slug, c])), [communes]);
  const communeParCode = useMemo(() => new Map(communes.map((c) => [c.codeInsee, c])), [communes]);
  // Ouvrir une commune = aller à son adresse : le volet, la carte et les photos
  // suivent tous l'adresse (voir ci-dessous), jamais un état parallèle.
  const ouvrirCommune = useCallback(
    (codeInsee: string) => {
      const commune = communeParCode.get(codeInsee);
      if (commune) router.push(`/ville/${commune.slug}`, { scroll: false });
    },
    [communeParCode, router],
  );
  const communeOuverte = useMemo(() => {
    const correspondance = pathname.match(/^\/ville\/([^/]+)$/);
    return correspondance ? communeParSlug.get(decodeURIComponent(correspondance[1])) : undefined;
  }, [pathname, communeParSlug]);
  useEffect(() => {
    if (communeOuverte) ciblerCommune(communeOuverte.codeInsee);
  }, [communeOuverte, ciblerCommune]);

  const modifie = useMemo(() => !estParDefaut(poids), [poids]);
  const nbFiltresActifs = useMemo(
    () =>
      filtresActifs(filtres, bornesFiltres).length +
      (departements.length > 0 ? 1 : 0) +
      (couvertureMin !== TOLERANCE_PAR_DEFAUT ? 1 : 0),
    [filtres, bornesFiltres, departements, couvertureMin],
  );
  const filtresModifies = nbFiltresActifs > 0;
  const neutre = aucunePriorite(poids);
  const anime = pretAAnimer && !reduitLesAnimations;
  const exclues = horsLocalisation + sousCouverture + sansDonnee + horsPlage;

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row-reverse">
      {/* ------------------------------------------------------------ Carte */}
      {/* `isolate` : les marqueurs MapLibre portent des z-index élevés ; sans
          contexte d'empilement propre à la carte, ils passeraient par-dessus
          le volet de fiche (voir FicheFlottante) sur téléphone. */}
      <section className="relative isolate h-[38dvh] shrink-0 border-b border-trait lg:h-full lg:min-w-0 lg:flex-1 lg:border-b-0">
        <p className="sr-only">
          Carte de France : chaque département est coloré selon la position moyenne de ses
          communes, les {NB_MEILLEURES} meilleures communes sont signalées par un badge numéroté.
          Le classement complet est dans le panneau.
        </p>
        {/* La carte reçoit le jeu de base, sans le critère Proximité : elle se
            reconstruit entièrement quand l'identité du tableau change, or le
            repère ne déplace aucune commune. Scores et exclusions suivent à
            part, par diff. */}
        <CarteFrance
          communes={communesBase}
          scores={scoresCarte}
          exclues={excluesCarte}
          meilleures={meilleures}
          survolee={survolee}
          cible={cible}
          departementsSelectionnes={departements}
          onToggleDepartement={basculerDepartementCarte}
          repere={repere}
          placement={placement}
          onPlacer={placerRepere}
        />

        <div className="absolute left-3 top-3 z-10 w-[min(320px,calc(100%-72px))]">
          <RechercheCommune communes={communesBase} onChoisir={ouvrirCommune} />
        </div>

        {/* Une commune ouverte : ses photos par-dessus la carte, à côté de son
            repère (sur téléphone, le volet couvre la carte : elles y sont
            reprises en tête, voir FicheFlottante). */}
        {communeOuverte && (
          <div className="absolute bottom-3 left-3 right-3 z-10 hidden lg:right-[308px] lg:block">
            <PhotosCommune
              key={communeOuverte.codeInsee}
              codeInsee={communeOuverte.codeInsee}
              nom={communeOuverte.nom}
            />
          </div>
        )}

        {/* Légende : ce que disent les couleurs et les badges, en un souffle. */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden w-[280px] rounded-xl border border-trait bg-carte/90 px-3 py-2 text-[11.5px] leading-snug backdrop-blur sm:block">
          {neutre ? (
            <p className="text-texte-doux">
              Montez un curseur pour colorer la carte selon vos priorités.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-texte-faible">Moins adapté</span>
              <span
                aria-hidden="true"
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, var(--accent-doux), var(--accent), var(--accent-fort))",
                }}
              />
              <span className="text-texte-faible">Plus adapté</span>
            </div>
          )}
          <p className="mt-1 text-texte-faible">
            Un département : la moyenne de ses communes. Badges : les {NB_MEILLEURES} meilleures.
            Cliquez un département pour l&apos;explorer.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- Panneau */}
      <aside className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-carte lg:h-full lg:w-[400px] lg:flex-none lg:border-r lg:border-trait xl:w-[440px]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-trait px-4 py-2.5">
          <div className="min-w-0">
            <Link href="/" className="text-[17px] font-semibold tracking-tight">
              Où Vivre
            </Link>
            <h1 className="truncate text-[12.5px] leading-tight text-texte-doux">
              Quelle ville vous correspond&nbsp;?{" "}
              <span className="text-texte-faible">
                · <span className="chiffres">{nbCommunes.toLocaleString("fr-FR")}</span>{" "}
                communes
              </span>
            </h1>
          </div>
          <Link
            href="/methodologie"
            className="shrink-0 rounded-full border border-trait px-3 py-2 text-[12.5px] text-texte-doux transition-colors hover:border-trait-fort hover:text-texte"
          >
            Sources
          </Link>
        </header>

        {/* Le panneau défile d'un seul bloc, en-tête, curseurs, filtres et
            classement compris : deux zones de défilement imbriquées rendaient
            l'usage confus. Les curseurs tiennent sur deux colonnes pour
            laisser le classement visible dès l'ouverture. */}
        <div
          className={`shrink-0 transition-opacity ${noyau ? "" : "pointer-events-none opacity-60"}`}
          aria-busy={!noyau}
        >
          <Curseurs
            poids={poids}
            onCommit={modifierPoids}
            onLiveChange={modifierPoidsEnDirect}
            onReinitialiser={reinitialiserPoids}
            modifie={modifie}
          />
        </div>

        {!noyau && (
          <p className="px-4 pb-1 text-[12px] text-texte-faible" role="status">
            {erreurNoyau
              ? "Le jeu de données complet n'a pas pu être chargé : le classement affiché est celui du serveur, les réglages sont inactifs."
              : `Chargement des ${apercu.nbCommunes.toLocaleString("fr-FR")} communes…`}
          </p>
        )}
        <div className={`relative ${noyau ? "" : "pointer-events-none opacity-60"}`} aria-busy={!noyau}>
          <div className="px-4">
            <FiltresAvances
              departements={departementsOptions}
              departementsSelectionnes={departements}
              onChangeDepartements={modifierDepartements}
              bornes={bornesFiltres}
              filtres={filtres}
              onChangeFiltre={modifierFiltre}
              onReinitialiser={reinitialiserFiltres}
              nbActifs={nbFiltresActifs}
              ouvertParDefaut={ouvertParDefaut}
              couvertureMin={couvertureMin}
              onChangeCouverture={modifierCouverture}
              sousCouverture={sousCouverture}
              repere={repere}
              communesRepere={communesBase}
              placement={placement}
              onChoisirRepereCommune={choisirRepereCommune}
              onDemanderPlacement={demanderPlacement}
              onRetirerRepere={retirerRepere}
              poidsProximite={poids.proximite ?? 0}
              onCommitProximite={commettreProximite}
              onLiveChangeProximite={glisserProximite}
            />
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-baseline justify-between gap-4 border-t border-trait pt-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
                {neutre ? "Communes comparées" : "Classement"}
              </h2>
              {/* Le lien vit ici, au contact des chiffres : le panneau en
                  affiche plus de cent, aucun ne doit être orphelin de sa
                  provenance. */}
              <a
                href="#sources"
                className="text-[12px] text-texte-faible underline decoration-trait-fort underline-offset-2 transition-colors hover:text-accent"
              >
                {neutre ? "ordre alphabétique" : "sources et millésimes"}
              </a>
            </div>

            {filtresModifies && (
              <p className="mt-2 text-[12.5px] text-texte-faible">
                <span className="chiffres">{nbClassees}</span> commune
                {nbClassees > 1 ? "s" : ""} sur {nbCommunes} correspond
                {nbClassees > 1 ? "ent" : ""} à vos filtres
                {exclues > 0 && (
                  <>
                    {" "}
                    (<span className="chiffres">{exclues}</span> exclue{exclues > 1 ? "s" : ""}
                    {sousCouverture > 0 ? `, dont ${sousCouverture} trop peu renseignée${sousCouverture > 1 ? "s" : ""}` : ""}
                    {sansDonnee > 0 ? `, ${sansDonnee} sans donnée sur un filtre` : ""})
                  </>
                )}
                .
              </p>
            )}

            {/* Le réordonnancement est visuel : sans cela, rien ne signale à un
                lecteur d'écran que le classement a changé. « polite » laisse
                les annonces se fondre les unes dans les autres pendant qu'un
                curseur bouge. */}
            <p aria-live="polite" className="sr-only">
              {classement.length === 0
                ? "Aucune commune ne correspond aux filtres actifs."
                : neutre
                  ? "Aucune priorité réglée : les communes sont listées par ordre alphabétique, sans rang."
                  : `Classement mis à jour. En tête : ${classement[0].commune.nom}, devant ${classement
                      .slice(1, 3)
                      .map((l) => l.commune.nom)
                      .join(" et ")}.`}
            </p>

            {neutre && classement.length > 0 && (
              <p className="mt-3 rounded-xl border border-trait bg-doux px-3.5 py-2.5 text-[13px] leading-relaxed text-texte-doux">
                Montez un curseur pour classer les communes selon vos priorités. En attendant,
                elles sont listées par ordre alphabétique.
              </p>
            )}

            {classement.length === 0 && (
              <p className="mt-3 rounded-xl border border-trait bg-doux px-3.5 py-2.5 text-[13px] leading-relaxed text-texte-doux">
                Aucune commune ne correspond aux filtres actifs. Élargissez une plage pour en voir
                apparaître.
              </p>
            )}

            <ul className="mt-3 flex flex-col gap-2">
              {classement.slice(0, limiteAffichage).map((ligne) => (
                <LigneResultat
                  key={ligne.commune.codeInsee}
                  ligne={ligne}
                  referentiel={referentiel}
                  poids={poids}
                  anime={anime}
                  classe={!neutre}
                  onSurvol={setSurvolee}
                  onCibler={ciblerCommune}
                />
              ))}
            </ul>

            {noyau && classement.length > limiteAffichage && (
              <button
                type="button"
                onClick={() => setLimiteAffichage((n) => n + PAGE_CLASSEMENT)}
                className="mt-3 w-full rounded-xl border border-trait bg-doux px-4 py-2.5 text-[13px] font-medium text-texte-doux transition-colors hover:border-trait-fort hover:text-texte"
              >
                Afficher {Math.min(PAGE_CLASSEMENT, classement.length - limiteAffichage)} communes
                de plus
                <span className="chiffres text-texte-faible">
                  {" "}
                  · {classement.length - limiteAffichage} restantes
                </span>
              </button>
            )}

            {sources.length > 0 && (
              <details id="sources" className="group mt-5 scroll-mt-4 border-t border-trait pt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 marker:content-none">
                  <svg
                    className="h-3 w-3 shrink-0 text-texte-faible transition-transform group-open:rotate-90"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m4.5 2.5 3 3.5-3 3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-texte-doux">
                    D&apos;où viennent ces chiffres
                  </span>
                </summary>
                <ul className="mt-2 space-y-1 text-[12px] leading-snug text-texte-faible">
                  {sources.map((s, i) => (
                    // `annee` peut être une note technique brute (URL comprise)
                    // plutôt qu'un simple millésime : sans ce point de rupture,
                    // un long token sans espace élargirait tout le panneau.
                    <li key={`${s.critere}-${i}`} className="break-words">
                      <span className="text-texte-doux">{CRITERE_PAR_ID[s.critere].libelle}</span> —{" "}
                      {s.libelle}, {s.annee}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px]">
                  <Link href="/methodologie" className="text-accent underline underline-offset-2">
                    Sources détaillées, méthode de calcul et limites
                  </Link>
                </p>
                <p className="mt-2 text-[12px] leading-snug text-texte-faible">
                  Ce comparateur ne note pas les villes : il indique la position de chacune par
                  rapport aux autres, selon les priorités que vous réglez.
                </p>
              </details>
            )}
          </div>
        </div>

        {/* « Ma sélection » : collée au bas du panneau, tant qu'elle n'est pas vide. */}
        <BandeauSelection variante="panneau" />
      </aside>
    </div>
  );
}
