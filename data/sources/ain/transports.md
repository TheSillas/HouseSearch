# Critère « Transports » — note de source (Ain)

Mesure : distance à vol d'oiseau entre la mairie et la gare de voyageurs SNCF la plus proche,
pour les 87 communes cibles du département de l'Ain (01). Résultat écrit dans
`data/raw/ain/transports-gare-proche.json`, méthode identique à celle validée pour la Métropole
de Lyon et l'Ille-et-Vilaine.

## 1. Sources

| Donnée | Producteur | URL |
|---|---|---|
| Mairies (87 communes) | IGN / DINUM | `https://geo.api.gouv.fr/departements/01/communes?fields=...,mairie` |
| Gares de voyageurs (réseau national) | SNCF Gares & Connexions | `https://www.data.gouv.fr/api/1/datasets/r/cbacca02-6925-4a46-aab6-7194debbb9b7` — 2 782 gares |

Fraîcheur vérifiée le 2026-09-06 : `metas.default.modified = 2026-09-06T12:43:06+00:00`,
`records_count = 2782`, identique au fichier déjà utilisé pour les deux autres régions (même
flux vivant, interrogé le même jour).

## 2. Méthodologie

Distance haversine (rayon 6 371 km) entre le point mairie et chacune des 2 782 gares
nationales, sans restriction au département 01 (la gare la plus proche d'une commune
limitrophe peut se trouver dans l'Isère, la Saône-et-Loire, le Rhône, le Jura ou la
Haute-Savoie). **Aucune commune nouvelle du département ne porte de code de commune
déléguée/associée** dans le Code officiel géographique (COMD/COMA absents pour le 01) : aucune
exception de raccordement n'a été nécessaire, contrairement à l'Ille-et-Vilaine et à la
Métropole de Lyon.

## 3. Résultat constaté (87/87 communes, aucune valeur manquante)

- **23 communes sur 87** ont une gare de voyageurs directement sur leur territoire.
- Distance minimale : 89 m. Distance maximale : 18 952 m.

## 4. Limites à afficher à l'utilisateur

Identiques aux deux autres régions : distance à vol d'oiseau (pas une distance routière ni un
temps de trajet réel) ; le CSV SNCF est un flux vivant sans millésime figé ; `dansLaCommune`
reflète la présence d'une gare active, pas la desserte effective.
