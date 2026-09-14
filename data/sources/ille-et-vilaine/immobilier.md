# Prix immobilier (clé : `immobilier`)

> Note de source vérifiée le **6 septembre 2026**. Toutes les URL listées ici ont été
> réellement interrogées (HTTP 200) pendant la rédaction de cette note. Méthodologie
> strictement identique à celle documentée pour la Métropole de Lyon
> (`data/sources/metropole-lyon/immobilier.md`), appliquée au département 35
> (Ille-et-Vilaine) et à sa liste de 128 communes.

## 1. Source retenue

**Base DVF (Demandes de valeurs foncières) de la DGFiP**, exploitée via ses deux
déclinaisons ouvertes sur data.gouv.fr, exactement comme pour Lyon :

| | Source A (agrégée) | Source B (brute normalisée) |
|---|---|---|
| Nom | Statistiques DVF | Demandes de valeurs foncières géolocalisées |
| Producteur | data.gouv.fr / Etalab (à partir des données DGFiP) | data.gouv.fr / Etalab (à partir des données DGFiP) |
| Page | https://www.data.gouv.fr/datasets/statistiques-dvf | https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees |
| Millésime | couverture **janvier 2021 - décembre 2025** | idem (`latest`) |
| Licence | Licence Ouverte 2.0 (`lov2`) | Licence Ouverte 2.0 (`lov2`) |

### Ressources exactes

**Source A - Statistiques DVF (agrégée par commune, utilisée uniquement pour le
contrôle de non-régression)**

- Ressource `Statistiques totales DVF` (5 ans cumulés), id `851d342f-9c96-41c1-924a-11a7a7aae8a6`
- API tabulaire (HTTP 200, testée le 06/09/2026) :
  `https://tabular-api.data.gouv.fr/api/resources/851d342f-9c96-41c1-924a-11a7a7aae8a6/data/?code_geo__exact={code}&page_size=10`

**Source B - DVF géolocalisées (mutations brutes, utilisée pour le recalcul), fichiers
départementaux du 35 :**

`https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/departements/35.csv.gz`

| Millésime | Taille (octets, HTTP 200) | Last-Modified |
|---|---|---|
| 2021 | 2 089 235 | 2026-05-18 12:00:47 UTC |
| 2022 | 2 220 859 | 2026-05-18 12:19:13 UTC |
| 2023 | 1 846 827 | 2026-05-18 12:38:15 UTC |
| 2024 | 1 646 822 | 2026-05-18 12:56:24 UTC |
| 2025 | 1 761 813 | 2026-05-18 13:14:12 UTC |

40 colonnes, dont : `id_mutation, date_mutation, nature_mutation, valeur_fonciere,
code_commune, nom_commune, ancien_code_commune, ancien_nom_commune, code_type_local,
type_local, surface_reelle_bati, code_postal`.

## 2. Méthodologie (reproduite à l'identique de Lyon)

### 2.1 Filtres officiels Etalab

1. dédoublonnage strict des lignes sur les colonnes utiles (`id_mutation, date_mutation,
   code_departement, code_commune, id_parcelle, nature_mutation, code_type_local,
   type_local, valeur_fonciere, surface_reelle_bati`) ;
2. `nature_mutation` dans `{"Vente", "Vente en l'état futur d'achèvement", "Adjudication"}`
   (valeurs constatées dans le fichier 35 : `Vente, Vente en l'état futur d'achèvement,
   Vente terrain à bâtir, Echange, Adjudication` - seules les 3 premières citées sont retenues) ;
3. `code_type_local` dans `{1 (Maison), 2 (Appartement), 4 (Local industriel/commercial)}` ;
4. **mono-bien** : on ne conserve que les `id_mutation` qui n'apparaissent qu'une seule
   fois après les filtres 2 et 3 ;
5. `prix_m2 = valeur_fonciere / surface_reelle_bati` ; suppression des valeurs
   nulles/infinies (surface nulle ou vide) ;
6. garde-fou aberrants : `prix_m2 < 100 000 EUR/m2` ;
7. médiane, moyenne et comptage par `code_commune` x `code_type_local`.

### 2.2 Vérification de reproductibilité (faite le 06/09/2026)

Recalcul à partir de `geo-dvf/latest/csv/{2021..2025}/departements/35.csv.gz` comparé
à l'API tabulaire de `stats_whole_period.csv` (Source A) sur 4 communes témoins :

