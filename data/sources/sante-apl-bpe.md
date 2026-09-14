# Santé — accès aux soins (DREES, APL) et équipements (INSEE, BPE 2025)

Import : `node scripts/importer-insee.mjs` → `data/raw/<région>/sante.json`.

## Accessibilité potentielle localisée (APL) aux médecins généralistes — DREES

- https://data.drees.solidarites-sante.gouv.fr/explore/dataset/530_l-accessibilite-potentielle-localisee-apl/
  — pièce jointe « Indicateur d'APL aux médecins généralistes.xlsx », feuilles
  « APL 2022 », « APL 2023 », « APL 2024 » (en-tête ligne 9, données à partir de
  la ligne 11 ; colonnes : code INSEE, commune, APL, APL aux médecins de 65 ans
  ou moins…).
- Producteur : DREES (activité SNIIR-AM de la Cnam, distancier Metric, populations INSEE).
  Licence Ouverte 2.0. Millésime retenu : **2024** ; 2022 et 2023 gardés pour l'évolution.
- **Ce que mesure l'APL** : le nombre de consultations, visites ou téléconsultations
  de médecine générale accessibles **par an et par habitant**, en tenant compte des
  médecins de la commune *et des communes voisines* (pondérés par la distance), de
  leur niveau d'activité réel et de la structure par âge de la population. C'est un
  indicateur d'accès effectif, pas un comptage : une commune sans médecin peut
  avoir un bon APL si le bourg voisin en compte plusieurs.
- Champ : omnipraticiens libéraux, certains exercices particuliers, salariés de
  centres de santé ; France hors Mayotte. 5 299 de nos 5 302 communes couvertes.

## Équipements de santé implantés sur la commune — BPE 2025 (INSEE)

- https://www.insee.fr/fr/statistiques/8217527 — `DS_BPE_CSV_FR.zip`
  (`DS_BPE_2025_data.csv`), lignes `GEO_OBJECT = COM`, `BPE_MEASURE = FACILITIES`,
  `TIME_PERIOD = 2025`. Même fichier que pour le critère Écoles.
- Types lus : D265 médecins généralistes ; les 23 spécialités médicales D251 à D276
  (cardiologie, dermatologie, radiologie, psychiatrie, ophtalmologie, pédiatrie,
  gynécologie…) ; D277 chirurgiens-dentistes ; les autres professionnels D246 à D250,
  D278 à D283 (infirmiers, kinésithérapeutes, sages-femmes, orthophonistes,
  pédicures-podologues, psychologues…) ; D307 pharmacies, D302 laboratoires, D113
  maisons de santé, D108 centres de santé ; D101 soins de courte durée, D102 soins de
  suite, D104 psychiatrie, D106 urgences, D107 maternités, D111 dialyse ; D401
  hébergements et D402 soins à domicile pour personnes âgées. Les spécialistes sont
  affichés en une mesure « médecins spécialistes » dont la précision énumère chaque
  spécialité présente (Biarritz : 3 dermatologues, 89 cardiologues…).
- La BPE est un dénombrement exhaustif : une commune sans ligne pour un type compte
  zéro équipement de ce type.

## Usage dans l'application

Critère **Santé** : seule l'APL classe (elle intègre les communes voisines) ; les
dénombrements BPE sont informatifs, avec, pour les médecins, le ratio pour 10 000
habitants indiqué en précision. Source propre à la mesure APL (DREES) affichée à
côté de celle du critère (INSEE BPE).
