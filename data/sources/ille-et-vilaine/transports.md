# Critère « Transports » — note de source (Ille-et-Vilaine)

Mesure : distance à vol d'oiseau entre la mairie et la gare de voyageurs SNCF la plus proche, pour les 128 communes cibles du département d'Ille-et-Vilaine (35). Résultat écrit dans `data/raw/ille-et-vilaine/transports-gare-proche.json`, en reproduisant à l'identique la méthode déjà validée pour la Métropole de Lyon (`data/sources/metropole-lyon/transports.md`, §7).

## 1. Sources utilisées

| Donnée | Producteur | Licence | URL |
|---|---|---|---|
| Mairies des 128 communes (point `mairie`) | IGN / DINUM (API découpage administratif) | Licence Ouverte / Etalab | `https://geo.api.gouv.fr/communes/{code}?fields=nom,code,mairie` |
| Gares de voyageurs du réseau ferré national | SNCF Gares & Connexions | ODbL | `https://www.data.gouv.fr/api/1/datasets/r/cbacca02-6925-4a46-aab6-7194debbb9b7` — CSV séparateur `;`, 2 782 gares |
| Code officiel géographique (COG) — table des communes, 1ᵉʳ janvier 2026 | INSEE | Licence Ouverte / Etalab | `https://www.insee.fr/fr/statistiques/fichier/8740222/v_commune_2026.csv` |

Fraîcheur du CSV des gares vérifiée le jour du téléchargement (2026-09-06) via `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/` (HTTP 200) : `metas.default.modified = 2026-09-06T12:43:06+00:00`, `records_count = 2782`, cohérent avec les 2 782 lignes de données du CSV téléchargé.

## 2. Méthodologie exécutée et vérifiée le 06/09/2026