| commune | type | n publié | n recalculé | médiane publiée | médiane recalculée |
|---|---|---|---|---|---|
| 35238 Rennes | appartement | 15 169 | 15 166 | 3 700 | 3 700 |
| 35238 Rennes | maison | 2 334 | 2 333 | 4 863 | 4 863 |
| 35047 Bruz | appartement | 599 | 599 | 3 115 | 3 115 |
| 35047 Bruz | maison | 589 | 589 | 3 151 | 3 151 |
| 35001 Acigné | appartement | 120 | 120 | 3 066 | 3 066 |
| 35001 Acigné | maison | 218 | 218 | 3 063 | 3 063 |
| 35015 Balazé | appartement | 1 | 1 | 2 049 | 2 049 |
| 35015 Balazé | maison | 115 | 115 | 1 825 | 1 825 |

Médianes identiques sur les 8 comparaisons ; écart de comptage résiduel uniquement sur
Rennes appartement (3 ventes sur 15 169, soit le même ordre de grandeur que l'écart
constaté sur Villeurbanne pour Lyon, imputable au bornage `<` / `<=` sur le garde-fou
100 000 EUR/m2).

### 2.3 Raccordement des codes communes

Contrairement à Lyon (arrondissements municipaux, Oullins-Pierre-Bénite), **aucune des
128 communes de la liste ne pose de problème de raccordement de code**, y compris les
7 communes nouvelles bretonnes présentes dans la liste :

| Code | Nom actuel | Fusion | Vérification |
|---|---|---|---|
| 35004 | Val-Couesnon | 01/01/2019 (Antrain, La Fontenelle, Saint-Ouen-la-Rouërie, Tremblay) | 2 codes postaux (35460, 35560) présents sous 35004 dès 2021, 5/5 années couvertes |
| 35176 | Guipry-Messac | 01/01/2016 (Guipry, Messac) | 5/5 années couvertes sous 35176 |
| 35257 | Maen Roch | 01/01/2017 (Saint-Brice-en-Coglès, Saint-Étienne-en-Coglès) | 5/5 années couvertes sous 35257 |
| 35168 | Val d'Anast | 01/01/2017 (Maure-de-Bretagne, Campel) | 5/5 années couvertes sous 35168 |
| 35191 | Les Portes du Coglais | 2017 | 5/5 années couvertes sous 35191 |
| 35282 | Rives-du-Couesnon | 2019 | 5/5 années couvertes sous 35282 |
| 35308 | Mesnil-Roc'h | fusion récente (nom évocateur) | 5/5 années couvertes sous 35308 |

Preuve technique : les 333 codes commune distincts observés dans les 5 fichiers
départementaux 35.csv.gz ont été passés en revue avec un script (comptage de lignes
par commune et par année). Résultat :
- les 128 codes cibles sont tous présents, **dans les 5 millésimes**, sans année à
  zéro mutation (vérifié ligne à ligne, pas seulement sur les totaux) ;
- la colonne `ancien_code_commune` (prévue par le schéma DVF pour signaler qu'une
  parcelle a changé de commune de rattachement) est **vide sur les 333 codes et les
  5 années** du département 35 : aucune mutation n'est restée « accrochée » à un
  ancien code après une fusion, contrairement au cas Oullins-Pierre-Bénite (69) où
  les fichiers avaient dû être fusionnés manuellement au niveau des mutations.
- pour Val-Couesnon (la fusion la plus large, 4 communes), la présence simultanée
  des 2 codes postaux hérités (35460 Antrain/Maen Roch, 35560 Tremblay/La
  Fontenelle/Saint-Ouen-la-Rouërie) sous le même `code_commune = 35004` dès 2021
  confirme que le géo-référencement DVF utilise déjà, sur toute la période, le
  découpage communal en vigueur à la date de génération du fichier (mai 2026), et
  non celui en vigueur à la date de la mutation.

**Cas écarté après vérification** : Pont-Péan (35363) a été suspecté a priori d'être
une commune nouvelle récente compte tenu de son nom composé, mais une recherche
(Wikipédia / Geneawiki) montre qu'elle a été détachée de Saint-Erblon en **1986**, sans
lien avec les fusions bretonnes 2016-2019 : aucun retraitement n'était nécessaire, et
aucun n'a été appliqué.

Les 121 autres communes de la liste sont directement disponibles sous leur code INSEE
actuel, sans fusion récente identifiée.

## 3. Millésime et fraîcheur

- Millésime en vigueur au 06/09/2026 : couverture **2021-01-01 à 2025-12-31**.
- Fréquence de mise à jour à afficher : **semestrielle** (avril et octobre).
- Décalage temporel : environ 8 mois entre la dernière mutation (31/12/2025) et la
  consultation.

## 4. Limites à afficher à l'utilisateur

Identiques aux limites documentées pour Lyon (section 4 de `metropole-lyon/immobilier.md`),
avec les particularités suivantes pour l'Ille-et-Vilaine :

