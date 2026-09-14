# Où Vivre — conventions du dépôt

Comparateur de communes piloté par des curseurs de priorité. Voir `README.md` pour la
structure et la méthode de classement.

## Règles non négociables

- **Jamais de note.** Aucune valeur affichée ne doit être une note abstraite (« 8/10 »).
  On montre le chiffre brut, son unité, sa source et son millésime, puis la position
  relative sous forme de phrase (« moins cher que 72 % des autres villes comparées »).
- **Une phrase qui annonce un pourcentage de communes doit reposer sur un décompte
  réel de communes.** Le rang milieu (ex æquo comptés pour une demi-victoire) sert au
  tri et à la longueur des barres, jamais à produire une affirmation : une commune sans
  gare y vaut 26 %, alors qu'elle est à égalité avec la moitié du jeu. `Position` porte
  les deux — `fraction` pour trier, `devancees` / `exAequo` pour parler.
- **Jamais de chiffre inventé.** Une donnée absente reste `null` et s'affiche comme
  absente. Pas de moyenne de secours, pas d'estimation, pas de valeur héritée d'une
  maille plus large sans que `mesure.maille` le déclare.
- **Historique électoral strictement factuel.** Libellés et nuances repris tels que le
  ministère de l'Intérieur les publie, aucune couleur politique dans l'interface, aucun
  qualificatif ajouté, aucun poids dans le classement.
- **Réactivité perçue nulle.** Le jeu de données est figé à la compilation et le
  classement se recalcule en mémoire. En développement seulement, `layout.tsx` neutralise
  `console.timeStamp` : sans cela, la journalisation des rendus de React 19 compare les
  34 746 communes propriété par propriété et fige la page une minute au choix d'un repère. Ne jamais introduire d'appel réseau sur le chemin
  d'un mouvement de curseur. À 34 746 communes, la carte se recolore par diff de
  propriétés dans le worker MapLibre (`updateData`), jamais par `setFeatureState` sur
  chaque point ; les réglages restent inertes tant que le noyau n'est pas chargé.

## Conventions de code

- Le domaine est nommé en français (`commune`, `critere`, `mesure`, `poids`) ; les API
  techniques gardent leur nom d'usage.
- `src/lib/scoring.ts` est pur et testé : toute évolution de la méthode de classement
  passe par `src/lib/scoring.test.ts` (`npm test`).
- Les identifiants de `Mesure` doivent être uniques sur l'ensemble du jeu de données ;
  `construireReferentiel` lève une erreur en cas de collision entre deux critères.
- `construireReferentiel` doit rester O(n log n) par mesure (tri + recherche
  dichotomique), jamais une comparaison de chaque commune à toutes les autres : ce
  projet vise la France entière, où O(n²) devient injouable. Toute modification de
  l'algorithme doit rester mirorée dans `scripts/artefact/moteur.mjs` (vérifié par
  `src/lib/artefact.test.ts`) et garder le test de passage à l'échelle de
  `scoring.test.ts` sous la seconde.
- Le jeu de données couvre les 34 746 communes de France métropolitaine, un jeu
  compact par département dans `data/dist/<slug>.json` (format v2, dilaté par
  `src/lib/jeu-compact.ts`) et un noyau national en colonnes `data/dist/noyau.json`
  (toutes les communes, seules les mesures du classement, voir `src/lib/noyau.ts`).
  La page d'accueil embarque un **aperçu** (`src/lib/apercu.ts` : le classement demandé
  par l'URL, calculé côté serveur avec les mêmes fonctions que le navigateur), puis le
  navigateur charge le noyau pré-compressé sous `/donnees/noyau/<empreinte>` (cache
  immuable) et prend le relais sans rien changer à l'écran. Une fiche lit son jeu
  départemental à la demande via `src/lib/regions.ts` — jamais un import direct d'un
  fichier de données ailleurs dans le code. `noyau.test.ts` et `apercu.test.ts`
  garantissent que ces formes disent la même chose.