1. **Mairies** : 128 appels HTTP réels vers `geo.api.gouv.fr`, un par code INSEE cible, tous en HTTP 200, avec retry (jusqu'à 3 tentatives) — aucune erreur constatée. Coordonnées `mairie.coordinates` (lon, lat) extraites pour chaque commune.
2. **Gares** : CSV national téléchargé en une seule fois (2 782 gares, colonnes `Nom_Gare`, `Trigramme`, `Segment(s) DRG`, `Position géographique` (`lat, lon`), `Code commune`, `Code_UIC`, `Id_Gare`). Parsing CSV avec gestion des champs entre guillemets contenant le séparateur `;` (ex. `"A;A"` dans `Segment(s) DRG` pour certaines gares comme Paris Gare du Nord, Avignon TGV, Châteaubriant) — une première tentative de split naïf par `;` avait mal aligné 9 lignes sur 2 782 ; corrigée avant le calcul final (le résultat sur les 128 communes n'a pas changé, ces 9 gares n'étant candidates « plus proche » pour aucune d'entre elles).
3. Pour chaque commune, distance haversine (rayon terrestre 6 371 km) calculée entre le point mairie et **chacune** des 2 782 gares du fichier national — aucune restriction au département 35, la gare la plus proche d'une commune limitrophe pouvant se trouver en Manche, Loire-Atlantique, Mayenne ou Côtes-d'Armor. La gare de distance minimale est retenue.
4. **Rattachement « gare dans la commune »** (`dansLaCommune`) : comparaison du `Code commune` brut du CSV SNCF avec le code INSEE de la commune cible, **plus une exception pour les communes nouvelles** : 11 des 128 communes cibles sont des communes nouvelles issues de fusions bretonnes récentes. Pour identifier les anciens codes de communes déléguées/associées absorbées, la table du Code officiel géographique (COG, `v_commune_2026.csv`) a été utilisée : les lignes `TYPECOM = COMD` (commune déléguée) ou `COMA` (commune associée) portent un champ `COMPARENT` donnant le code INSEE actuel de la commune de rattachement. Un `Code commune` de gare correspondant à un ancien code dont le `COMPARENT` est une des 128 cibles compte comme « dans la commune ».

## 3. Communes nouvelles concernées (11 sur 128)

| Code actuel | Nom actuel | Anciennes communes déléguées/associées absorbées (COMD/COMA du COG) |
|---|---|---|
| 35004 | Val-Couesnon | Antrain (35004, même code), La Fontenelle (35113), Saint-Ouen-la-Rouërie (35303), Tremblay (35341) |
| 35062 | La Chapelle-Fleurigné | La Chapelle-Janson (35062, même code), Fleurigné (35112) |
| 35069 | Châteaugiron | Châteaugiron (35069, même code), Ossé (35209), Saint-Aubin-du-Pavail (35254) |
| 35096 | Domagné | Chaumeré (35074, COMA) |
| 35168 | Val d'Anast | Maure-de-Bretagne (35168, même code), Campel (35048) |
| 35184 | Montauban-de-Bretagne | Montauban-de-Bretagne (35184, même code), Saint-M'Hervon (35301) |
| 35191 | Les Portes du Coglais | Montours (35191, même code), Coglès (35083), La Selle-en-Coglès (35323) |
| 35220 | Piré-Chancé | Piré-sur-Seiche (35220, même code), Chancé (35053) |
| 35257 | Maen Roch | Saint-Brice-en-Coglès (35257, même code), Saint-Étienne-en-Coglès (35267) |
| 35282 | Rives-du-Couesnon | Saint-Jean-sur-Couesnon (35282, même code), Saint-Georges-de-Chesné (35269), Saint-Marc-sur-Couesnon (35293), Vendel (35348) |
| 35308 | Mesnil-Roc'h | Saint-Pierre-de-Plesguen (35308, même code), Lanhélin (35147), Tressé (35344) |

Constat après calcul : **aucune de ces 11 communes n'a déclenché l'exception COMD/COMA** dans le résultat final. Chaque fois qu'une gare se trouve réellement dans le périmètre d'une de ces communes nouvelles (ex. « La Brohinière » et « Montauban-de-Bretagne » pour la commune de Montauban-de-Bretagne), son `Code commune` porte déjà directement le code actuel de la commune fusionnée — la pratique de l'INSEE étant de faire porter le nouveau code par la commune-centre, qui conserve alors son propre numéro. L'exception reste néanmoins codée et documentée pour la robustesse de la méthode, comme pour le cas Pierre-Bénite/Oullins de la Métropole de Lyon.

## 4. Résultat vérifié au 06/09/2026 (128/128 communes, aucune valeur manquante)

- **Rennes (35238)** : gare la plus proche = **Rennes** (`Code commune = 35238`), à **1 033 m** de la mairie — `dansLaCommune = true`. Cohérent avec la présence d'une gare TGV majeure en centre-ville.
- Distance minimale sur les 128 communes : **95 m** (Saint-Armel, gare dans la commune).
- Distance maximale : **29 207 m** (Louvigné-du-Désert, gare la plus proche = Pontorson - Mont-Saint-Michel, dans la Manche).
- **31 communes sur 128** ont une gare de voyageurs directement sur leur territoire (`dansLaCommune = true`) ; les 97 autres n'en ont pas.
- Cas notable : **Fougères** (35115, sous-préfecture), la 2ᵉ ville du département par la population, n'a **aucune gare de voyageurs active** dans le CSV national (la ligne Fougères–Vitré a fermé au trafic voyageurs) — sa gare la plus proche est **Vitré**, à 25 450 m. Ce n'est pas une anomalie de méthode mais un fait réel du réseau ferré actuel.

## 5. Limites à afficher à l'utilisateur final

- Distance à vol d'oiseau (haversine), pas une distance routière ni un temps de trajet réel.
- Le CSV SNCF est un flux vivant sans millésime figé : une commune qui perd ou gagne une gare verra le résultat changer à la prochaine extraction.
- `dansLaCommune` reflète la présence d'une gare active de voyageurs sur le territoire communal actuel (y compris via ses communes déléguées/associées), pas la desserte effective (fréquence, arrêt TER/TGV, etc.).