1. **DVF ne couvre pas toute la France** (Alsace, Moselle, Mayotte exclues) : sans effet
   ici, département 35 inclus.
2. **Prix déclarés dans l'acte**, hors frais de notaire et d'agence.
3. **Dénominateur = `surface_reelle_bati`**, pas la surface Carrez.
4. **Mutations mono-bien uniquement** : ventes en lot exclues.
5. **VEFA incluse** : tire la médiane vers le haut dans les communes de la première
   couronne rennaise en fort développement (Cesson-Sévigné, Betton, Saint-Jacques-de-la-
   Lande, Chantepie, Chartres-de-Bretagne).
6. **Peu de garde-fous sur les valeurs aberrantes** (seuil unique à 100 000 EUR/m2).
7. **Volumes faibles = chiffres fragiles**, de façon plus marquée que pour Lyon : ce
   département compte de nombreuses communes rurales de quelques centaines
   d'habitants. 6 communes de la liste (Baulon 35016, Val d'Anast 35168,
   Pleine-Fougères 35222, Saint-Germain-en-Coglès 35273, Rives-du-Couesnon 35282,
   Sainte-Marie 35294) n'ont **aucune** vente d'appartement mono-bien retenue sur les
   5 années cumulées (`prixM2MedianAppartement = null`) : marché quasi exclusivement
   pavillonnaire. Sur 128 communes, l'évolution 1 an n'est publiée (seuil 30 ventes/an
   dans les deux millésimes) que pour 20 communes en appartement et 69 communes en
   maison ; ailleurs le champ est `null` avec `..._statut = "echantillon_insuffisant"`.
8. **L'évolution 1 an est volatile** et dépend autant de la composition des biens
   vendus que du marché.
9. **Décalage temporel** : dernière mutation disponible au 31/12/2025.
10. **Aucune commune n'est agrégée à partir de plusieurs codes DVF** dans ce
    département (à la différence de Lyon) : chaque ligne du fichier `communes` de
    `immobilier.json` correspond à un seul code INSEE, directement lu dans les
    fichiers DVF, sans recalcul de regroupement.

## 5. Pistes évaluées et écartées

Mêmes constats que pour Lyon (cf. section 5 de `metropole-lyon/immobilier.md`) :
`api.cquest.org/dvf` non réutilisée (dépendance tierce non officielle), l'API interne
`app.dvf.etalab.gouv.fr` non contractualisée et non agrégée, le jeu « Indicateurs
Immobiliers par commune et par année (2014-2024) » écarté (moyennes uniquement, pas de
médiane, colonnes non fiables), DV3F (Cerema) réservé aux acteurs publics (pas d'open
data), fichiers DGFiP bruts `txt.zip` non normalisés. Ces constats étant génériques à la
base DVF (pas spécifiques à un département), ils n'ont pas été retestés un par un pour
le 35 ; seule la disponibilité effective des fichiers départementaux 35.csv.gz et de
l'API tabulaire a été revérifiée (HTTP 200, section 1 ci-dessus).

## 6. Série 5 ans (clé `immobilier-historique`)

`data/raw/ille-et-vilaine/immobilier-historique.json` contient, pour les 128 communes
et les deux types de bien (appartement, maison), 5 points annuels (2021 à 2025),
calculés avec exactement la même méthode que la section 2 ci-dessus, appliquée
séparément à chacun des 5 fichiers départementaux annuels. Contrairement au cas Lyon,
les valeurs 2024/2025 de la série historique ont été calculées ici de la même passe que
la médiane 5 ans cumulée (un seul script, une seule exécution) : aucun écart d'arrondi
n'est possible par construction (mêmes fonctions, mêmes données sources).

**Couverture constatée (128 communes)** :

| | 2021 | 2022 | 2023 | 2024 | 2025 | 5 ans cumulé |
|---|---|---|---|---|---|---|
| Appartement (≥1 vente retenue) | 108/128 | 109/128 | 108/128 | 101/128 | 102/128 | 122/128 |
| Maison (≥1 vente retenue) | 128/128 | 128/128 | 128/128 | 128/128 | 128/128 | 128/128 |

Aucune commune n'a de trou sur la série maison (marché présent partout, y compris dans
les plus petites communes rurales). La série appartement est en revanche structurellement
incomplète pour les petites communes rurales sans habitat collectif : ceci est un fait de
marché, pas un défaut d'extraction (vérifié par contrôle manuel sur plusieurs communes
concernées, ex. Baulon 35016, Sainte-Marie 35294, aucune mutation de type 2 dans le
fichier source sur 5 ans).