- **Couverture** (`src/lib/couverture.ts`) : une commune n'est classée que si elle est
  renseignée sur chaque critère activé (curseur > 0), avec une tolérance de critères
  manquants réglable (0 par défaut, dans l'URL sous `c`). Les communes écartées restent
  sur la carte et consultables. Un critère absent (aucune extraction pour la commune)
  reste absent : affiché comme tel, jamais comblé.
- Un chiffre qui se décompose en postes nommés (spécialités médicales, professions de
  santé) porte `Mesure.repartition` — liste `{ libelle, effectif }` triée par effectif,
  zéros omis — rendue en liste compacte par `src/components/Repartition.tsx` (six postes
  visibles, bouton « Voir les N autres » sous la liste), jamais en phrase énumérative.
  Le miroir de l'artefact (`scripts/artefact/vue.mjs`) rend la même liste.
- **Ma sélection** (`src/lib/selection.ts`, `useSelection.ts`) : les communes étoilées depuis
  le classement, une fiche ou le volet. Une seule liste, deux états par commune (gardée ;
  « dans la comparaison »). Elle vit dans le navigateur (`localStorage`, clé
  `ou-vivre:selection`), jamais dans l'URL : c'est une liste de travail personnelle. Le
  premier rendu ne la lit pas (sélection vide côté serveur et à l'hydratation), le bandeau
  n'apparaît qu'ensuite. Six communes cochées au plus.
- **Comparaison côte à côte** (`/comparer?communes=a,b,c`, `src/lib/comparaison.ts`) : les
  communes cochées de la sélection, désignées par leur slug dans l'URL — l'adresse est la
  photographie partageable, la sélection reste locale. Sur la page, les deux sont tenues
  égales par `SynchroniserComparaison` : l'adresse aligne la sélection à l'arrivée, puis le
  bandeau réécrit l'adresse. La page vit dans le groupe `(large)` (pleine largeur). Le tableau
  (`TableauComparaison.tsx`, composant client, reçoit les positions des seules communes
  comparées) fonctionne comme les blocs de la fiche : une ligne synthétique par critère (mesure
  vedette, valeur la plus favorable en couleur pour les mesures qui ont un sens, ex æquo tous
  marqués, barre de position parmi toutes les communes du comparateur) qui se déplie sur toutes
  les mesures, précisions, mailles et répartitions comprises ; une section Vie politique (maire,
  nuance, liste en tête par scrutin, tels que publiés). Jamais un total ni une note.
- Deux couleurs d'accent au maximum : `--accent` pour l'interactif et la position,
  `--signal` réservé aux avertissements (donnée manquante, limite méthodologique).
  Elles sont définies dans `src/app/globals.css`, en clair et en sombre.

## Vérification

`npm test` couvre le moteur de classement, le formatage et la parité des formes de
données (noyau, aperçu, artefact) sur les 34 746 communes : plusieurs minutes, délais
longs assumés. `npm run verifier` lance un vrai navigateur contre l'application démarrée
(`npm run build && npm start`, URL de base en argument, `http://localhost:3111` par défaut) et contrôle
ce que le typage ne voit pas : réordonnancement sans rechargement, cible tactile des
curseurs, débordement horizontal, validité des `<dl>`, écarts d'hydratation, et
classement correct pour une URL partagée, avec ou sans repère (curseur Proximité inerte
sans repère, marqueur et commune repère en tête avec), comparaison côte à côte lisible sur
mobile. Les captures atterrissent dans `apercus/`.

## Chaîne de données

`data/raw/<region>/*.json` (extraction brute, une par critère) →
`node scripts/build-dataset.mjs <region>` → `data/dist/<region>.json` (compact) →
`node scripts/build-noyau.mjs` → `data/dist/noyau.json` (consommés par l'application via
`src/lib/regions.ts`). Les référentiels communaux viennent de `importer-referentiel.mjs`
(geo.api.gouv.fr, toutes les communes) ; `importer-insee.mjs`, `importer-gares.mjs`,
`importer-loyers.mjs`, `importer-securite.mjs` (SSMSI), `importer-immobilier.mjs` (DVF),
`importer-ecoles-depp.mjs` (résultats aux examens), `importer-elections.mjs` (ministère de
l'Intérieur, RNE), `importer-equipements.mjs` (BPE, gammes INSEE → critère Commerces &
services), `importer-fiscalite.mjs` (REI DGFiP → critère Fiscalité locale) et
`importer-risques.mjs` (Géorisques : GASPAR + API zone sismique et radon → critère Risques
naturels) et `importer-climat.mjs` (Météo-France, normales 1991-2020 par station rattachées à
la commune la plus proche, maille déclarée → critère Climat) produisent
toutes les extractions, pour toutes les communes, chacune vérifiée contre une valeur
publique connue. Onze critères : ajouter un critère touche `types.ts`, `criteres.ts`, le
miroir `scripts/artefact/moteur.mjs`, `build-noyau.mjs` (ordre), `build-dataset.mjs`, la
liste des curseurs de `scripts/verifier.mjs` et les poids des tests. Un critère peut être
**informatif** (`curseur: false` dans `criteres.ts` : Fiscalité locale, Risques naturels) : il
se lit sur la fiche et dans la comparaison, mais n'a ni curseur ni plage et son poids est
forcé à zéro (`decoderPoids`, `poidsEffectifs`) même si un ancien lien lui en donnait un.
Les curseurs du panneau « Vos priorités » sont `CRITERES_PRIORITES` ; Proximité (`avance:
true`) vit dans les filtres avancés avec le choix du repère.
- **Repère personnel** (`src/lib/repere.ts`) : le neuvième critère, Proximité, n'existe pas
  dans les données. Il est calculé à la volée — distance à vol d'oiseau entre le centre de
  chaque commune et un repère choisi (commune ou point de la carte, paramètre d'URL `r`) —
  par `appliquerRepere`, côté serveur (aperçu) comme côté client, puis le référentiel est
  recalculé sur le jeu augmenté. Sans repère, `poidsEffectifs` met son poids à zéro et son
  curseur est inerte. Ne jamais le remplir depuis un service d'itinéraire sur le chemin d'un
  curseur ; un temps de trajet, s'il vient un jour, se calcule une fois au choix du repère. Les notes de source, avec URL de
ressource et méthodologie, vivent dans `data/sources/*.md` (une par importateur ; les
sous-dossiers par région sont les notes historiques). Le nom de zone
affiché vient du champ `zone` de `data/raw/<region>/referentiel.json` — jamais recopié
en dur dans le script. Rafraîchir les données : rejouer l'importateur concerné (cache des
fichiers nationaux dans `.cache-insee/`, ou `--dossier`), puis `build-dataset.mjs` pour
chaque département et `build-noyau.mjs`. `data/dist/` est généré, jamais édité à la main.
Le serveur de dev recharge un fichier de données modifié sans redémarrage.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
