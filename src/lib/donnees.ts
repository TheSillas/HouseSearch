import { communesDepuisNoyau, slugDuNoyau, type Noyau } from "./noyau";
import { chargerNoyau, chargerRegion, chargerToutesLesCommunes, regionDuDepartement } from "./regions";
import { construireReferentiel, type Referentiel } from "./scoring";
import type { Commune, CritereId, Source } from "./types";

/**
 * Point d'entrée des données pour les pages (serveur).
 *
 * Le jeu est figé à la compilation et le classement se recalcule en mémoire :
 * aucun appel réseau sur le chemin d'un curseur. À l'échelle nationale
 * (34 746 communes), deux formes coexistent :
 *
 *  - le noyau (noyau.ts) : toutes les communes, seulement les mesures du
 *    classement, en colonnes — c'est lui qui voyage vers le navigateur ;
 *  - la fiche complète d'une commune, lue dans son jeu départemental à la
 *    demande (regions.ts).
 *
 * Les positions calculées sur le noyau sont identiques à celles des fiches :
 * mêmes valeurs, mêmes communes, même décompte de mesures par critère.
 */
export function getNoyau(): Noyau {
  return chargerNoyau();
}

/** Toutes les communes, dans leur projection de classement (mesures classantes et vedettes). Mémorisé sur le noyau. */
export function getCommunes(): Commune[] {
  return communesDepuisNoyau(chargerNoyau());
}

/** Alias explicite pour la page d'accueil. */
export function getCommunesPourClassement(): Commune[] {
  return getCommunes();
}

/** Toutes les communes, complètes. Coûteux : réservé aux scripts et aux tests. */
export function getCommunesCompletes(): Commune[] {
  return chargerToutesLesCommunes();
}

/**
 * La fiche complète d'une commune, par son slug : le noyau dit dans quel
 * département la chercher, le jeu départemental fournit toutes ses mesures.
 * Le slug retenu est celui du noyau (homonymes suffixés du département).
 */
export function getCommune(slug: string): Commune | undefined {
  const noyau = chargerNoyau();
  const n = noyau.communes.codeInsee.length;
  for (let i = 0; i < n; i++) {
    if (slugDuNoyau(noyau, i) !== slug) continue;
    const region = regionDuDepartement(noyau.communes.departement[i]);
    if (!region) return undefined;
    const commune = chargerRegion(region).find((c) => c.codeInsee === noyau.communes.codeInsee[i]);
    return commune ? { ...commune, slug } : undefined;
  }
  return undefined;
}

/**
 * Le référentiel de positions, calculé une seule fois par processus : le jeu
 * est figé, le résultat aussi. Sans ce cache, chaque fiche ouverte depuis la
 * carte reclasserait toutes les communes sur toutes leurs mesures.
 */
const referentiels = new WeakMap<Commune[], Referentiel>();
export function getReferentiel(): Referentiel {
  // Clé : le jeu de communes lui-même, qui change quand le noyau est rechargé
  // (fichier modifié en dev) — un simple mémo de module survivrait au changement.
  const communes = getCommunes();
  let ref = referentiels.get(communes);
  if (!ref) {
    ref = construireReferentiel(communes);
    referentiels.set(communes, ref);
  }
  return ref;
}

/** Une entrée par région peuplée, pour la page de méthode. */
export function getZones(): { nom: string; nbCommunes: number; genereLe: string }[] {
  return chargerNoyau().zones.map((z) => ({ nom: z.zone, nbCommunes: z.nbCommunes, genereLe: z.genereLe }));
}

/**
 * Résumé des sources, une entrée par source distincte et par critère : la
 * page d'accueil affiche des dizaines de chiffres bruts, aucun sans sa
 * provenance ni son millésime.
 */
export function getSourcesResumees(): { critere: CritereId; libelle: string; annee: string }[] {
  return chargerNoyau().sources;
}

/** Sources complètes (avec URL) par critère, dédupliquées, pour la page de méthode. */
export function getSourcesParCritere(): { critere: CritereId; source: Source }[] {
  return chargerNoyau().sourcesDetail;
}

export function getSourcesElectorales(): Source[] {
  return chargerNoyau().sourcesElectorales;
}
