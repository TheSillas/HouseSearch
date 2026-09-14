# Sécurité — délinquance enregistrée pour 1 000 habitants

Clé technique : `securite`
Note rédigée le 2026-09-05. Toutes les valeurs et métadonnées ci-dessous proviennent de requêtes HTTP réellement exécutées sur data.gouv.fr / tabular-api.data.gouv.fr à cette date.

## 1. Source retenue

| | |
|---|---|
| **Jeu de données** | Bases statistiques communale, départementale et régionale de la délinquance enregistrée par la police et la gendarmerie nationales |
| **Producteur** | SSMSI — Service statistique ministériel de la sécurité intérieure (Ministère de l'Intérieur) |
| **Page officielle** | https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales |
| **API métadonnées** | https://www.data.gouv.fr/api/1/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/ |
| **Identifiant dataset** | `621df2954fa5a3b5a023e23c` |
| **Millésime de données** | **2025** (année la plus récente ; `temporal_coverage` = 2016-01-01 → 2025-12-31) |
| **Édition / production** | fichier produit le 2026-06-25, publié le 2026-07-09 (`last_update` = 2026-07-09T12:01:37Z) |
| **Géographie communale** | Code Officiel Géographique au **1er janvier 2026** |
| **Licence** | Licence Ouverte / Open Licence version 2.0 (`lov2`) — https://www.etalab.gouv.fr/licence-ouverte-open-licence |
| **Fréquence de mise à jour** | annuelle (`frequency: annual`). En pratique : publication de juillet = données définitives de l'année N-1 + bascule sur la nouvelle géographie communale ; publications intermédiaires en janvier / mars (atlas départemental, ajout d'indicateurs, révisions). |

### Ressources vérifiées (HTTP 200 obtenu le 2026-09-05)

| Ressource | `resource_id` | Format | Taille | URL |
|---|---|---|---|---|
| COM — base communale (csv compressé) | `44ef4323-1097-48d5-8719-3c544b55d294` | csv.gz | 39,9 Mo | https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260709-115942/donnee-data.gouv-2025-geographie2026-produit-le2026-06-25.csv.gz |
| COM — base communale (parquet) | `604d71b8-337d-4869-9226-49e01bae87df` | parquet | 16,1 Mo | https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260709-120017/donnee-comm-data.gouv-parquet-2025-geographie2026-produit-le2026-06-25.parquet |
| COM COMPL — zonages + zone de compétence police/gendarmerie | `a2af06fc-ba6c-4e6c-a69a-ac222817c93f` | xlsx | 3,8 Mo | https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260709-115833/info-complements-data.gouv-2025-geographie2026-produit-le2026-06-25.xlsx |
| Documentation méthodologique | `5e6dd067-3bba-45e3-b7ad-ed8c673bea5b` | pdf | 277 Ko | https://static.data.gouv.fr/resources/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/20260709-120136/fichier-metadonnees-data-gouv-geographie-delinquance-juillet2026.pdf |

**Attention** : les `resource_id` ne sont pas éternels (le csv.gz actuel a été `created_at` le 2026-03-26). Il faut les re-résoudre via l'API du dataset à chaque rafraîchissement, en filtrant sur `title` commençant par « COM - Base statistique communale » et `format == "csv.gz"`.

## 2. Structure du fichier communal

CSV : séparateur `;`, champs entre guillemets doubles, **décimale = virgule**, valeur manquante = `NA` (non quotée), encodage UTF-8. 5 238 000 lignes (format long : 1 ligne = commune x année x indicateur).

