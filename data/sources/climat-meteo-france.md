# Climat — Météo-France, données climatologiques de base mensuelles

Importateur : `scripts/importer-climat.mjs` → `data/raw/<région>/climat.json`, pour les
34 746 communes. Critère « Climat » (`climat`).

## Ressource

| Donnée | Ressource | Producteur | Maille |
|---|---|---|---|
| Valeurs mensuelles par station (précipitations, températures, nombres de jours, insolation), 1950-2024 | « Données climatologiques de base - mensuelles », un fichier par département, `MENSQ_<dd>_previous-1950-2024.csv.gz` (page : https://www.data.gouv.fr/datasets/donnees-climatologiques-de-base-mensuelles) | Météo-France | station |

Licence Ouverte / Etalab 2.0. La Corse est le département « 20 » dans ces fichiers. Le
dictionnaire des champs est `MENSQ_descriptif_champs.csv` sur la même page.

## Méthode

- **Normales 1991-2020 par station.** Pour chaque station et chaque mois de l'année, moyenne
  des valeurs mensuelles observées de 1991 à 2020 ; au moins 20 années sur 30 par mois, sinon
  la station est écartée pour cette grandeur. Les douze moyennes sont sommées (insolation
  `INST` en minutes → heures, précipitations `RR`, jours `NBJRR1`, `NBJTX30`, `NBJGELEE`) ou
  moyennées (température `TM`). Les valeurs estimées (`RR_ME`, `TX_ME`…) ne sont pas
  utilisées.
- **Rattachement.** Chaque commune reçoit la normale de la station valide la plus proche de
  son centre, séparément pour trois familles : insolation (119 stations valides en métropole,
  jusqu'à 100 km), précipitations (3 151 stations, jusqu'à 40 km), températures (1 684
  stations, jusqu'à 40 km). Le nom, l'altitude et la distance de la station sont écrits et
  affichés comme **maille** (`Mesure.maille`) : ce n'est pas une observation communale.
  Au-delà de la portée, la grandeur reste absente (« indisponible »), jamais estimée.
- **Mesures.** `clim-ensoleillement` (classante, sens haut, h/an) ; informatives, sans
  direction favorable : `clim-precipitations` (mm/an), `clim-jours-pluie` (jours ≥ 1 mm),
  `clim-temperature` (°C), `clim-jours-chauds` (TX ≥ 30 °C), `clim-jours-gel` (gelée).

Distances médianes commune → station (import du 10 septembre 2026) : insolation 29,7 km,
précipitations 5,9 km, températures 8,5 km. Hors portée : 17 communes pour l'insolation,
7 pour les températures.

## Vérification

À chaque exécution, l'importateur compare la station Biarritz-Pays-Basque (71 m, à 1,7 km de
Biarritz) aux normales 1991-2020 publiées par Météo-France : 1 920,6 h d'insolation,
1 473,6 mm de précipitations, 14,5 °C de température moyenne. Résultat de l'import :
1 921 h, 1 474 mm, 14,5 °C (141 jours de pluie, 12 jours à 30 °C ou plus, 15 jours de gelée).
Toute divergence arrête l'import.

## Limites affichées

Observations de la station la plus proche, pas de la commune : en montagne ou près du
littoral, le climat change en quelques kilomètres ; l'altitude de la station est donnée pour
en juger. Les normales décrivent 1991-2020, les dernières années sont en général plus
chaudes. L'insolation n'est mesurée que dans une centaine de stations.

## Rafraîchir

```
node scripts/importer-climat.mjs             # cache dans .cache-insee/meteo/ (ou --dossier)
node scripts/build-dataset.mjs <slug>        # pour chaque département
node scripts/build-noyau.mjs
```
