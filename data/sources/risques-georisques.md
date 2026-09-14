# Risques naturels et technologiques — Géorisques (DGPR, BRGM, ASN)

Importateur : `scripts/importer-risques.mjs` → `data/raw/<région>/risques.json`, pour les
34 746 communes. Critère « Risques naturels » (`risques`).

## Ressources

| Donnée | Ressource | Producteur | Maille |
|---|---|---|---|
| Arrêtés de catastrophe naturelle (catnat), PPRN / PPRM / PPRT, risques recensés (DDRM) | Export national de la base GASPAR, `https://files.georisques.fr/GASPAR/gaspar.zip` (page : https://www.georisques.gouv.fr/donnees/bases-de-donnees/base-gaspar) | Ministère de la Transition écologique, DGPR | commune |
| Zone de sismicité réglementaire | API Géorisques `GET /api/v1/zonage_sismique?code_insee=…` (20 codes par appel au plus) | BRGM pour le ministère (décret n° 2010-1255) | commune |
| Potentiel radon | API Géorisques `GET /api/v1/radon?code_insee=…` (20 codes par appel au plus) | IRSN / ASN | commune |

Licence Ouverte / Etalab 2.0. L'export GASPAR porte sa date dans le nom des fichiers
(`catnat_gaspar_<date>.csv`) ; le millésime affiché est l'année de cet export.

## Méthode

- **Reconnaissances de catastrophe naturelle** (mesure classante `risq-catnat`, sens bas) :
  nombre de lignes distinctes (arrêté, type de risque, période d'événement) du fichier
  `catnat` pour la commune, depuis 1982. C'est le décompte que Géorisques affiche sur la
  fiche de la commune (Biarritz : 17). Répartition par type de risque tel que libellé au
  Journal officiel (« Inondations et/ou Coulées de Boue », « Sécheresse »…), plus la
  reconnaissance la plus récente. Une commune sans ligne a 0 reconnaissance : la base est
  nationale et exhaustive.
- **Risques recensés** (`risq-recenses`, informatif) : familles de risques (numéros à deux
  chiffres) listées pour la commune dans le dossier départemental des risques majeurs
  (fichier `ddrm_risq`). Commune absente du fichier → mesure absente (« indisponible »),
  jamais 0.
- **Plans de prévention** (`risq-pprn`, `risq-pprt`, informatifs) : procédures dont le
  sous-état GASPAR est « Approuvé », comptées une fois par code de procédure ; PPRN par type
  de risque (libellé de niveau 2), PPRT et PPRM regroupés.
- **Zone sismique** (`risq-sismique`, informatif) : `code_zone` 1 à 5 de l'API.
- **Potentiel radon** (`risq-radon`, informatif) : `classe_potentiel` 1 à 3 de l'API.
- **Communes fusionnées** : les lignes GASPAR restées au code d'une ancienne commune sont
  rattachées à la commune actuelle par les mouvements du Code officiel géographique
  (`v_mvt_commune_2025.csv`, MOD 31 à 34, chaînés) ; une même reconnaissance vue sous
  plusieurs anciens codes n'est comptée qu'une fois ; les codes rattachés sont écrits
  (`codesRattaches`) et affichés en précision.

## Vérification

À chaque exécution, l'importateur compare Biarritz (64122) à sa fiche Géorisques :
17 reconnaissances CatNat, zone de sismicité 3, potentiel radon 2. Toute divergence arrête
l'import.

## Limites affichées

Un arrêté constate qu'un événement a touché la commune et ouvre l'indemnisation, sans dire
l'ampleur des dégâts ni la part du territoire concernée ; la sécheresse
(retrait-gonflement des argiles) pèse lourd depuis les années 2010 ; zone sismique et
potentiel radon sont des classements réglementaires par commune, pas des mesures locales ;
un plan approuvé signale un risque connu et encadré, pas un risque plus grand qu'ailleurs.

## Rafraîchir

```
node scripts/importer-risques.mjs            # cache dans .cache-insee/ (ou --dossier)
node scripts/build-dataset.mjs <slug>        # pour chaque département
node scripts/build-noyau.mjs
```

Le cache de l'API (`georisques/zonage_sismique.json`, `georisques/radon.json`) ne se
réinterroge que pour les communes qui en sont absentes ; le supprimer pour tout rejouer.
