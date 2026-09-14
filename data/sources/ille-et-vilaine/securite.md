# Sécurité — délinquance enregistrée pour 1 000 habitants

Clé technique : `securite`
Note rédigée le 2026-09-06. Toutes les valeurs et métadonnées ci-dessous proviennent de requêtes HTTP réellement exécutées sur data.gouv.fr / tabular-api.data.gouv.fr / geo.api.gouv.fr à cette date. Méthodologie strictement identique à celle documentée pour la Métropole de Lyon (`data/sources/metropole-lyon/securite.md`), appliquée aux 128 communes du référentiel d'Ille-et-Vilaine (35) : même jeu de données SSMSI (base nationale, aucun changement de source), seuls les codes commune interrogés changent.

## 1. Source retenue

| | |
|---|---|
| **Jeu de données** | Bases statistiques communale, départementale et régionale de la délinquance enregistrée par la police et la gendarmerie nationales |
| **Producteur** | SSMSI — Service statistique ministériel de la sécurité intérieure (Ministère de l'Intérieur) |
| **Page officielle** | https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales |
| **API métadonnées** | https://www.data.gouv.fr/api/1/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/ |
| **Identifiant dataset** | `621df2954fa5a3b5a023e23c` |
| **Millésime de données** | **2025** (`temporal_coverage` = 2016-01-01 → 2025-12-31, revérifié le 2026-09-06) |
| **Édition / production** | fichier produit le 2026-06-25, publié le 2026-07-09 (`last_update` = 2026-07-09T12:01:37Z) — identique à l'édition utilisée pour Lyon |
| **Géographie communale** | Code Officiel Géographique au **1er janvier 2026** |
| **Licence** | Licence Ouverte / Open Licence version 2.0 (`lov2`) |
| **Fréquence de mise à jour** | annuelle |

### Ressources vérifiées (HTTP 200 obtenu le 2026-09-06)

| Ressource | `resource_id` | Format | URL |
|---|---|---|---|
| COM — base communale (csv compressé) | `44ef4323-1097-48d5-8719-3c544b55d294` | csv.gz | https://static.data.gouv.fr/resources/.../donnee-data.gouv-2025-geographie2026-produit-le2026-06-25.csv.gz |
| COM COMPL — zonages + zone de compétence police/gendarmerie | `a2af06fc-ba6c-4e6c-a69a-ac222817c93f` | xlsx | https://static.data.gouv.fr/resources/.../info-complements-data.gouv-2025-geographie2026-produit-le2026-06-25.xlsx |

Les deux `resource_id` ont été re-résolus via l'API du dataset le 2026-09-06 (et non recopiés depuis la note Lyon) : ils sont strictement identiques à ceux de l'extraction Lyon (`created_at` 2026-03-26/27), confirmant qu'il s'agit bien de la même édition de fichier, seule la liste de codes interrogés change. Accès effectif confirmé : `GET https://tabular-api.data.gouv.fr/api/resources/44ef4323-1097-48d5-8719-3c544b55d294/data/?page_size=1` → HTTP 200, colonne géographique lue dans la réponse = `CODGEO_2026` (détectée dynamiquement, pas supposée).

## 2. Structure du fichier communal

Identique à Lyon : CSV `;`, décimale virgule, `NA` = manquant, format long (commune x année x indicateur). Colonnes : `CODGEO_2026`, `annee`, `indicateur`, `unite_de_compte`, `nombre`, `taux_pour_mille`, `est_diffuse` (`diff`/`ndiff`), `insee_pop` / `insee_pop_millesime`, `insee_log` / `insee_log_millesime`, `complement_info_nombre` / `complement_info_taux` (moyennes départementales, jamais utilisées pour combler un `ndiff`).

### Les 15 indicateurs de la base communale (millésime 2025)

Violences physiques intrafamiliales, Violences physiques hors cadre familial, Violences sexuelles, Vols avec armes, Vols violents sans arme, Vols sans violence contre des personnes, **Cambriolages de logement** (pour 1 000 logements, tous les autres pour 1 000 habitants), Vols de véhicule, Vols dans les véhicules, Vols d'accessoires sur véhicules, Destructions et dégradations volontaires, Usage de stupéfiants, Usage de stupéfiants (AFD), Trafic de stupéfiants, Escroqueries et fraudes aux moyens de paiement.

Les 15 libellés ont été vérifiés présents tels quels (149 lignes de test sur Rennes, code 35238, requête `CODGEO_2026__exact=35238&page_size=200` → 150 lignes = 15 indicateurs x 10 années 2016-2025, `meta.total` = 150, aucune pagination nécessaire).

## 3. Méthodologie du producteur

Identique à Lyon (voir `data/sources/metropole-lyon/securite.md` section 3) : champ = crimes et délits enregistrés (état 4001 retraité), territorialisation au lieu de commission (sauf escroqueries, au domicile de la victime), secret statistique si 5 faits ou moins sur 3 années consécutives (`est_diffuse = "ndiff"`, `nombre` et `taux_pour_mille` à `NA`), stupéfiants = mis en cause (non additifs entre échelons territoriaux), zone de compétence (ZPN/ZGN) dans le fichier COM COMPL.

## 4. Extraction et raccordement aux 128 communes du référentiel

### Méthode d'extraction

128 requêtes HTTP, une par commune, sur `https://tabular-api.data.gouv.fr/api/resources/44ef4323-1097-48d5-8719-3c544b55d294/data/?CODGEO_2026__exact=<code>&page_size=200`. **Les 128 requêtes ont toutes renvoyé exactement 150 lignes** (15 indicateurs x 10 années), sans aucune pagination et sans aucun code renvoyant 0 ligne. Aucun code du référentiel n'a donc dû être recherché sous un ancien identifiant : le SSMSI publie déjà, pour les 128 codes fournis, un historique 2016-2025 complet en lignes (l'exhaustivité des *lignes* ne préjuge pas de l'exhaustivité des *valeurs* : voir secret statistique ci-dessous et section 6).

### Vérification des communes nouvelles bretonnes (fusions 2016-2019)

La liste des 128 codes fournie inclut des communes nouvelles issues de fusions bretonnes récentes. Trois contrôles croisés ont été effectués pour détecter une éventuelle anomalie de raccordement :

1. **Complétude des lignes** : 128/128 codes ont renvoyé 150 lignes (aucun code à 0 ligne, aucun total ≠ 150).
2. **Cohérence de population** : la population 2025 (`insee_pop`) de chacune des 128 communes dans la base SSMSI a été comparée programmatiquement à la population retournée par `https://geo.api.gouv.fr/communes?codeDepartement=35&fields=nom,code,population,codesPostaux` (332 communes du département récupérées en un seul appel, filtrées aux 128 codes) : **0 écart** sur les 128 communes.
3. **Cohérence de libellé** : le `LIBGEO` du fichier COM COMPL (zone_competence) a été comparé au champ `nom` de geo.api.gouv.fr pour les 128 communes : **0 écart**.

**Conclusion : aucune anomalie de raccordement rencontrée sur cette liste précise de 128 codes.** Le SSMSI a retropolé, pour chacun des codes fournis (y compris les communes nouvelles), un historique 2016-2025 complet en nombre de lignes sous le code actuel. Ceci ne garantit pas que chaque année de cet historique reflète une agrégation correcte du périmètre pré-fusion (le producteur ne documente pas ce point finement à ce niveau de granularité) — seule l'absence d'incohérence détectable (lignes manquantes, population aberrante, libellé désaccordé) a pu être vérifiée avec les moyens de cette extraction.

### Anomalie technique rencontrée (non liée aux communes, à documenter pour le pipeline)

Le fichier **COM COMPL** (`a2af06fc-ba6c-4e6c-a69a-ac222817c93f`, feuille « zonages supracommunaux », qui porte `LIBGEO` et `zone_competence`) contient un tag XML `<dimension ref="A1"/>` erroné : il annonce une feuille limitée à la cellule A1 alors qu'elle contient réellement 26 colonnes et 34 920 lignes de données. **openpyxl en mode `read_only` standard tronque silencieusement la lecture à la seule colonne A** (aucune erreur levée, aucune ligne manquante signalée — juste une lecture partielle silencieuse). Contournement appliqué : parseur XML dédié lisant directement `xl/worksheets/sheet1.xml` et `xl/sharedStrings.xml` à l'intérieur du zip xlsx, sans passer par l'API worksheet d'openpyxl. Un pipeline de rafraîchissement doit reproduire ce contournement (ou utiliser une bibliothèque insensible à un tag `<dimension>` incorrect) plutôt que de faire confiance à `ws.max_column` / `ws.iter_rows(values_only=True)` sur ce fichier.

### Zone de compétence (128 communes)

**10 communes en zone police nationale** : Rennes (35238, 230 890 hab.), Saint-Malo (35288, 47 439), Fougères (35115, 20 307), Cesson-Sévigné (35051, 18 761), Saint-Jacques-de-la-Lande (35281, 13 800), Dinard (35093, 10 772), Chantepie (35055, 10 670), Saint-Grégoire (35278, 9 957), Lécousse (35150, 3 530), La Richardais (35241, 2 664).
**118 communes en zone gendarmerie nationale** (le reste du référentiel, dont Bruz, Vitré, Betton, Pacé, Châteaugiron, Redon, Le Rheu, etc.).

### Extrait de valeurs réellement lues — Rennes (35238), année 2025

| Champ | Valeur |
|---|---|
| Population référence (2023) | 230 890 |
| Logements référence (2022) | 135 694 |
| Zone de compétence | police nationale |
| Violences physiques intrafamiliales | 3,3566 ‰ (775 victimes) |
| Violences physiques hors cadre familial | 4,1968 ‰ (969 victimes) |
| Violences sexuelles | 2,4167 ‰ (558 victimes) |
| Vols avec armes | 0,2772 ‰ (64 infractions) |
| Vols violents sans arme | 1,9880 ‰ (459 infractions) |
| **Vols sans violence contre des personnes** | **20,8627 ‰** (4 817 victimes entendues) |
| **Cambriolages de logement** | **4,7681 ‰ logements** (647 infractions) |
| Vols de véhicule | 1,9403 ‰ (448 véhicules) |
| Vols dans les véhicules | 8,1381 ‰ (1 879 véhicules) |
| Vols d'accessoires sur véhicules | 0,9875 ‰ (228 véhicules) |
| **Destructions et dégradations volontaires** | **10,6804 ‰** (2 466 infractions) |
| Usage de stupéfiants | 7,7526 ‰ (1 790 mis en cause) |
| Usage de stupéfiants (AFD) | 5,7040 ‰ (1 317 mis en cause) |
| Trafic de stupéfiants | 2,3604 ‰ (545 mis en cause) |
| Escroqueries et fraudes aux moyens de paiement | 6,9773 ‰ (1 611 victimes) |
| Violences physiques total (calculé) | 7,5534 ‰ (1 744 victimes) |
| Indicateurs diffusés / masqués | 15 / 0 |

Rennes est la seule commune du référentiel dont les 15 indicateurs sont intégralement diffusés (0 secret statistique) en 2025 — cohérent avec sa taille (plus de 230 000 habitants, très au-dessus du seuil de masquage).

## 5. Couverture du secret statistique

### Année 2025 (snapshot `securite.json`)

**899 cellules masquées sur 1 920** (128 communes x 15 indicateurs), soit **46,8 %** — une proportion très supérieure à celle observée pour la Métropole de Lyon (12,5 %), qui s'explique mécaniquement par la composition du référentiel : 32 communes majoritairement urbaines et de plusieurs milliers à plusieurs centaines de milliers d'habitants pour Lyon, contre 128 communes d'Ille-et-Vilaine dont une large majorité sont des communes rurales de moins de 5 000 habitants. Aucune commune n'est intégralement masquée (maximum observé : 12 indicateurs sur 15 masqués pour une même commune, sur 4 communes). Une seule commune (Rennes) a 0 indicateur masqué.

Répartition par indicateur (nombre de communes masquées sur 128, année 2025) :

| Indicateur | Masqué (/128) |
|---|---|
| Vols d'accessoires sur véhicules | 97 |
| Usage de stupéfiants | 95 |
| Usage de stupéfiants (AFD) | 88 |
| Violences sexuelles | 80 |
| Vols de véhicule | 79 |
| Violences physiques hors cadre familial | 75 |
| Trafic de stupéfiants | 74 |
| Vols violents sans arme | 73 |
| Vols dans les véhicules | 66 |
| Vols avec armes | 47 |
| Cambriolages de logement | 41 |
| Vols sans violence contre des personnes | 34 |
| Violences physiques intrafamiliales | 29 |
| Destructions et dégradations volontaires | 17 |
| Escroqueries et fraudes aux moyens de paiement | 4 |

### Série 2016-2025 (`securite-historique.json`, 4 indicateurs classants seulement)

**2 082 cellules masquées sur 5 120** (128 communes x 4 indicateurs x 10 ans), soit **40,7 %**.

Couverture réelle par année (nombre de communes sur 128 dont la valeur est publiée, c'est-à-dire non masquée par le secret statistique) :

| Année | Violences physiques hors cadre familial | Vols sans violence contre des personnes | Cambriolages de logement | Destructions et dégradations volontaires |
|---|---|---|---|---|
| 2016 | 39 | 87 | 54 | 113 |
| 2017 | 39 | 87 | 54 | 113 |
| 2018 | 39 | 87 | 54 | 113 |
| 2019 | 39 | 90 | 60 | 116 |
| 2020 | 42 | 86 | 53 | 114 |
| 2021 | 43 | 82 | 49 | 114 |
| 2022 | 42 | 81 | 51 | 113 |
| 2023 | 47 | 87 | 55 | 116 |
| 2024 | 50 | 93 | 77 | 114 |
| 2025 | 53 | 94 | 87 | 111 |

La couverture de « violences physiques hors cadre familial » et « cambriolages de logement » s'améliore nettement en fin de période (2024-2025), probablement en lien avec des fusions de communes qui font mécaniquement franchir le seuil de publication à certaines communes nouvelles.

**Communes sans aucune valeur publiée sur les 10 ans (10/10 années masquées) pour un indicateur donné** — ces communes n'ont **aucun point de série** pour l'indicateur concerné et ne doivent jamais être affichées à 0 ni interpolées :
- Violences physiques hors cadre familial : **56 communes sur 128** (dont Balazé, Domalain, Gosné, Ercé-près-Liffré, La Gouesnière, Pleugueneuc, Saint-Didier, Saint-Germain-en-Coglès...).
- Cambriolages de logement : **31 communes sur 128**.
- Vols sans violence contre des personnes : **15 communes sur 128**.
- Destructions et dégradations volontaires : **1 commune sur 128** (Javené, code 35137).

Ce phénomène — absent du référentiel lyonnais, composé de communes plus grandes — est la principale différence méthodologique à faire remonter à l'affichage : pour près de la moitié du référentiel, un ou plusieurs des 4 indicateurs classants n'ont **aucune valeur exploitable sur aucune des 10 années**.

## 6. Extension historique 2016-2025

Méthode strictement identique à Lyon : 128 requêtes HTTP (une par commune) sur la même ressource tabulaire, chacune renvoyant ses 150 lignes sans pagination. Contrôle programmatique de cohérence entre les 2025 de `securite-historique.json` et de `securite.json` : **512 valeurs comparées (128 communes x 4 champs), 0 écart**.

Le libellé `Violences physiques hors cadre familial` (et son pendant `Violences physiques intrafamiliales`) est présent et identique pour les 10 années et les 128 communes ; l'ancien libellé `Coups et blessures volontaires sur personne de 15 ans ou plus` n'apparaît dans aucune ligne de la ressource interrogée : la rupture de nomenclature de juillet 2025 porte sur la publication, pas sur les valeurs de cette base, déjà recalculées sur toute la période 2016-2025.

## 7. Limites à afficher à l'utilisateur final

1. **Faits enregistrés ≠ délinquance réelle.** Seules les infractions portées à la connaissance de la police ou de la gendarmerie sont comptées.
2. **Comptage au lieu de commission, pas au lieu de résidence.** Rennes (hypercentre, zones commerciales) et dans une moindre mesure Saint-Malo, Fougères, Cesson-Sévigné enregistrent mécaniquement des faits commis au détriment de non-résidents ; leurs taux rapportés à la seule population résidente sont surestimés par rapport au risque réellement encouru par un habitant.
3. **Exception : les escroqueries et fraudes aux moyens de paiement** sont comptées au domicile de la victime.
4. **Secret statistique très présent sur ce référentiel** : 46,8 % des cellules 2025 (15 indicateurs) et 40,7 % des cellules de la série historique (4 indicateurs classants) sont masquées, jamais estimées ni reconstituées. Pour un nombre important de communes (jusqu'à 56/128 selon l'indicateur), **aucune valeur n'existe sur aucune des 10 années** pour un ou plusieurs indicateurs classants — ce n'est pas une absence de délinquance mais une absence de publication en dessous du seuil de 5 faits sur 3 années consécutives.
5. **Dénominateurs hétérogènes.** Cambriolages pour 1 000 logements (recensement 2022), tous les autres indicateurs pour 1 000 habitants (population municipale 2023).
6. **Unités de compte hétérogènes** : victime, victime entendue, infraction, véhicule ou mis en cause selon l'indicateur. Aucun taux de délinquance global officiel n'existe.
7. **Les indicateurs stupéfiants mesurent l'activité des services**, pas la consommation ou le trafic réels.
8. **Petites communes : forte volatilité.** La quasi-totalité des 128 communes du référentiel (hors Rennes et quelques villes moyennes) sont des communes de quelques centaines à quelques milliers d'habitants : quelques faits de plus ou de moins déplacent fortement le taux pour mille, et c'est la cause directe du taux de masquage élevé.
9. **Imprécision du lieu de commission.** Moins de 1 % des faits sans commune renseignée sont imputés par tirage aléatoire pondéré.
10. **Zones de compétence différentes.** 10 des 128 communes sont en zone police nationale, 118 en zone gendarmerie nationale.
11. **Rupture de série en 2025.** L'indicateur « coups et blessures volontaires sur personne de 15 ans ou plus » a disparu en juillet 2025, remplacé par deux indicateurs de violences physiques recalculés sur 2016-2024.
12. **Millésime.** Données de l'année **2025**, publiées en juillet 2026. La population de référence date du recensement 2023, les logements du recensement 2022.
13. **Communes nouvelles.** La liste des 128 communes inclut des communes nouvelles issues de fusions bretonnes 2016-2019 ; aucune anomalie de raccordement n'a été détectée sur ces 128 codes précis (voir section 4), mais le SSMSI ne documente pas publiquement, à ce niveau de détail, la méthode exacte de reconstitution de l'historique pré-fusion pour chaque commune nouvelle.

## 8. Rafraîchissement

Identique à Lyon : vérifier `last_update` sur l'API du dataset ; chaque publication de juillet fait basculer le nom de la colonne géographique (`CODGEO_2026` → `CODGEO_2027`) et rétropole tout l'historique sur la nouvelle géographie communale — lire `profile.header` de la tabular-api plutôt que coder le nom en dur. Pour le fichier COM COMPL, appliquer systématiquement le contournement du bug `<dimension>` documenté en section 4 plutôt que de faire confiance à une lecture openpyxl standard.
