# Critère « Transports » — note de source

**Clé technique :** `transports`
**Dernière vérification :** 5 septembre 2026. Toutes les URL citées ci-dessous ont réellement été appelées ce jour-là et ont répondu HTTP 200, sauf les deux mentions explicites de HTTP 401.

Le critère se décompose en deux indicateurs :

* **(a)** nombre de lignes de transport en commun desservant la commune ;
* **(b)** temps de trajet en transport en commun vers Lyon Part-Dieu, à un horaire de référence documenté.

---

## 1. Source retenue pour l'indicateur (a) — nombre de lignes

### 1.1 Source principale : « Points d'arrêt du réseau Transports en Commun Lyonnais » (SYTRAL Mobilités)

| Élément | Valeur |
|---|---|
| Producteur | **SYTRAL Mobilités** (autorité organisatrice de la mobilité, SIREN 200096386) |
| Page data.gouv.fr | https://www.data.gouv.fr/datasets/points-darret-du-reseau-transports-en-commun-lyonnais |
| Identifiant data.gouv.fr | `5e3aecb26f4441763a655639` |
| Page portail producteur | https://data.grandlyon.com/portail/fr/jeux-de-donnees/points-arret-reseau-transports-commun-lyonnais/info |
| **Licence** | **Licence Ouverte v2.0 (Etalab)** — champ `license: lov2` renvoyé par l'API data.gouv.fr |
| Fréquence de mise à jour | **quotidienne** (`frequency: daily`). `last_update` = 2026-09-04T23:26:11Z ; l'attribut `last_update` des objets eux-mêmes valait `2026-09-05T01:20:00+02:00` au moment de la vérification |
| Millésime | **flux vivant** : état courant du réseau, pas de millésime annuel |
| Volumétrie | 9 730 points d'arrêt (`numberMatched` renvoyé par le WFS), ~5 Mo en GeoJSON |

**URL de ressource testées (HTTP 200) :**

```
GeoJSON : https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tclarret&outputFormat=application/json&SRSNAME=EPSG:4326
CSV     : https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tclarret&outputFormat=CSV&SRSNAME=EPSG:4326
SHP     : https://data.grandlyon.com/geoserver/sytral/ows?SERVICE=WFS&VERSION=2.0.0&request=GetFeature&typename=sytral:tcl_sytral.tclarret&outputFormat=shape-zip&SRSNAME=EPSG:2154
```

Ce sont **exactement** les URL déclarées comme ressources du jeu de données sur data.gouv.fr (ids de ressource `8cd06f11-1702-4071-8970-b975bb97c624` pour le GeoJSON, `cf40491b-bc01-41fb-b43e-0f1c8469112c` pour le CSV, `45f31479-c1f7-47ba-bd9c-f51b6643386c` pour le SHP). Aucune authentification n'est nécessaire.

**Colonnes utiles** (vérifiées sur la réponse réelle) :

* `id` — identifiant de l'arrêt ; **c'est aussi le `stop_id` du GTFS TCL** (8 548 identifiants communs sur les 8 851 `stop_id` du GTFS) ;
* `nom` — nom de l'arrêt ;
* `desserte` — **liste des lignes desservant l'arrêt**, format `CODE:SENS` séparé par des virgules (ex. `115:R,118:R,JD767:A,JD979:A`) ;
* `commune` — libellé de la commune ;
* `insee` — **code INSEE de la commune** (Lyon est codé par arrondissement : 69381…69389) ;
* `pmr`, `ascenseur`, `escalator` — accessibilité ; `zone` — zone tarifaire ;
* `adresse`, `last_update`, `gid`.

