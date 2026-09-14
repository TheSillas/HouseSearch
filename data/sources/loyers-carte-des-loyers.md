# Loyers d'annonce par commune — « Carte des loyers » (édition 2025)

- **Jeu de données** : « Carte des loyers » — Indicateurs de loyers d'annonce par
  commune en 2025, data.gouv.fr
  (https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025)
- **Producteur** : Ministère de la Transition écologique (DHUP) et ANIL, modèle
  construit sur les annonces leboncoin et SeLoger.
- **Ressources utilisées** : `pred-app-mef-dhup.csv` (appartements, toutes
  surfaces) et `pred-mai-mef-dhup.csv` (maisons), publiées le 11 décembre 2025.
- **Licence** : non précisée sur la fiche data.gouv.fr de l'édition 2025 ; les
  éditions précédentes (2018 à 2024) sont sous Licence Ouverte 2.0.
- **Import** : `node scripts/importer-loyers.mjs` → `data/raw/<région>/loyers.json`.

## Ce que mesure l'indicateur

`loypredm2` : loyer mensuel d'annonce **au m², charges comprises**, estimé par
un modèle statistique pour un bien de référence, avec un intervalle de
prédiction (`lwr.IPm2`, `upr.IPm2`). Ce n'est **ni un loyer de bail signé, ni
un relevé exhaustif** : c'est une estimation à partir d'annonces.

`TYPPRED` : « commune » quand la commune compte assez d'annonces pour une
estimation propre ; « maille » quand l'estimation est celle d'un groupe de
communes voisines. Dans l'application, le second cas est déclaré via le champ
`maille` de la mesure, jamais présenté comme communal. `nbobs_com` donne le
nombre d'annonces observées dans la commune elle-même.

## Pourquoi l'ajouter à côté de DVF

DVF (ventes réelles, DGFiP) ne couvre ni l'Alsace-Moselle (Livre foncier) ni
Mayotte : aucune donnée gratuite de *transactions* ne comble ce trou. Les
loyers, eux, sont estimés pour **toutes** les communes, Strasbourg et Metz
comprises — et le loyer est l'autre moitié du coût du logement, celle qui
concerne directement qui n'achète pas.

## Limites

- Estimation modélisée, pas observation : à lire avec son intervalle.
- Bien « de référence » : ne reflète pas la dispersion réelle des logements
  d'une commune.
- Édition annuelle : millésime 2025 ; à réimporter à chaque nouvelle édition.
