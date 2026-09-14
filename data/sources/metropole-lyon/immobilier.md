# Prix immobilier (cle : `immobilier`)

> Note de source verifiee le **5 septembre 2026**. Toutes les URL listees ici ont ete
> reellement interrogees (HTTP 200) pendant la redaction de cette note.

## 1. Source retenue

**Base DVF (Demandes de valeurs foncieres) de la DGFiP**, exploitee via ses deux
declinaisons ouvertes sur data.gouv.fr :

| | Source A (agregee) | Source B (brute normalisee) |
|---|---|---|
| Nom | Statistiques DVF | Demandes de valeurs foncieres geolocalisees |
| Producteur | data.gouv.fr / Etalab (a partir des donnees DGFiP) | data.gouv.fr / Etalab (a partir des donnees DGFiP) |
| Page | https://www.data.gouv.fr/datasets/statistiques-dvf | https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees |
| Millesime | DVF avril 2026 : couverture **janvier 2021 - decembre 2025** | idem (`latest` = janvier 2021 - decembre 2025) |
| Derniere modif. fichier | 2026-07-17 15:22 UTC | 2026-07-17 14:21 UTC (fichier unique) / 2026-05-18 (fichiers departementaux) |
| Licence | Licence Ouverte 2.0 (`lov2`) | Licence Ouverte 2.0 (`lov2`) |
| Frequence | punctual (regenere a chaque livraison DVF) | semestrielle |

Source amont : **Demandes de valeurs foncieres**, Ministeres economiques et financiers (DGFiP),
https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres - licence Ouverte 2.0,
frequence semestrielle, derniere mise a jour constatee **2026-04-05** (millesimes 2021 a 2025).

### Ressources exactes

**Source A - Statistiques DVF (deja agregee par commune)**

- Ressource `Statistiques totales DVF` (5 ans cumules)
  - id : `851d342f-9c96-41c1-924a-11a7a7aae8a6`
  - URL : https://data-pipeline-open.s3.sbg.io.cloud.ovh.net/dvf/stats_whole_period.csv (CSV, 30,7 Mo, HTTP 200)
  - API tabulaire : `https://tabular-api.data.gouv.fr/api/resources/851d342f-9c96-41c1-924a-11a7a7aae8a6/data/?code_geo__exact=69266&page_size=10`
  - Colonnes : `code_geo, libelle_geo, code_parent, echelle_geo, nb_ventes_whole_appartement, moy_prix_m2_whole_appartement, med_prix_m2_whole_appartement, nb_ventes_whole_maison, moy_prix_m2_whole_maison, med_prix_m2_whole_maison, nb_ventes_whole_apt_maison, moy_prix_m2_whole_apt_maison, med_prix_m2_whole_apt_maison, nb_ventes_whole_local, moy_prix_m2_whole_local, med_prix_m2_whole_local`
  - Filtrer `echelle_geo = "commune"` ; `code_geo` = code INSEE ; unite = EUR/m2 (entier).

- Ressource `Statistiques mensuelles DVF`
  - id : `03fba98d-885b-43c0-8986-d299cabc29da`
  - URL : https://data-pipeline-open.s3.sbg.io.cloud.ovh.net/dvf/stats_dvf.csv (CSV, 276,6 Mo, HTTP 200)
  - Colonne supplementaire `annee_mois` (`2021-01` a `2025-12`, 60 mois verifies pour 69266).
  - **Ne pas** s'en servir pour l'evolution annuelle : ce sont des medianes mensuelles,
    et une mediane de medianes n'a pas de sens statistique.

**Source B - DVF geolocalisees (mutations brutes, pour recalcul)**

- Fichiers departementaux (recommandes, legers) :
  `https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/departements/69.csv.gz`
  - 2025 : 2 111 397 octets (HTTP 200, Last-Modified 2026-05-18)
  - 2024 : 1 906 199 octets (HTTP 200)
  - annees disponibles dans `latest` : 2021, 2022, 2023, 2024, 2025
- Fichier unique national : ressource `d7933994-2c66-4131-a4da-cf7cd18040a4`,
  https://static.data.gouv.fr/resources/demandes-de-valeurs-foncieres-geolocalisees/20260717-142041/dvf.csv.gz
  (523 Mo compresse : inutile ici, preferer le fichier departemental 69).