Le WFS accepte un filtre serveur `cql_filter`. Exemple testé : `&cql_filter=insee='69266'` renvoie `numberMatched: 253` pour Villeurbanne ; `insee='69123'` renvoie **0** (Lyon n'existe que par arrondissement dans cette source).

### 1.2 Source complémentaire : référentiel des lignes (mode et type de ligne)

`desserte` ne donne que des codes de ligne. Pour connaître le **mode** (métro / funiculaire / tramway / bus / navette fluviale) et le **type** (régulière, scolaire, événementielle, TAD), il faut les couches « lignes », toutes du même producteur, toutes en **Licence Ouverte v2.0**, toutes en **mise à jour quotidienne** :

| Jeu de données | Page data.gouv.fr | Couche WFS |
|---|---|---|
| Lignes de bus | https://www.data.gouv.fr/datasets/lignes-de-bus-du-reseau-transports-en-commun-lyonnais | `sytral:tcl_sytral.tcllignebus_2_0_0` |
| Lignes de métro et funiculaire | https://www.data.gouv.fr/datasets/lignes-de-metro-et-funiculaire-du-reseau-transports-en-commun-lyonnais | `sytral:tcl_sytral.tcllignemf_2_0_0` |
| Lignes de tramway | https://www.data.gouv.fr/datasets/lignes-de-tramway-du-reseau-transports-en-commun-lyonnais | `sytral:tcl_sytral.tcllignetram_2_0_0` |
| Ligne fluviale Navigône | https://www.data.gouv.fr/datasets/ligne-de-transport-fluvial-navigone-du-reseau-transports-en-commun-lyonnais | `sytral:tcl_sytral.tcllignefluv` |

Même patron d'URL que ci-dessus, en changeant `typename`.

Colonnes utiles : **`ligne`** — c'est le **code commercial public**, celui que porte `desserte` et celui qu'il faut afficher —, `code_ligne` — identifiant **interne**, souvent différent (la navette fluviale Navigône est `ligne = NAVI1` mais `code_ligne = 7601`) et jamais destiné à l'affichage ; il sert de clé de jointure avec le `route_id` du GTFS —, `famille_transport` (`BUS`, `MET`, `FUN`, `TRA`, `BAT`), `code_type_ligne` / `nom_type_ligne` (`REG` Régulière, `SCO` Scolaire, `EVE` Événementielle, `TAD` Transport à la demande), `sens`, `nom_trace`, `couleur_hex`, `nom_version`, `date_debut`, `date_fin`.

Décompte obtenu le 05/09/2026 sur l'ensemble du réseau : **798 codes de ligne distincts**, dont **163 régulières** (150 bus + 7 tramways + 4 métros + 2 funiculaires), **183 typées `SCO`**, 2 `EVE` (N186, N195), 1 `TAD` (la ligne **131**, La Tour de Salvagny Gare – Techlid) ; **588 codes commencent par `JD`** (lignes scolaires « Junior Direct ») ; et **449 codes n'ont aucun `code_type_ligne`**.

Ces 449 codes sans type ne sont pas un déchet : ils contiennent, à côté des `JD*` et des bus relais `BR*`, **toutes les lignes interurbaines reprises des réseaux Cars du Rhône et Libellule** (102, 151 à 156, 161, 164, 165, 211 à 222, 231, 235 à 243, 245, 247, 265, 285, 88, C202 à C205) **et la navette fluviale NAVI1**. Le référentiel « lignes » du SYTRAL ne leur attribue pas de type, mais le GTFS les fait circuler. C'est le point qui commande le périmètre retenu au §3.2.

### 1.3 Source complémentaire : desserte ferroviaire (TER / Intercités / TGV)

Le réseau TCL ignore le train. Or Givors, Brignais, Feyzin, Saint-Fons, Irigny, Francheville, Charbonnières-les-Bains, Dardilly, Tassin-la-Demi-Lune, Rillieux-la-Pape, Saint-Priest, Vénissieux et Oullins-Pierre-Bénite disposent d'une gare voyageurs.

| Jeu de données | Producteur | Licence | URL testée (HTTP 200) |
|---|---|---|---|
| Réseau SNCF TGV, Intercités et TER (GTFS national) | SNCF Voyageurs | ODbL | `https://www.data.gouv.fr/api/1/datasets/r/9ae758ec-cd7a-40cd-a890-bb3963224942` — 4,0 Mo, `feed_version` 2026-09-04, validité 20260904 → 20270228 |
| Gares de voyageurs du réseau ferré national | SNCF | ODbL | `https://www.data.gouv.fr/api/1/datasets/r/cbacca02-6925-4a46-aab6-7194debbb9b7` — CSV séparateur `;`, 2 782 gares |

Pages PAN : https://transport.data.gouv.fr/datasets/horaires-sncf et https://transport.data.gouv.fr/datasets/gares-de-voyageurs-1

Le CSV « Gares de voyageurs » porte les colonnes `Nom_Gare`, `Trigramme`, `Segment(s) DRG`, `Position géographique`, **`Code commune`** (code INSEE ; **par arrondissement pour Lyon**, et **encore `69152` pour Pierre-Bénite**), **`Code_UIC`**, `Id_Gare`. Le `Code_UIC` est la clé de jointure avec le GTFS SNCF, dont les `stop_id` ont la forme `StopPoint:OCETrain TER-87722405` (les 8 derniers chiffres = code UIC).

---

## 2. Source retenue pour l'indicateur (b) — temps de trajet vers Lyon Part-Dieu

**Il n'existe aucune source officielle publiant, commune par commune, un temps de trajet en transport en commun vers Lyon Part-Dieu.** Ce chiffre doit donc être **calculé** à partir des horaires théoriques, et présenté comme tel.

Deux pistes ont été écartées après test réel :

* **API Navitia** (`https://api.navitia.io/v1/coverage`, `/v1/journeys`) : HTTP **401** sans jeton (`{"message":"no token…"}`). Utilisable uniquement avec une clé nominative — dépendance externe, quota, non reproductible publiquement.
* **GTFS officiel TCL du SYTRAL** (`https://download.data.grandlyon.com/files/rdata/tcl_sytral.tcltheorique/GTFS_TCL.ZIP`, ressource `2f1e1bfc-d378-4e3d-a175-e26f14abc3e6` du jeu « Horaires théoriques du réseau Transports en Commun Lyonnais ») : HTTP **401**. Le téléchargement exige désormais un compte data.grandlyon.com et le jeu est sous **Licence Mobilités** (`other-pd`), pas sous Licence Ouverte. transport.data.gouv.fr le marque `is_available: false` depuis le 22/01/2025, et son historique de sauvegardes s'arrête en 2022.
* L'**agrégat GTFS OùRA! d'Auvergne-Rhône-Alpes** (`https://www.data.gouv.fr/api/1/datasets/r/231acea2-40cf-4c06-b2eb-646274e0b853`, 110 Mo, HTTP 200, ODbL) a été téléchargé et inspecté : son `agency.txt` ne contient **aucune agence TCL**. Il ne peut donc pas servir de repli pour Lyon.

**GTFS effectivement utilisable et testé (HTTP 200, 34,6 Mo) :** la ressource communautaire « GTFS modifié » référencée sur le PAN et sur data.gouv.fr :

```
https://www.data.gouv.fr/api/1/datasets/r/abebedc6-28cf-4e2e-9c64-db57a40156f8
```

(redirige vers `https://gtech-transit-prod.apigee.net/v1/google/gtfs/odbl/lyon_tcl.zip?...`)

Fiche PAN de la ressource : https://transport.data.gouv.fr/resources/81943 — jeu parent : https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transports-en-commun-lyonnais

Contenu vérifié : `feed_info.txt` → `feed_publisher_name = "Google LLC"`, `feed_start_date = 20260830`, `feed_end_date = 20270830` ; fichiers internes datés du **2026-09-04** ; `agency.txt` → `TCL` + `Rhonexpress` ; 8 851 arrêts, 96 523 courses ; les `stop_id` sont identiques aux `id` de la couche `tclarret`.

**Attention : c'est une ressource communautaire publiée par Google, pas une publication du SYTRAL.** C'est le principal point de fragilité de la chaîne de données.

---

## 3. Méthodologie retenue (exécutée et vérifiée le 05/09/2026)

### 3.1 Rattachement commune ↔ arrêt

1. Clé primaire : attribut `insee` de `tcl_sytral.tclarret`.
2. Agrégations obligatoires : `69381`…`69389` → **`69123`** (Lyon) ; `69152` → **`69149`** (Oullins-Pierre-Bénite, commune nouvelle du 01/01/2024).
3. **4 423 arrêts sur 9 730 (45 %) ont `insee = null`** — essentiellement des points d'arrêt scolaires « Junior Direct » en zones 3, 5 et « Zone Externe ». Sur ces 4 423 arrêts, **seuls 20 desservent une ligne régulière**. Ils sont rattachés par **jointure spatiale** avec les contours communaux de `https://geo.api.gouv.fr/communes/{code}?fields=nom,code,contour,population,surface&format=json&geometry=contour` (32 appels, tous HTTP 200).
4. Contrôle croisé (recompté le 05/09/2026) : sur les 5 307 arrêts porteurs d'un `insee`, **157** tombent hors du contour de la commune déclarée, dont **115 pour les seules 32 communes étudiées**, sur les 4 215 arrêts qu'elles portent. Le test porte sur le contour de la commune **agrégée**, c'est-à-dire après l'étape 2 : les neuf arrondissements de Lyon sont testés contre le contour de 69123 et 69152 contre celui de 69149 ; testés chacun contre son propre contour d'arrondissement, on compterait 187 arrêts hors contour. Ce sont des écarts de précision de frontière liés à la simplification des contours de geo.api.gouv.fr. **L'attribut du producteur fait foi ; le spatial ne sert que de repli.**

### 3.2 Comptage des lignes

* Éclater `desserte` sur `,` puis prendre la partie avant `:` → **code commercial** de ligne.
* Joindre au référentiel des lignes (§1.2) **sur l'attribut `ligne`**, pas sur `code_ligne`. Le code affiché est toujours le code commercial public : `NAVI1` pour la navette fluviale, jamais son code interne `7601`.
* **Périmètre retenu pour `nb_lignes_regulieres` (décision produit, périmètre large). La règle ci-dessous est la définition, et elle seule :** sont comptées
  1. toutes les lignes **`code_type_ligne = 'REG'`** ;
  2. **plus** les lignes **sans `code_type_ligne`** qui ont des **courses réelles dans le GTFS TCL** de la semaine de référence.

  Appliquée à l'ensemble du réseau, la clause 2 retient **31 codes** sans type, plus la navette fluviale **NAVI1**. Sur le périmètre des 32 communes, **16 de ces 31 codes seulement sont effectivement rencontrés** — les lignes interurbaines Cars du Rhône / Libellule 102, 165, 211 à 214, 216, 220, 222, 245, 247, 88 et C202 à C205 —, auxquels s'ajoute NAVI1. Les **15 autres** (151 à 156, 164, 217, 237, 239, 240, 241, 243, 265, 285) ont bien des courses dans le GTFS mais **aucun arrêt dans l'une des 32 communes** : vérifié sur les 9 730 arrêts de `tclarret`, y compris les 469 arrêts sans `insee` qui portent l'un de ces codes, dont aucun ne tombe dans un contour des 32 communes. **Cette énumération décrit donc les codes rencontrés sur le périmètre étudié ; elle ne vaut pas définition.**

  Motif : une ligne Cars du Rhône dessert réellement les habitants d'une commune périphérique ; l'exclure sous-estimerait sa desserte. Un comptage limité au `REG` strict donnerait, sur les mêmes données, Brignais 2 au lieu de 8, Givors 4 au lieu de 7, Saint-Genis-Laval 9 au lieu de 15 et Lyon 104 au lieu de 112.
* **Exclusions :** les lignes `JD*` et toutes les lignes typées `SCO` (comptées à part dans une colonne dédiée), les lignes `EVE` (N186, N195), le **transport à la demande `TAD` — la ligne 131, La Tour de Salvagny Gare – Techlid, qui ne doit donc apparaître ni à Dardilly ni à Champagne-au-Mont-d'Or** —, les bus relais de substitution `BR*` et Rhônexpress. **Une exception à signaler :** `BR60` (Perrache – Debourg) porte `code_type_ligne = REG` au référentiel SYTRAL et est pourtant écartée, comme bus relais ; l'énoncé « toutes les lignes `REG` » n'est donc pas absolu. L'exclusion est cohérente avec le traitement des autres `BR*`, mais elle n'est pas neutre : `BR60` dessert 16 arrêts, tous à Lyon 2e et 7e, et la compter porterait **Lyon à 113 lignes régulières au lieu de 112** ; aucune autre commune n'est concernée.
* Sont également écartés les codes lus dans `desserte` qui n'ont ni type ni aucune course dans le GTFS : 161, 215, 218, 219, 231, 235, 236, 238. Un seul d'entre eux touche le périmètre, le **215** (arrêts *Lyon Gare De Vaise G. Collomb* et *Dardilly Porte De Lyon*). Le seul code de `desserte` réellement absent des deux référentiels est **RX** (Rhônexpress).
* Ventiler par `famille_transport` : `MET` (métro), `FUN` (funiculaire), `TRA` (tramway), `BUS`, `BAT` (navette fluviale). La somme des cinq modes doit être égale au nombre total de lignes régulières pour chaque commune.
* Lignes ferroviaires : GTFS SNCF, `routes.txt` filtré sur `route_type = 2`, **restreint aux courses actives à la date de référence (mardi 15 septembre 2026)** — restriction réellement appliquée : elle retire la 632A à Lyon (47 lignes et non 48) et la C18 à Oullins-Pierre-Bénite (1 ligne et non 2). Jointure `stop_id` → code UIC → gare, les gares étant rattachées à leur commune par **géolocalisation** (le `Code commune` du CSV est conservé à titre indicatif : trois gares y sont mal codées, cf. §5).

### 3.3 Temps de trajet — horaire de référence

* **Horaire de référence : mardi 15 septembre 2026, départ 08 h 00** (période scolaire, hors vacances, jour ouvré typique).
* **Origine : la mairie**, fournie par le champ `mairie` de `https://geo.api.gouv.fr/communes/{code}?fields=nom,code,centre,mairie,population,surface` (Point WGS84 ; 32 appels HTTP 200), **avec accès à pied à tous les arrêts situés dans un rayon de 400 m** — et non au seul arrêt le plus proche. Le champ `arret_depart` du JSON nomme l'arrêt le plus proche et sert de repère à l'utilisateur ; il n'est pas le point d'entrée unique du calcul. Les distances mairie → arrêt le plus proche vont de 27 m (Dardilly) à 294 m (Feyzin).
* **Destination : Lyon Part-Dieu**, définie comme l'ensemble des points d'arrêt (`location_type = 0`) nommés `Gare Part-Dieu*` du GTFS TCL — **22 quais**, l'entrée `S5520` du même nom étant une station (`location_type = 1`) et non un quai — plus les **7 points d'arrêt SNCF** rattachés aux codes UIC 87723197 (`Lyon Part Dieu`) et 87697128 (`Lyon-Part-Dieu Gare Routière`) : **29 points au total**.
* **Calculateur : RAPTOR multicritère** (arrivée au plus tôt par nombre de correspondances croissant) sur l'union des deux GTFS, restreinte aux services actifs le 2026-09-15 : **903 services TCL / 21 837 courses actives ce jour-là, dont 20 268 retenues** après exclusion des lignes scolaires, des bus relais et de Rhônexpress → **426 612 connexions** ; **1 800 services SNCF / 10 949 courses → 86 439 connexions** ; **513 051 connexions** au total. Les interdictions de montée et de descente du GTFS (`pickup_type` / `drop_off_type` = 1) sont respectées.
* **Correspondances** : `transfers.txt` du GTFS TCL — 5 108 couples de quais, traités comme **symétriques** : le fichier ne déclare **chaque couple que dans un seul sens** (5 108 couples, 0 réciproque), alors qu'un transfert en gare vaut évidemment dans les deux —, plus une marche à pied générée entre tout couple d'arrêts distants de ≤ 400 m, à 4 km/h, majorée de 60 s ; temps de correspondance minimal de 60 s à un même arrêt ; **un seul saut à pied par correspondance** (l'accès depuis la mairie peut donc être suivi d'une seule marche de 400 m, ce qui permet de démarrer à une gare de la commune voisine, cas de Neuville-sur-Saône).
* **Départage à minute d'arrivée affichée égale** : le départage porte sur la **minute d'arrivée affichée**, pas sur la seconde, puisque l'interface ne montre que la minute. Parmi tous les chemins qui arrivent dans la même minute que le plus rapide, on retient celui qui compte le **moins de correspondances**, puis, à égalité encore, celui dont le **temps de marche est le plus court**. Départager à la seconde revenait à imposer une correspondance pour un gain invisible à l'affichage : à Rillieux-la-Pape, la course C2 `902_C2A-057A£_00201010`, qui passe à l'arrêt *Les Verchères* à 08:07:00 et à *Charpennes* à 08:35:00, atteint le quai `Gare Part-Dieu` `35834` à 08:42:00 sans aucune correspondance, tandis que le « C2 > B » publié arrivait à 08:41:50, dix secondes plus tôt — les deux affichent **42 min** ; c'est désormais « C2 », à 0 correspondance, qui est publié. `itineraire_8h` et `nb_correspondances_8h` étant **affichés à l'utilisateur**, aucune ligne n'y apparaît deux fois.
* Le temps affiché est **heure d'arrivée à Part-Dieu − 08 h 00**, arrondi à la minute, marche d'accès et temps d'attente compris. C'est le temps du **trajet le plus rapide**, quel que soit le nombre de correspondances qu'il demande : à Dardilly, les 55 minutes du départ de 8 h 00 passent par `103 > C6 > 110 > D > B`, soit 4 correspondances, alors que `103 > D > B`, à 2 correspondances, arrive en 57 minutes. L'algorithme n'est pas modifié ; c'est la promesse qui l'est — le chiffre publié est celui du trajet le plus rapide, pas celui d'un trajet choisi pour sa simplicité.

---

## 4. Résultat vérifié au 05/09/2026 (32/32 communes, aucune valeur manquante)

Ce tableau est le **reflet exact de `data/raw/transports.json`** : mêmes champs, mêmes valeurs. La colonne « Lignes régulières » applique le **périmètre large** défini au §3.2 (REG + interurbaines Cars du Rhône / Libellule exploitées + navette fluviale) ; la colonne « Lignes ferroviaires » applique la **restriction aux courses du 15/09/2026**.

| Code INSEE | Commune | Arrêts TCL | Lignes régulières | métro | funi. | tram | bus | fluvial | Lignes scolaires JD | Lignes ferroviaires | 8h00 (min) | médiane 7h30-9h00 (min) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 69123 | Lyon | 1196 | 112 | 4 | 2 | 6 | 99 | 1 | 59 | 47 | 15 | 14 |
| 69266 | Villeurbanne | 253 | 31 | 2 | 0 | 4 | 25 | 0 | 8 | 0 | 13 | 15 |
| 69259 | Vénissieux | 232 | 21 | 1 | 0 | 1 | 19 | 0 | 9 | 2 | 34 | 30 |
| 69256 | Vaulx-en-Velin | 166 | 27 | 1 | 0 | 2 | 24 | 0 | 7 | 0 | 34 | 33 |
| 69290 | Saint-Priest | 235 | 17 | 0 | 0 | 1 | 16 | 0 | 9 | 1 | 37 | 42 |
| 69034 | Caluire-et-Cuire | 156 | 17 | 1 | 0 | 0 | 16 | 0 | 12 | 0 | 38 | 36 |
| 69029 | Bron | 170 | 19 | 0 | 0 | 3 | 16 | 0 | 8 | 0 | 27 | 26 |
| 69149 | Oullins-Pierre-Bénite | 126 | 19 | 1 | 0 | 0 | 18 | 0 | 20 | 1 | 19 | 18 |
| 69282 | Meyzieu | 139 | 8 | 0 | 0 | 1 | 7 | 0 | 12 | 0 | 44 | 41 |
| 69286 | Rillieux-la-Pape | 114 | 10 | 0 | 0 | 0 | 10 | 0 | 6 | 1 | 42 | 37 |
| 69275 | Décines-Charpieu | 125 | 13 | 0 | 0 | 2 | 11 | 0 | 6 | 0 | 28 | 27 |
| 69244 | Tassin-la-Demi-Lune | 99 | 18 | 0 | 0 | 0 | 18 | 0 | 16 | 3 | 33 | 31 |
| 69202 | Sainte-Foy-lès-Lyon | 97 | 13 | 0 | 0 | 0 | 13 | 0 | 5 | 0 | 39 | 39 |
| 69091 | Givors | 113 | 7 | 0 | 0 | 0 | 7 | 0 | 13 | 3 | 36 | 41 |
| 69204 | Saint-Genis-Laval | 169 | 15 | 1 | 0 | 0 | 14 | 0 | 22 | 0 | 31 | 30 |
| 69199 | Saint-Fons | 56 | 4 | 0 | 0 | 0 | 4 | 0 | 9 | 1 | 39 | 30 |
| 69081 | Écully | 111 | 11 | 0 | 0 | 0 | 11 | 0 | 21 | 1 | 39 | 40 |
| 69089 | Francheville | 52 | 7 | 0 | 0 | 0 | 7 | 0 | 9 | 1 | 57 | 48 |
| 69283 | Mions | 66 | 5 | 0 | 0 | 0 | 5 | 0 | 6 | 0 | 65 | 58 |
| 69277 | Genas | 72 | 5 | 0 | 0 | 0 | 5 | 0 | 20 | 0 | 50 | 53 |
| 69027 | Brignais | 59 | 8 | 0 | 0 | 0 | 8 | 0 | 7 | 1 | 47 | 44 |
| 69069 | Craponne | 40 | 5 | 0 | 0 | 0 | 5 | 0 | 13 | 0 | 51 | 48 |
| 69273 | Corbas | 104 | 7 | 0 | 0 | 0 | 7 | 0 | 6 | 0 | 37 | 39 |
| 69271 | Chassieu | 80 | 6 | 0 | 0 | 1 | 5 | 0 | 6 | 0 | 39 | 47 |
| 69276 | Feyzin | 39 | 5 | 0 | 0 | 0 | 5 | 0 | 8 | 1 | 43 | 48 |
| 69072 | Dardilly | 98 | 8 | 0 | 0 | 0 | 8 | 0 | 16 | 1 | 55 | 55 |
| 69100 | Irigny | 48 | 3 | 0 | 0 | 0 | 3 | 0 | 9 | 1 | 37 | 42 |
| 69143 | Neuville-sur-Saône | 53 | 8 | 0 | 0 | 0 | 8 | 0 | 24 | 0 | 26 | 43 |
| 69142 | La Mulatière | 41 | 8 | 0 | 0 | 0 | 8 | 0 | 11 | 0 | 35 | 34 |
| 69191 | Saint-Cyr-au-Mont-d'Or | 54 | 7 | 0 | 0 | 0 | 7 | 0 | 16 | 0 | 53 | 50 |
| 69040 | Champagne-au-Mont-d'Or | 36 | 7 | 0 | 0 | 0 | 7 | 0 | 12 | 0 | 35 | 38 |
| 69044 | Charbonnières-les-Bains | 42 | 6 | 0 | 0 | 0 | 6 | 0 | 20 | 2 | 41 | 48 |

Contrôles de cohérence passés sur les 32 communes : la somme des cinq modes (métro + funiculaire + tramway + bus + fluvial) égale le nombre de lignes régulières ; la longueur de `lignes_regulieres` égale ce même nombre ; `nb_correspondances_8h` égale le nombre de lignes de `itineraire_8h` moins une, sans ligne répétée ; le temps de 8 h 00 et la médiane tombent entre le minimum et le maximum des 19 départs. Lyon 4 métros + 2 funiculaires ; Villeurbanne 2 métros (A, B) ; Vaulx-en-Velin, Vénissieux, Caluire-et-Cuire, Oullins-Pierre-Bénite et Saint-Genis-Laval 1 métro chacune (respectivement A, D, C, B et B prolongée aux Hôpitaux Sud).

*Le réseau TCL est unifié avec les Cars du Rhône et Libellule depuis le 1er septembre 2025 : les lignes des anciens réseaux interurbains figurent désormais dans `tclarret`, ce qui explique que Genas et Brignais, hors Métropole de Lyon, y soient présentes — et c'est aussi la raison pour laquelle elles sont comptées.*

---

## 5. Limites à afficher à l'utilisateur final

1. **Le nombre de lignes n'est pas une mesure de qualité de desserte.** Une commune traversée par 5 lignes de bus à 3 passages par jour est moins bien desservie qu'une commune avec 2 lignes de métro. La fréquence n'entre pas dans l'indicateur (a).
2. **« Ligne desservant la commune » = au moins un arrêt dans la commune.** Une ligne qui ne fait que traverser sans s'arrêter n'est pas comptée ; une ligne qui n'a qu'un arrêt en limite communale compte autant qu'une ligne qui traverse toute la commune.
3. **Lignes scolaires exclues du chiffre principal.** Les 588 lignes « Junior Direct » ne circulent qu'en période scolaire, à des horaires réservés aux élèves ; elles sont comptées dans une colonne à part.
4. **Lyon est un cas particulier.** Les données SYTRAL et SNCF codent Lyon par arrondissement (69381-69389) ; le chiffre affiché pour Lyon est l'agrégat des 9 arrondissements. Idem pour Oullins-Pierre-Bénite, dont les données antérieures à 2024 sont réparties entre 69149 et 69152.
5. **45 % des points d'arrêt n'ont pas de code INSEE dans la source ;** ils sont rattachés par géolocalisation. L'impact sur les lignes régulières est marginal (20 arrêts concernés sur 9 730) mais il existe.
6. **Le temps de trajet est un temps théorique calculé, pas une mesure de terrain.** Il repose sur les horaires publiés, pour un **départ précis à 8 h 00 un mardi de période scolaire**. Il ne tient compte ni des retards, ni des travaux, ni de la charge des rames, ni des grèves. Un départ à 8 h 10 peut donner un résultat sensiblement différent sur les lignes à faible fréquence.
7. **Le point de départ est la mairie, pas votre futur logement.** Dans les communes étendues (Givors, Meyzieu, Genas, Dardilly, Corbas), le temps depuis un quartier périphérique peut dépasser de 15 à 25 minutes la valeur affichée. À l'inverse, le meilleur arrêt de la commune donne souvent 10 à 20 minutes de moins que la mairie — exemple mesuré : Vaulx-en-Velin, 34 min depuis la mairie contre 17 min depuis le meilleur arrêt.
8. **La destination est Lyon Part-Dieu**, choisie comme premier pôle d'emploi et hub ferroviaire. Pour quelqu'un qui travaille à Perrache, à la Confluence, à Écully ou à Gerland, le classement des communes serait différent.
9. **Le GTFS d'horaires utilisé n'est pas publié par le SYTRAL** mais par Google, en ressource communautaire sur data.gouv.fr. Le GTFS officiel du SYTRAL est passé sous Licence Mobilités avec authentification obligatoire. Si ce miroir cesse d'être publié, l'indicateur (b) tombe.
10. **Modes non pris en compte** : Rhônexpress (navette aéroport à tarif spécifique) est présent dans le GTFS mais n'est pas compté comme ligne TCL régulière ; les lignes événementielles, le transport à la demande (ligne 131) et les bus relais de substitution non plus ; le vélo, l'autopartage et le covoiturage ne sont pas pris en compte.
11. **Périmètre hors Métropole** : Genas (CC de l'Est Lyonnais) et Brignais (CC de la Vallée du Garon) ne font pas partie de la Métropole de Lyon mais sont bien desservies par le réseau TCL unifié ; elles sont traitées comme les autres.
12. **Le décompte inclut les lignes interurbaines.** Les lignes Cars du Rhône et Libellule reprises par le réseau unifié comptent comme lignes régulières, alors que le référentiel SYTRAL ne leur attribue aucun type. C'est un choix assumé, favorable aux communes périphériques : sans lui, Brignais afficherait 2 lignes au lieu de 8 et Saint-Genis-Laval 9 au lieu de 15.
13. **L'itinéraire affiché est le plus simple à minute d'arrivée affichée égale**, pas le seul possible : parmi les chemins qui arrivent dans la même minute que le plus rapide, on montre celui qui compte le moins de correspondances, puis le moins de marche. Le départage se fait sur la minute et non sur la seconde, parce que l'utilisateur ne voit que la minute ; un autre chemin de même durée affichée peut convenir aussi bien.
14. **Le décompte ferroviaire est daté.** Il ne retient que les relations qui circulent effectivement le mardi 15 septembre 2026 : une ligne saisonnière ou hebdomadaire absente ce jour-là n'apparaît pas.
15. **Le temps affiché est celui du trajet le plus rapide, pas du plus simple.** Il peut enchaîner plusieurs correspondances pour un gain de quelques minutes : à Dardilly, les 55 minutes du départ de 8 h 00 demandent 4 correspondances quand `103 > D > B`, à 2 correspondances, arrive en 57 minutes. Même écart de 2 à 4 minutes à Sainte-Foy-lès-Lyon (39 min à 3 correspondances contre 41 min à 1), Écully (39 contre 43 à 2), Charbonnières-les-Bains (41 contre 45 à 2) et Saint-Cyr-au-Mont-d'Or (53 contre 57 à 2). C'est une information utile à qui déménage : l'itinéraire simple existe, et il coûte rarement plus de quelques minutes.
16. **`BR60` est une exception au périmètre `REG`.** Elle est typée `REG` au référentiel SYTRAL mais écartée comme bus relais de substitution ; sans cette exclusion, Lyon afficherait 113 lignes régulières au lieu de 112.

---

## 6. Recommandation de source définitive pour la production

**Indicateur (a) — nombre de lignes : `sytral:tcl_sytral.tclarret` plus les couches « lignes » (`tcllignebus_2_0_0`, `tcllignemf_2_0_0`, `tcllignetram_2_0_0`, `tcllignefluv`), via le WFS `data.grandlyon.com/geoserver/sytral/ows`, référencées sur data.gouv.fr sous Licence Ouverte v2.0 et mises à jour quotidiennement.** Source ouverte, sans authentification, légère (~5 Mo), portant nativement le code INSEE, publiée par l'autorité organisatrice elle-même. À compléter par le GTFS SNCF national et le CSV « Gares de voyageurs » pour la desserte ferroviaire.

**Indicateur (b) — temps de trajet : calcul Connection Scan sur l'union du GTFS TCL (ressource communautaire data.gouv.fr `abebedc6-28cf-4e2e-9c64-db57a40156f8`) et du GTFS SNCF national, à horaire de référence figé et affiché à l'utilisateur.** Faute de source officielle de temps de parcours commune → Part-Dieu, c'est la seule option reproductible et gratuite.

**Point de vigilance à surveiller : la disponibilité du GTFS TCL.** Si la ressource Google disparaît, les replis sont, dans l'ordre :

1. ouvrir un compte data.grandlyon.com et utiliser le GTFS officiel du SYTRAL sous Licence Mobilités (attention : conditions de réutilisation différentes de la Licence Ouverte) ;
2. obtenir un jeton Navitia et appeler `/v1/journeys` sur la couverture `fr-se` ;
3. dégrader l'indicateur (b) en indicateur de proximité aux modes lourds (présence de métro / tramway / gare TER dans la commune), calculable avec la seule couche `tclarret`, qui reste ouverte.

---

## 7. Nouvelle mesure (2026-09-06) — distance mairie ↔ gare la plus proche

Le point 3 ci-dessus s'est concrétisé : le critère « Transports » abandonne l'indicateur (b) (temps de trajet théorique vers Lyon Part-Dieu, jugé trop spécifique à un seul pôle d'emploi) au profit d'une mesure plus simple et plus générale — la commune a-t-elle une gare, et sinon, à quelle distance est la plus proche ? Résultat écrit dans `data/raw/transports-gare-proche.json`, distinct de `transports.json` (qui garde `nb_gares_ferroviaires` et `gares` pour le contrôle de cohérence).

**Source :** même CSV « Gares de voyageurs du réseau ferré national » que le §1.3 (`https://www.data.gouv.fr/api/1/datasets/r/cbacca02-6925-4a46-aab6-7194debbb9b7`, séparateur `;`, ODbL, producteur SNCF Gares & Connexions). Retéléchargé le 2026-09-06 (HTTP 200, 263 847 octets, 2 782 gares) et reparsé en tenant compte des guillemets du champ `Segment(s) DRG` qui contient parfois des `;` littéraux (9 gares concernées — Aéroport CDG 2 TGV, Avignon TGV, Châteaubriant, Ermont-Eaubonne, Mareil-Marly, Paris Austerlitz, Paris Gare de Lyon, Paris Gare du Nord, Paris Montparnasse — toutes hors de la zone d'étude, donc sans effet sur le résultat, mais un parseur naïf par simple `split(';')` les aurait silencieusement exclues). Métadonnées vérifiées le même jour via `https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/` (HTTP 200) : `modified = 2026-09-05T12:43:06+00:00`, `records_count = 2782` — cohérent avec le nombre de lignes du CSV téléchargé. Flux vivant, pas de millésime figé.

**Point mairie :** `https://geo.api.gouv.fr/communes/{code}?fields=nom,code,mairie`, soit exactement la même source (`geo.api.gouv.fr`, champ `mairie`) que celle utilisée pour `distance_mairie_arret_m` au §3.3, afin que les deux mesures « à vol d'oiseau depuis la mairie » restent comparables entre elles. 32 appels HTTP réalisés le 2026-09-06, 32 réponses HTTP 200. Le champ `mairie` est un point GeoJSON `{coordinates:[lon,lat]}` — coordonnées relues et réordonnées avant le calcul.

**Méthode :** pour chacune des 32 communes, distance de haversine (rayon 6 371 km) entre le point mairie et **chacune** des 2 782 gares du fichier national, sans restriction au Rhône — une commune en bordure de zone (Meyzieu, Genas) peut avoir sa gare la plus proche dans l'Ain ou l'Isère. On retient le minimum.

**Rattachement « gare dans la commune » — comparaison sur le `Code commune` brut du CSV**, avec les deux pièges déjà documentés au §1.3 et gérés explicitement dans le code de comparaison :
- un `Code commune` parmi `69381`-`69389` (arrondissements municipaux) compte comme « dans Lyon » quand la commune cible est `69123` ;
- un `Code commune` `69152` (Pierre-Bénite — code retiré du référentiel des communes depuis la fusion du 1er janvier 2024, mais conservé tel quel dans le CSV SNCF, non mis à jour vers `69149`) compte comme « dans la commune » quand la cible est `69149` (Oullins-Pierre-Bénite).

**Différence assumée avec `nb_gares_ferroviaires` :** cette nouvelle mesure compare le `Code commune` **déclaré** par le CSV (plus les deux exceptions ci-dessus), alors que `nb_gares_ferroviaires` (§3.2 et caveat) rattache chaque gare à sa commune par **géolocalisation** (point dans le contour communal), ce qui corrige trois gares mal codées dans le fichier source : *Dardilly Les Mouilles* (`Code commune = 69072`, mais géolocalisée à Écully), *Le Méridien La Ferrière* (rattachée à Charbonnières-les-Bains) et *Sérézin-du-Rhône* (codée en Feyzin mais hors périmètre). Les deux méthodes divergent donc nécessairement chaque fois qu'une gare est mal codée dans le CSV — c'est le cas relevé au contrôle de cohérence ci-dessous.

**Vérifications ciblées :**
- **Lyon (69123)** : gare la plus proche trouvée = **Lyon Saint-Paul** (`Code commune = 69385`, Lyon 5e arrondissement), à **641 m** de la mairie. Le rattachement 69381-69389 → 69123 fonctionne : `dansLaCommune = true`.
- **Oullins-Pierre-Bénite (69149)** : gare la plus proche = **Oullins** (`Code commune = 69149` directement, sans avoir besoin de l'exception), à **581 m** de la mairie. L'exception 69152 → 69149 est bien implémentée dans le code (testée unitairement sur la logique de comparaison) même si ce n'est pas elle qui est déclenchée ici puisque Oullins est plus proche que Pierre-Bénite depuis cette mairie précise.

**Contrôle de cohérence avec `nb_gares_ferroviaires` (transports.json) : 31/32.** Un seul désaccord, expliqué et non masqué :

| Code | Commune | `dansLaCommune` (nouvelle mesure) | `nb_gares_ferroviaires` | Explication |
|---|---|---|---|---|
| 69081 | Écully | `false` (gare la plus proche : *Ecully - Tassin*, à 1 101 m, `Code commune = 69244` Tassin-la-Demi-Lune) | 1 (gare *Dardilly Les Mouilles*) | Désaccord méthodologique attendu, déjà signalé au caveat du §5 : la gare la plus proche de la mairie d'Écully au sens du `Code commune` brut est *Ecully - Tassin*, codée à Tassin-la-Demi-Lune malgré son nom ; ce n'est donc pas « dans » Écully au sens de cette mesure. `nb_gares_ferroviaires` compte 1 gare pour Écully parce que *Dardilly Les Mouilles* (`Code commune = 69072`, distincte de la précédente, à 2,76 km de la mairie et donc pas la plus proche) est géolocalisée dans le contour d'Écully. Les deux chiffres portent donc sur deux gares différentes et deux définitions différentes de « dans la commune » — aucune erreur de calcul, un choix méthodologique documenté des deux côtés. |

Les 31 autres communes concordent exactement (`dansLaCommune = true` ⟺ `nb_gares_ferroviaires > 0`).

**Distribution des 32 distances mairie → gare la plus proche :** minimum **315 m** (Saint-Fons), maximum **7 227 m** (Meyzieu, dont la gare la plus proche, Saint-Maurice-de-Beynost, est dans l'Ain). **14 communes sur 32** ont leur gare la plus proche située dans leur propre territoire (au sens `Code commune`) : Lyon, Oullins-Pierre-Bénite, Vénissieux, Saint-Priest, Tassin-la-Demi-Lune, Givors, Saint-Fons, Francheville, Brignais, Feyzin, Dardilly, Irigny, Rillieux-la-Pape, Charbonnières-les-Bains.

**Limite à afficher :** comme pour `distance_mairie_arret_m`, c'est une distance à vol d'oiseau depuis la mairie, pas un temps de trajet ni une distance piétonne réelle ; elle ne dit rien de la fréquence des trains qui desservent cette gare.
