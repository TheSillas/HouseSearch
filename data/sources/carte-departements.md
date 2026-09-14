# Fond de carte — contours des départements

Fichier : `src/data/geo/departements.json` (569 Ko, 96 départements métropolitains).

## Source

| | |
|---|---|
| Producteur des tracés | IGN, Admin Express COG (édition 2018) |
| Producteur des noms/codes | INSEE (millésime 2018) |
| Distribution | [gregoiredavid/france-geojson](https://github.com/gregoiredavid/france-geojson) (conversion SHP → GeoJSON via Mapshaper) |
| Fichier utilisé | `departements-version-simplifiee.geojson` — simplification à 5 % (méthode visvalingam weighted), coordonnées à 5 décimales (~1,11 m) |
| Licence | Licence Ouverte / Etalab (conditions d'utilisation Admin Express) — identique à celle déjà utilisée pour les référentiels communaux du projet |
| Consulté le | 2026-09-06 |

## Pourquoi cette version

Le dépôt distribue plusieurs niveaux de simplification. La version choisie (569 Ko,
5 % — la plus simplifiée) suffit à un fond de carte cliquable à l'échelle du
département : ce n'est pas une carte de navigation détaillée, seule la forme et la
position relative des départements comptent pour situer une commune et refléter le
classement en cours.

## Limites

- Ne couvre que les départements métropolitains (96) : les départements d'outre-mer
  ne sont pas encore peuplés dans le jeu de données (voir `docs/decisions.md`).
- Millésime 2018 : un changement de limite départementale postérieur ne serait pas
  reflété (aucun changement de ce type n'a eu lieu depuis).
- Utilisé uniquement comme fond de carte (couleurs neutres de l'application) : aucune
  donnée n'est lue depuis ce fichier au-delà du code département, qui sert à relier
  chaque forme au filtre de localisation existant.