- 40 colonnes, dont : `id_mutation, date_mutation, nature_mutation, valeur_fonciere,
  code_commune, nom_commune, code_type_local, type_local, surface_reelle_bati, code_postal`.

## 2. Methodologie

### 2.1 Filtres officiels Etalab (reproduits a l'identique)

Documentes sur la page du jeu de donnees et dans le code du pipeline
(https://github.com/datagouv/datagouvfr_data_pipelines/blob/main/data_processing/dvf/explore/task_functions.py) :

1. dedoublonnage strict des lignes sur les colonnes utiles
   (`id_mutation, date_mutation, code_departement, code_commune, id_parcelle,
   nature_mutation, code_type_local, type_local, valeur_fonciere, surface_reelle_bati`) :
   les fichiers sources contiennent 4 a 8 % de doublons purs ;
2. `nature_mutation` dans `{"Vente", "Vente en l'etat futur d'achevement", "Adjudication"}` ;
3. `code_type_local` dans `{1 (Maison), 2 (Appartement), 4 (Local industriel/commercial)}`
   : les dependances (code 3) et les terres (code vide) sont ignorees et ne rendent donc
   pas une mutation "multi-biens" ;
4. **mono-bien** : on ne conserve que les `id_mutation` qui n'apparaissent qu'une seule fois
   apres les filtres 2 et 3 (exclusion des ventes en lot / multi-types) ;
5. `prix_m2 = valeur_fonciere / surface_reelle_bati` ; suppression des valeurs nulles/infinies ;
6. garde-fou aberrants : `prix_m2 < 100 000 EUR/m2` (seul garde-fou applique par Etalab) ;
7. mediane, moyenne et comptage par `code_commune` x `code_type_local`.

Note : Etalab utilise `surface_reelle_bati` et **non** la surface Carrez.

### 2.2 Verification de reproductibilite (faite le 2026-09-05)

Le recalcul a partir des fichiers `geo-dvf/latest/csv/{2021..2025}/departements/69.csv.gz`
redonne exactement les valeurs publiees dans `stats_whole_period.csv` :

| commune | type | n publie | n recalcule | mediane publiee | mediane recalculee |
|---|---|---|---|---|---|
| 69266 Villeurbanne | appartement | 11 440 | 11 439 | 3 849 | 3 849 |
| 69266 Villeurbanne | maison | 577 | 577 | 4 536 | 4 536 |
| 69142 La Mulatiere | appartement | 465 | 465 | 3 000 | 3 000 |
| 69381 Lyon 1er | appartement | 2 210 | 2 210 | 5 357 | 5 357 |
| 69149 (perimetre Oullins) | appartement | 1 653 | 1 653 | 3 272 | 3 272 |
| 69152 Pierre-Benite | appartement | 329 | 329 | 2 840 | 2 840 |

Ecart residuel : 1 vente sur 11 439 pour Villeurbanne (bornage `<` / `<=` sur le
garde-fou 100 000 EUR/m2). Les medianes sont identiques.

### 2.3 Raccordement des codes communes (indispensable)

- **Lyon 69123** : la ligne `code_geo = 69123` existe dans `stats_whole_period.csv` mais
  **tous ses indicateurs sont NULL** (verifie par API tabulaire). Les mutations lyonnaises
  sont portees par les 9 arrondissements `69381` a `69389`. Il faut donc recalculer la
  mediane sur l'union des mutations des 9 arrondissements (une somme ou une moyenne des
  medianes d'arrondissement serait fausse).
- **Oullins-Pierre-Benite 69149** : la commune nouvelle date du 01/01/2024, mais DVF suit le
  code cadastral. Verification du fichier departemental 69 :
  - 2021 a 2024 : Pierre-Benite est codee `69152` (466, 439, 371 puis 188 mutations) ;
  - 2025 : plus aucune ligne `69152`, et `69149` contient 300 lignes de code postal 69310
    (Pierre-Benite) en plus des 992 lignes 69600 (Oullins).
  La ligne `69149` du fichier agrege ne couvre donc **pas** le perimetre complet de la
  commune nouvelle avant 2025 : il faut fusionner `69149 + 69152` au niveau des mutations.
- Les 30 autres communes de la liste sont directement disponibles sous leur code INSEE actuel.

## 3. Millesime et fraicheur

- Millesime en vigueur au 05/09/2026 : **DVF livraison avril 2026**, couvrant
  **2021-01-01 a 2025-12-31** (10 semestres).
- Prochaine livraison attendue : **octobre 2026** (ajout du 1er semestre 2026),
  puis avril 2027.
- Frequence de mise a jour a afficher : **semestrielle** (avril et octobre).

## 4. Limites a afficher a l'utilisateur

1. **DVF ne couvre pas toute la France** : l'Alsace, la Moselle et Mayotte sont exclues
   (droit local). Sans effet sur la metropole de Lyon, mais a mentionner si le comparateur
   s'etend.
2. **Prix declares dans l'acte, pas prix de marche** : la valeur fonciere est le montant
   porte a l'acte, frais d'agence et de notaire exclus, et inclut parfois du mobilier.
3. **Denominateur = `surface_reelle_bati`**, pas la surface Carrez : pour un appartement,
   les deux peuvent differer.
4. **Mutations mono-bien uniquement** : les ventes en lot (immeuble entier, plusieurs
   appartements dans un meme acte) et les ventes multi-types (maison + local) sont ecartees.
   Cela retire une partie du marche, notamment l'investissement locatif en bloc.
5. **VEFA incluse** : les ventes en l'etat futur d'achevement sont conservees, ce qui tire
   la mediane vers le haut dans les communes en fort renouvellement urbain.
6. **Peu de garde-fous sur les valeurs aberrantes** : seul le seuil 100 000 EUR/m2 est
   applique par Etalab. La mediane amortit ce bruit, mais les petites communes restent
   sensibles.
7. **Volumes faibles = chiffres fragiles.** Sur 2021-2025, La Mulatiere ne compte que
   31 ventes de maisons et Lyon 1er 9 ventes de maisons. En glissement annuel, plusieurs
   communes descendent sous 30 ventes/an pour un type de bien : l'evolution annuelle n'y
   est alors pas interpretable et doit etre masquee (valeur `null`).
8. **L'evolution 1 an est volatile** : elle mesure un deplacement de la mediane, qui depend
   autant de la composition des biens vendus (taille, neuf/ancien, quartier) que du prix
   du marche. Exemple constate : Rillieux-la-Pape passe de 3 368 EUR/m2 (2024, 195 ventes
   d'appartements) a 2 652 EUR/m2 (2025, 177 ventes), soit -21 %, ce qui traduit surtout
   un effet de composition.
9. **Decalage temporel** : la donnee la plus recente disponible s'arrete au 31/12/2025,
   soit environ 8 mois de retard. DVF enregistre les mutations a leur publication au
   service de publicite fonciere, ce qui ajoute encore quelques semaines de latence sur
   les derniers mois du millesime.
10. **Lyon est traitee comme une seule commune** en agregeant ses 9 arrondissements :
    la dispersion interne (Lyon 1er/6e vs Lyon 8e/9e) est ecrasee par la mediane globale.
11. **Oullins-Pierre-Benite** : la serie est reconstituee en fusionnant les mutations
    d'Oullins et de Pierre-Benite avant 2025 ; l'evolution annuelle porte donc sur un
    perimetre reconstruit, pas sur la commune historique.

## 5. Pistes evaluees et ecartees

| Piste | Statut au 05/09/2026 | Raison |
|---|---|---|
| `https://api.cquest.org/dvf` | **HTTP 502 Bad Gateway** (teste) | API tierce non officielle, indisponible : a ne pas utiliser en production. |
| `app.dvf.etalab.gouv.fr` (API `/api/mutations3/...`) | HTTP 200 | API interne non contractualisee, orientee parcelle / section cadastrale ; ne fournit aucun agregat communal. Les statistiques affichees par explore.data.gouv.fr/immobilier proviennent des memes fichiers que la Source A. |
| [Indicateurs Immobiliers par commune et par annee (2014-2024)](https://www.data.gouv.fr/datasets/indicateurs-immobiliers-par-commune-et-par-annee-prix-et-volumes-sur-la-periode-2014-2024) | HTTP 200, ressource 2024 `1b85be7c-17ce-42dc-b191-3b8f3c469087` | Utile comme controle croise annuel (colonnes `INSEE_COM, annee, nb_mutations, NbMaisons, NbApparts, PropMaison, PropAppart, PrixMoyen, Prixm2Moyen, SurfaceMoy`), mais : **moyennes uniquement** (aucune mediane), **un seul prix/m2 tous types confondus**, filtres differents (prix 15 k - 10 M EUR, surfaces bornees, 330 - 15 000 EUR/m2), publication annuelle arretee a 2024 (fichier du 07/07/2025), producteur individuel (pas d'organisation data.gouv.fr), licence ODbL, et colonnes `PropMaison`/`PropAppart` visiblement inversees pour 69123. Ecartee comme source principale. |
| DV3F (Cerema) | Version 2026-1 disponible (janv. 2010 - dec. 2025) | Acces reserve aux acteurs publics de l'amenagement via le Portail des Donnees foncieres : **pas d'open data**, incompatible avec une rediffusion publique. |
| Fichiers DGFiP bruts (`txt.zip`) | HTTP 200, maj 2026-04-05 | Format historique non normalise (separateur `\|`, decimales a la virgule, pas de code INSEE normalise) ; la version geolocalisee Etalab est strictement preferable. |

## 6. Extension a la serie 5 ans (cle `immobilier-historique`, ajoutee le 05/09/2026)

En plus des deux millesimes 2024/2025 deja presents dans `immobilier.json`, les fichiers
departementaux `https://files.data.gouv.fr/geo-dvf/latest/csv/{2021,2022,2023}/departements/69.csv.gz`
ont ete telecharges et traites (HTTP 200 pour les trois annees) pour produire
`data/raw/immobilier-historique.json`, une serie 2021-2025 (5 points par commune et par
type de bien) pour les 32 communes de `referentiel.json`.

**Methode strictement identique** a la section 2 ci-dessus : dedoublonnage sur les colonnes
utiles, filtre `nature_mutation` (Vente / VEFA / Adjudication), filtre `code_type_local` (1/2/4),
mutations mono-bien uniquement, `prix_m2 = valeur_fonciere / surface_reelle_bati`, exclusion
`>= 100 000 EUR/m2`, mediane par commune (regroupement Lyon = 69381-69389, Oullins-Pierre-Benite
= 69149+69152) et par type de bien (1 = maison, 2 = appartement).

**Controle de non-regression (fait le 05/09/2026)** : le nombre de ventes retenues pour
2021+2022+2023 recalcule pour cette tache, additionne aux comptages 2024/2025 deja publies
dans `immobilier.json`, reproduit exactement le total 5 ans (`nbTransactionsAppartement` /
`nbTransactionsMaison`) deja verifie dans ce fichier, sans aucun ecart, pour les 4 communes
temoins testees (Lyon, Villeurbanne, La Mulatiere, Oullins-Pierre-Benite - appartements et
maisons, soit 8 comparaisons). Exemple : Lyon appartement, total 5 ans publie = 36 780 ;
2024 (6 123) + 2025 (6 834) + 2021-2023 recalcule (8 494 + 8 492 + 6 837 = 23 823) = 36 780.

Les valeurs 2024 et 2025 du fichier `immobilier-historique.json` sont **reprises telles
quelles** depuis `immobilier.json` (pas de recalcul), pour eviter tout ecart d'arrondi entre
les deux fichiers. Seules 2021, 2022 et 2023 sont des calculs nouveaux pour cette tache.

Couverture obtenue : les 32 communes ont une valeur non nulle (appartement ET maison) pour
chacune des 5 annees - aucun trou constate sur ce perimetre, y compris pour les plus petites
communes (ex. Charbonnieres-les-Bains : 20 a 36 ventes de maisons par an selon l'annee).
Comme pour la serie 5 ans cumulee, les volumes annuels par petite commune restent faibles et
les variations d'une annee sur l'autre doivent etre lues avec prudence (cf. limites de la
section 4, notamment #7 et #8), mais aucune valeur n'a ete supprimee par manque de volume :
seul un compte de ventes egal a zero produit un `null`.
