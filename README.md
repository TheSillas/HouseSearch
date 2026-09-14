# Où Vivre

Comparateur de communes où **c'est l'utilisateur qui décide du poids de chaque critère**.
Huit curseurs de priorité — prix immobilier, sécurité, écoles, transports, emploi & revenus,
santé, commerces & services, climat —, un neuvième dans les filtres avancés pour la proximité
d'un repère que vous choisissez, et le classement se recalcule en direct, à partir de données
publiques brutes et sourcées. Fiscalité locale et risques naturels se lisent sur chaque fiche
sans peser dans le classement.
La fiche d'une commune s'ouvre sur un portrait démographique (recensement INSEE, hors
classement), puis un bloc replié par critère : un chiffre clé, sa position, et le détail
de toutes les mesures à l'ouverture.

Parti pris central : **jamais de note**. On affiche le chiffre réel avec son unité, sa
source et son millésime, puis la position de la commune parmi celles comparées
(« 3 200 €/m² — moins cher que 72 % des autres villes comparées »).

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000 (ou `npm run dev -- -p 3111` si le port est pris)
npm test             # moteur de classement et formatage
npm run build
npm start            # puis, dans un autre terminal :
npm run verifier     # contrôles en vrai navigateur, captures dans apercus/
                     # (URL de base en argument : node scripts/verifier.mjs http://localhost:3112)
```

## Structure

```
src/
  app/
    page.tsx                  accueil : curseurs + classement en direct
    ville/[slug]/page.tsx     fiche commune, rendue à la demande
    comparer/page.tsx         les communes cochées de la sélection, côte à côte (?communes=a,b,c)
    methodologie/page.tsx     sources, méthode de calcul, limites assumées
  components/
    Comparateur.tsx           état des poids, URL partageable, orchestration
    Curseurs.tsx              curseurs de priorité
    LigneClassement.tsx       une ligne du classement (animation de réordonnancement)
    BlocCritere.tsx           un critère sur la fiche commune
    HistoriquePolitique.tsx   scrutins, présentés sans commentaire
  lib/
    scoring.ts                positions relatives (O(n log n)) et classement pondéré
    regions.ts                registre des régions peuplées, une aujourd'hui
    criteres.ts               définition des onze critères
    types.ts                  modèle de domaine
data/
  raw/                        sorties brutes de l'extraction, une par critère
  sources/                    note de source vérifiée, une par critère
scripts/
  build-dataset.mjs           data/raw/<slug>/*.json  ->  data/dist/<slug>.json (compact)
  build-noyau.mjs             data/dist/*.json  ->  data/dist/noyau.json (classement, carte)
  importer-referentiel.mjs    toutes les communes d'un département (geo.api.gouv.fr)
  importer-insee.mjs          recensement, Filosofi, APL, BPE (santé, écoles)
  importer-gares.mjs          gare de voyageurs la plus proche
  importer-securite.mjs       délinquance enregistrée (SSMSI, base communale nationale)
  importer-immobilier.mjs     prix médian au m² recalculé depuis DVF (fichiers départementaux)
  importer-ecoles-depp.mjs    réussite au brevet et au bac par commune d'implantation (DEPP)
  importer-elections.mjs      municipales 2026, européennes 2024, présidentielle 2022, maires (RNE)
  importer-equipements.mjs    tous les équipements BPE et les gammes INSEE (commerces & services)
  importer-fiscalite.mjs      taux de taxe foncière par commune (DGFiP, REI)
  importer-risques.mjs        catastrophes naturelles, PPR, zone sismique, radon (Géorisques)
  importer-climat.mjs         normales 1991-2020 de la station la plus proche (Météo-France)
  verifier.mjs                contrôles de bout en bout dans un vrai navigateur
docs/
  decisions.md                zone testée, source des transports, fréquence de mise à jour
```

## Données

Le jeu de données est **figé à la compilation** et couvre les 34 746 communes de France
métropolitaine. Deux formes, toutes deux produites par les scripts et lues par
`src/lib/regions.ts` :

- `data/dist/noyau.json` (+ `.gz` pré-compressé, ~1 Mo) — toutes les communes, seulement
  les mesures du classement, en colonnes. La page d'accueil s'affiche d'abord avec un
  aperçu calculé par le serveur (`src/lib/apercu.ts`), puis le navigateur charge le noyau
  une fois pour toutes (URL portant son empreinte, cache immuable) : le classement se
  recalcule ensuite en mémoire, aucun appel réseau quand un curseur bouge.
- `data/dist/<slug>.json` — le jeu complet d'un département (toutes les mesures,
  précisions, sources, historiques, scrutins), au format compact dilaté par
  `src/lib/jeu-compact.ts`, lu à la demande quand une fiche s'ouvre.

Une commune n'est classée que si elle est renseignée sur les critères activés (voir
`src/lib/couverture.ts`) ; les autres restent sur la carte et consultables.

Pour régénérer après une nouvelle livraison des producteurs :

```bash
npm run donnees -- <slug>   # relit data/raw/<slug>/*.json et réécrit data/dist/<slug>.json
node scripts/build-noyau.mjs   # puis le noyau national
```

Chaque valeur porte sa source et son millésime, et une valeur absente reste absente :
elle n'est jamais remplacée par une moyenne ni par une estimation. Voir
`data/sources/*.md` pour les notes de source vérifiées, et `/methodologie` dans
l'application pour la version destinée aux utilisateurs.

## Méthode de classement

Pour chaque mesure, on compte **combien des autres communes comparées celle-ci
devance** — et c'est ce décompte, pas autre chose, qui produit la phrase affichée. Quand
beaucoup de communes partagent la même valeur, la part à égalité est annoncée à côté :
une commune sans gare n'est pas « devancée par 74 % » des autres, elle est à égalité
avec la moitié d'entre elles.

Pour *trier*, en revanche, les ex æquo comptent pour une demi-victoire de part et
d'autre, sans quoi une valeur très répandue écraserait le classement. Ce rang milieu
sert au tri et à la longueur des barres ; il n'est jamais converti en affirmation.

Un critère porté par plusieurs mesures prend la moyenne simple des positions de ses
mesures classantes — et l'interface le dit explicitement, il n'y a pas de composite
caché.

Le rang final est la moyenne de ces positions pondérée par les curseurs. Ce nombre sert
uniquement à trier ; il n'est jamais affiché comme une note. Quand une donnée manque, le
critère est retiré du numérateur *et* du dénominateur pour cette commune, et l'omission
est signalée sur sa ligne.

À l'échelle nationale, cette règle ne suffit pas : une commune non renseignée sur un
critère que vous avez activé n'est pas classée du tout (voir `src/lib/couverture.ts`),
sauf tolérance choisie dans les filtres avancés. Elle reste sur la carte, grisée, et sa
fiche reste consultable.