| Colonne | Contenu |
|---|---|
| `CODGEO_2026` | code INSEE commune. Le suffixe suit le millésime de géographie (`CODGEO_2025` en 2025, `CODGEO_2026` en 2026) : **à détecter dynamiquement** |
| `annee` | année d'enregistrement des faits (2016 → 2025) |
| `indicateur` | libellé de l'indicateur (15 en base communale) |
| `unite_de_compte` | Victime / Victime entendue / Infraction / Véhicule / Mis en cause |
| `nombre` | nombre de faits enregistrés (dans l'unité de compte de l'indicateur) |
| `taux_pour_mille` | **valeur pour 1 000 habitants, sauf « Cambriolages de logement » = pour 1 000 logements** |
| `est_diffuse` | `diff` (valeur publiée) ou `ndiff` (secret statistique → `nombre` et `taux_pour_mille` valent `NA`) |
| `insee_pop` / `insee_pop_millesime` | population municipale du recensement (millésime **2023** dans l'édition 2026) |
| `insee_log` / `insee_log_millesime` | nombre de logements du recensement (millésime **2022**) |
| `complement_info_nombre` / `complement_info_taux` | **moyenne départementale des communes sous secret statistique** — ce n'est PAS une valeur communale, ne jamais l'utiliser pour combler un `ndiff` |

### Les 15 indicateurs de la base communale (millésime 2025)

| Indicateur | Unité de compte | Dénominateur du taux |
|---|---|---|
| Violences physiques intrafamiliales | Victime | 1 000 hab. |
| Violences physiques hors cadre familial | Victime | 1 000 hab. |
| Violences sexuelles | Victime | 1 000 hab. |
| Vols avec armes | Infraction | 1 000 hab. |
| Vols violents sans arme | Infraction | 1 000 hab. |
| Vols sans violence contre des personnes | Victime entendue | 1 000 hab. |
| **Cambriolages de logement** | Infraction | **1 000 logements** |
| Vols de véhicule | Véhicule | 1 000 hab. |
| Vols dans les véhicules | Véhicule | 1 000 hab. |
| Vols d'accessoires sur véhicules | Véhicule | 1 000 hab. |
| Destructions et dégradations volontaires | Infraction | 1 000 hab. |
| Usage de stupéfiants | Mis en cause | 1 000 hab. |
| Usage de stupéfiants (AFD) | Mis en cause | 1 000 hab. |
| Trafic de stupéfiants | Mis en cause | 1 000 hab. |
| Escroqueries et fraudes aux moyens de paiement | Victime | 1 000 hab. |

Note : l'indicateur historique « coups et blessures volontaires sur personne de 15 ans ou plus » a été **supprimé en juillet 2025** et remplacé par « violences physiques intrafamiliales » + « violences physiques hors cadre familial ». Le total des violences physiques = somme de ces deux indicateurs (seul agrégat explicitement autorisé par le SSMSI, même unité de compte).

## 3. Méthodologie du producteur

- Champ : crimes et délits enregistrés pour la première fois par la police et la gendarmerie nationales (hors contraventions et délits routiers), issus de l'état 4001 retraité par le SSMSI.
- Territorialisation **selon le lieu de commission des faits** — sauf « Escroqueries et fraudes aux moyens de paiement », comptabilisées **au lieu de résidence de la victime** (une large part de ces faits a lieu sur internet).
- Comptage arrêté début avril de l'année suivante, requalifications judiciaires (y compris suppressions) prises en compte jusqu'à cette date.
- Indicateurs stupéfiants = **mis en cause** dont l'infraction a été élucidée ; un mis en cause n'est compté qu'une fois par unité spatiale, donc **ces indicateurs ne sont pas additifs entre échelons territoriaux**.
- Faits sans commune de commission renseignée (moins de 1 % en 2021) : imputation par tirage aléatoire pondéré par le volume d'infractions de chaque commune.
- Secret statistique : « Les données diffusées sont limitées aux communes pour lesquelles plus de 5 faits ont été enregistrés pendant 3 années successives. » → `est_diffuse = "ndiff"`, `nombre` et `taux_pour_mille` à `NA`.
- Zone de compétence : ZPN (police nationale) ou ZGN (gendarmerie nationale), donnée dans le fichier COM COMPL (colonne `zone_competence`).

## 4. Raccordement aux 32 communes du référentiel

Vérifié le 2026-09-05 : **les 32 communes sont présentes, avec les 15 indicateurs, pour l'année 2025.**

- **Lyon** : utiliser **69123** (commune entière). Le fichier contient AUSSI les 9 arrondissements (69381 → 69389, vérifié sur 69381). **Ne jamais additionner 69123 et ses arrondissements** : le SSMSI a lui-même publié un rectificatif en juin 2022 après avoir doublé la population de Lyon/Paris/Marseille dans les taux départementaux. `insee_pop` renvoyée pour 69123 = **519 127** (PMUN 2023), identique à `geo.api.gouv.fr/communes/69123`.
- **Oullins-Pierre-Bénite** : le code **69152** (Pierre-Bénite) **n'existe plus** dans le fichier (géographie 2026 ; requête tabular-api → 0 ligne ; `geo.api.gouv.fr/communes/69152` → HTTP 404). Le code **69149** porte déjà le périmètre fusionné : `insee_pop` = **38 168**. Aucune agrégation à faire. Le SSMSI rétropole tout l'historique 2016-2025 sur la géographie courante : 69149 contient donc déjà l'historique fusionné, ne pas ré-additionner.
- Les changements de département de 1968 (Saint-Priest, Meyzieu, Décines, Mions, Genas, Corbas, Chassieu, Feyzin, Rillieux) sont sans effet ici : le fichier ne remonte qu'à 2016.
- Jointure **uniquement sur le code INSEE**. Les libellés officiels du fichier COM COMPL sont accentués : `Écully`, `Sainte-Foy-lès-Lyon`, `La Mulatière`, `Neuville-sur-Saône`, `Saint-Cyr-au-Mont-d'Or`, `Champagne-au-Mont-d'Or`, `Charbonnières-les-Bains`, `Décines-Charpieu`, `Vénissieux`, `Oullins-Pierre-Bénite`.

### Couverture du secret statistique (année 2025, valeurs réellement lues)

| Commune | INSEE | pop. 2023 | log. 2022 | Indicateurs masqués (`ndiff`) |
|---|---|---|---|---|
| Lyon | 69123 | 519 127 | 318 612 | 0 |
| Villeurbanne | 69266 | 163 684 | 91 641 | 0 |
| Vénissieux | 69259 | 65 502 | 30 188 | 0 |
| Vaulx-en-Velin | 69256 | 53 069 | 20 782 | 0 |
| Saint-Priest | 69290 | 49 229 | 22 752 | 0 |
| Caluire-et-Cuire | 69034 | 43 597 | 23 277 | 1 — Vols avec armes |
| Bron | 69029 | 42 982 | 19 938 | 1 — Vols avec armes |
| Oullins-Pierre-Bénite | 69149 | 38 168 | 19 575 | 1 — Vols avec armes |
| Meyzieu | 69282 | 36 687 | 15 355 | 1 — Vols avec armes |
| Rillieux-la-Pape | 69286 | 31 389 | 13 396 | 1 — Vols avec armes |
| Décines-Charpieu | 69275 | 29 877 | 13 764 | 1 — Vols avec armes |
| Tassin-la-Demi-Lune | 69244 | 23 200 | 11 663 | 1 — Vols avec armes |
| Sainte-Foy-lès-Lyon | 69202 | 21 692 | 10 788 | 3 — Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| Givors | 69091 | 21 379 | 9 261 | 1 — Vols avec armes |
| Saint-Genis-Laval | 69204 | 21 212 | 9 822 | 2 — Vols avec armes ; Trafic de stupéfiants |
| Saint-Fons | 69199 | 19 285 | 8 168 | 2 — Vols avec armes ; Trafic de stupéfiants |
| Écully | 69081 | 17 944 | 9 126 | 2 — Vols avec armes ; Trafic de stupéfiants |
| Francheville | 69089 | 15 604 | 6 634 | 2 — Vols avec armes ; Trafic de stupéfiants |
| Mions | 69283 | 13 843 | 5 595 | 3 — Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| Genas | 69277 | 13 421 | 5 689 | 3 — Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| Brignais | 69027 | 12 503 | 5 814 | 2 — Vols violents sans arme ; Trafic de stupéfiants |
| Craponne | 69069 | 12 084 | 5 902 | 3 — Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| Corbas | 69273 | 11 315 | 4 386 | 2 — Vols avec armes ; Vols violents sans arme |
| Chassieu | 69271 | 11 208 | 4 747 | 4 — Vols avec armes ; Vols violents sans arme ; Usage de stupéfiants (AFD) ; Trafic de stupéfiants |
| Feyzin | 69276 | 10 304 | 4 510 | 2 — Vols avec armes ; Trafic de stupéfiants |
| Dardilly | 69072 | 9 221 | 4 006 | 3 — Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| Irigny | 69100 | 9 034 | 3 846 | 3 — Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| Neuville-sur-Saône | 69143 | 7 812 | 4 275 | 3 — Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| La Mulatière | 69142 | 6 534 | 3 721 | 2 — Vols avec armes ; Trafic de stupéfiants |
| Saint-Cyr-au-Mont-d'Or | 69191 | 6 327 | 2 957 | 2 — Vols violents sans arme ; Trafic de stupéfiants |
| Champagne-au-Mont-d'Or | 69040 | 6 311 | 3 164 | 4 — Violences sexuelles ; Vols avec armes ; Vols violents sans arme ; Trafic de stupéfiants |
| Charbonnières-les-Bains | 69044 | 5 383 | 2 677 | 5 — Violences sexuelles ; Vols avec armes ; Vols violents sans arme ; Vols d'accessoires sur véhicules ; Trafic de stupéfiants |

Total : 60 cellules masquées sur 480 (32 communes x 15 indicateurs), soit 12,5 %. Aucune commune n'est intégralement masquée. Les 7 indicateurs « socles » (violences physiques intrafamiliales, violences physiques hors cadre familial, vols sans violence contre des personnes, cambriolages de logement, vols de véhicule, vols dans les véhicules, destructions et dégradations volontaires) sont **diffusés pour les 32 communes**.

### Extrait de valeurs réellement lues (année 2025, taux pour mille)

| Commune | Viol. phys. intrafam. | Viol. phys. hors fam. | Viol. sexuelles | Vols sans violence | Cambriolages (‰ log.) | Vols de véhicule | Destr. & dégrad. |
|---|---|---|---|---|---|---|---|
| Lyon (69123) | 2,85 | 5,31 | 2,38 | 39,32 | 6,88 | 2,88 | 11,19 |
| Villeurbanne (69266) | 3,65 | 3,81 | 1,69 | 18,46 | 5,70 | 2,83 | 14,82 |
| Vénissieux (69259) | 5,19 | 6,38 | 2,14 | 16,75 | 6,23 | 4,24 | 16,05 |
| Écully (69081) | 1,62 | 1,95 | 1,06 | 10,81 | 7,78 | 2,17 | 8,42 |
| Chassieu (69271) | 1,78 | 3,12 | 0,71 | 13,74 | 16,64 | 5,44 | 9,64 |
| Charbonnières-les-Bains (69044) | 2,79 | 1,11 | *ndiff* | 5,76 | 15,31 | 1,49 | 6,50 |

Contrôle de cohérence effectué : pour Lyon, `nombre / insee_pop * 1000` reproduit exactement `taux_pour_mille` pour 14 indicateurs sur 15 ; pour « Cambriolages de logement », c'est `nombre / insee_log * 1000` (2 191 / 318 612 x 1 000 = 6,8767) qui reproduit la valeur publiée.

## 5. Limites à afficher à l'utilisateur final

1. **Faits enregistrés ≠ délinquance réelle.** Seules les infractions portées à la connaissance de la police ou de la gendarmerie sont comptées. Le SSMSI rappelle qu'en moyenne 2011-2018, seules 12 % des victimes de violences sexuelles hors ménage portaient plainte, contre 74 % des victimes de cambriolage. Un taux faible peut refléter un moindre recours à la plainte autant qu'une moindre délinquance.
2. **Comptage au lieu de commission, pas au lieu de résidence.** Les communes à forte attractivité commerciale, tertiaire, festive ou touristique — hypercentre de Lyon, grands centres commerciaux (Part-Dieu, Confluence, Écully, Porte des Alpes à Saint-Priest/Bron), zones d'activité de Chassieu ou Genas, gares, aéroport — enregistrent mécaniquement des faits commis au détriment de non-résidents. Rapportés à leur seule population résidente, leurs taux sont **surestimés** par rapport au risque réellement encouru par un habitant. C'est très visible sur « Vols sans violence contre des personnes » : 39,3 ‰ à Lyon, soit plus du double de Villeurbanne (18,5 ‰).
3. **Exception : les escroqueries et fraudes aux moyens de paiement** sont comptées **au domicile de la victime**, pas au lieu de commission (l'essentiel se produit en ligne). Cet indicateur ne se lit donc pas comme les autres.
4. **Secret statistique.** Les communes ayant enregistré 5 faits ou moins sur 3 années consécutives ne sont pas publiées (`ndiff`). Ces valeurs sont affichées « non communiqué » et **jamais estimées ni reconstituées** — y compris via les colonnes `complement_info_*` du fichier, qui contiennent une moyenne départementale et non une valeur communale. 12,5 % des cellules de notre référentiel sont concernées, essentiellement « Vols avec armes », « Vols violents sans arme » et « Trafic de stupéfiants » dans les communes de moins de 25 000 habitants.
5. **Dénominateurs hétérogènes.** Les cambriolages sont rapportés à 1 000 **logements** (recensement 2022) ; tous les autres indicateurs à 1 000 **habitants** (population municipale 2023). Les deux échelles ne se comparent pas et ne s'additionnent pas.
6. **Unités de compte hétérogènes.** Selon l'indicateur, l'unité comptée est la victime, la victime entendue, l'infraction, le véhicule ou le mis en cause. Le SSMSI écrit explicitement qu'« il n'est pas pertinent de constituer des agrégats regroupant des index n'ayant pas la même unité de compte ». **Un « taux de délinquance global » unique n'existe pas dans la source** : tout score de synthèse affiché sur le site est une construction éditoriale et doit être signalé comme telle.
7. **Les indicateurs stupéfiants mesurent l'activité des services**, pas la consommation ou le trafic réels : ils comptent des mis en cause identifiés. Une hausse peut traduire une intensification des contrôles plutôt qu'une aggravation.
8. **Petites communes : forte volatilité.** Sur les communes de quelques milliers d'habitants, quelques faits de plus ou de moins déplacent fortement le taux pour mille. Le SSMSI recommande de ne pas interpréter isolément les petits niveaux ni leurs variations.
9. **Imprécision du lieu de commission.** Une zone d'activité à cheval sur deux communes voit ses faits attribués à l'une ou à l'autre. Par ailleurs, moins de 1 % des faits sans commune renseignée sont imputés par tirage aléatoire pondéré.
10. **Zones de compétence différentes.** 18 des 32 communes sont en zone police nationale (Lyon, Villeurbanne, Vénissieux, Vaulx-en-Velin, Saint-Priest, Bron, Caluire-et-Cuire, Oullins-Pierre-Bénite, Givors, Rillieux-la-Pape, Décines-Charpieu, Meyzieu, Chassieu, Feyzin, Saint-Fons, Écully, Sainte-Foy-lès-Lyon, La Mulatière) et 14 en zone gendarmerie nationale (Brignais, Champagne-au-Mont-d'Or, Charbonnières-les-Bains, Craponne, Dardilly, Francheville, Genas, Irigny, Mions, Neuville-sur-Saône, Saint-Cyr-au-Mont-d'Or, Saint-Genis-Laval, Tassin-la-Demi-Lune, Corbas). Les pratiques d'enregistrement et la présence sur la voie publique diffèrent, ce qui peut créer des effets de seuil entre communes limitrophes.
11. **Rupture de série en 2025.** L'indicateur « coups et blessures volontaires sur personne de 15 ans ou plus » a disparu en juillet 2025, remplacé par deux indicateurs de violences physiques recalculés sur 2016-2024. Les comparaisons avec des chiffres publiés avant juillet 2025 sont invalides.
12. **Millésime.** Données de l'année **2025**, publiées en juillet 2026. Les données 2026 ne seront disponibles qu'en 2027. La population de référence date du recensement 2023, les logements du recensement 2022.

## 6. Extension historique 2016-2025 (`securite-historique.json`)

Ajouté le 2026-09-05, en complément du fichier `securite.json` (année 2025 seule) documenté ci-dessus. Fichier produit : `data/raw/securite-historique.json`.

- **Périmètre** : les 4 indicateurs classants du comparateur seulement — Violences physiques hors cadre familial, Vols sans violence contre des personnes, Cambriolages de logement, Destructions et dégradations volontaires — pour les 32 communes du référentiel, sur 2016-2025 (10 ans).
- **Méthode** : 32 requêtes HTTP (une par commune) sur `https://tabular-api.data.gouv.fr/api/resources/44ef4323-1097-48d5-8719-3c544b55d294/data/?CODGEO_2026__exact=<code>&page_size=200`, chacune renvoyant ses 150 lignes (15 indicateurs x 10 années) sans pagination. Aucune année manquante côté source : les 32 x 15 x 10 = 4 800 lignes attendues ont bien été renvoyées.
- **Correspondance de nomenclature (point vérifié, pas supposé)** : l'inspection des libellés `indicateur` réellement présents montre que le millésime juillet 2026 de cette ressource a **rétropolé l'intégralité de l'historique 2016-2025** sur la nomenclature post-juillet-2025. Le libellé exact `Violences physiques hors cadre familial` (et son pendant `Violences physiques intrafamiliales`) est identique et présent pour les 10 années et les 32 communes ; l'ancien libellé `Coups et blessures volontaires sur personne de 15 ans ou plus` n'apparaît dans **aucune** ligne de la ressource interrogée, y compris pour 2016. La correspondance retenue est donc une identité stricte de chaîne de caractères entre 2016 et 2025 — aucune reconstitution, réventilation ou recalcul n'a été nécessaire côté client. Conséquence : la « rupture de nomenclature de juillet 2025 » porte sur la publication (le split n'existait pas avant juillet 2025 dans les éditions antérieures du fichier), pas sur les valeurs de cette base, déjà recalculées sur toute la période.
- **Secret statistique** : 14 cellules sur 1 280 (32 communes x 4 indicateurs x 10 ans, 1,1 %) sont masquées (`est_diffuse = "ndiff"`) et écrites `null`. Toutes concernent `violencesHorsFamille` sur des années anciennes de 3 petites communes : Saint-Cyr-au-Mont-d'Or (2016-2022, 7 années), Champagne-au-Mont-d'Or (2016-2019, 4 années), Charbonnières-les-Bains (2019-2021, 3 années). Aucune cellule masquée sur les 3 autres indicateurs, pour aucune commune ni aucune année.
- **Cohérence avec `securite.json`** : les valeurs 2025 du fichier historique sont reprises **telles quelles** depuis `securite.json` (contrôle programmatique : 128 valeurs comparées commune par commune et champ par champ, 0 écart), plutôt que recalculées depuis les lignes brutes de la ressource, afin de garantir une identité parfaite entre les deux fichiers.

## 7. Rafraîchissement

- Vérifier `last_update` sur `https://www.data.gouv.fr/api/1/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/`.
- Chaque publication de juillet fait basculer le nom de la colonne géographique (`CODGEO_2026` → `CODGEO_2027`) et rétropole tout l'historique sur la nouvelle géographie communale. Le pipeline doit lire `profile.header` de la tabular-api pour détecter le nom de colonne, et `profile.profile.annee.max` pour l'année la plus récente, au lieu de les coder en dur.
- Les `resource_id` peuvent changer d'une campagne à l'autre : les re-résoudre par `title` + `format` dans l'API du dataset.
