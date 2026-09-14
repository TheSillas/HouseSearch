# Écoles — note de source

Clé technique : `ecoles`
Dernière vérification : 2026-09-05 (toutes les URL citées ont renvoyé HTTP 200 ce jour-là).

> **Révision du 2026-09-05 — correction d'un sous-comptage.** Le dénombrement était auparavant tiré du cube SDMX du domaine Enseignement (`DS_BPE_EDUCATION`), filtré en exigeant `_T` ou `_Z` sur ses six dimensions de ventilation. Les établissements portant `_U` (non renseigné) sur au moins une de ces dimensions disparaissaient silencieusement. Le dénombrement est désormais lu dans le **fichier de dénombrement général** (`DS_BPE_CSV_FR`), qui ne porte aucune dimension de ventilation. Voir §2.1 et §6.

---

## 1. Ce que l'on peut produire, et ce que l'on ne peut pas produire

**Disponible et fiable à la maille commune :**
- nombre d'écoles, de collèges et de lycées **implantés** sur le territoire de la commune (INSEE BPE 2025, ou annuaire de l'éducation).

**Non disponible en tant que tel :** il **n'existe aucun indicateur officiel de résultats scolaires publié à la maille commune** en France. Ni l'INSEE, ni la DEPP (ministère de l'Éducation nationale) ne diffusent de « taux de réussite communal ». Les seuls résultats officiels sont publiés **par établissement (UAI)**. Toute valeur communale est donc une **agrégation dérivée que nous calculons nous-mêmes** à partir des établissements physiquement implantés dans la commune — ce n'est pas un indicateur de « secteur scolaire ».

Le jeu historique **« Diplôme national du brevet par établissement »** (`fr-en-dnb-par-etablissement`) est **abandonné** : il porte l'avertissement officiel « ce jeu de données n'est plus actualisé » et sa dernière session est **2021**. Il ne doit **pas** être utilisé. Le remplaçant officiel pour le DNB est le jeu **IVAC**.

---

## 2. Sources retenues

### 2.1 Dénombrement — INSEE, Base permanente des équipements (BPE) 2025, fichier de dénombrement général

| | |
|---|---|
| Producteur | INSEE |
| Millésime | **2025** — équipements au **1er janvier 2025**, géographie communale au 01/01/2026 |
| Page | https://www.insee.fr/fr/statistiques/8217527?sommaire=8217537 — documentation : https://www.insee.fr/fr/metadonnees/source/operation/s2278/presentation |
| Ressource | **https://www.insee.fr/fr/statistiques/fichier/8217527/DS_BPE_CSV_FR.zip** (ZIP 14,5 Mo → `DS_BPE_2025_data.csv`, **2 347 651 lignes**, + `DS_BPE_2025_metadata.csv`) |
| Format | CSV séparateur `;`, UTF-8, format SDMX harmonisé européen |
| Licence | Données publiques INSEE, réutilisation libre (Licence Ouverte / Etalab v2.0) |
| Fréquence | annuelle |

Colonnes : `GEO`, `GEO_OBJECT`, `FACILITY_DOM`, `FACILITY_SDOM`, `FACILITY_TYPE`, `BPE_MEASURE`, `UNIT_MEASURE`, `OBS_STATUS`, `UNIT_MULT`, `TIME_PERIOD`, `OBS_VALUE`.

**Pourquoi ce fichier et pas `DS_BPE_EDUCATION_CSV_FR.zip`.** Le fichier du domaine Enseignement est un cube entièrement croisé : il ajoute six dimensions de ventilation (`BOARDING_SCHOOL`, `CANTEEN`, `CPGE`, `EP`, `SCHOOL_SECTOR`, `RPI_TYPE`). Pour ne pas double-compter, la version précédente exigeait `_T` ou `_Z` sur les six. Or certains établissements portent `_U` (non renseigné) sur au moins une dimension : **ils sortaient du comptage sans laisser de trace**. Le fichier de dénombrement général ne porte **aucune** de ces dimensions — une ligne = un couple (`GEO`, `FACILITY_TYPE`), et `OBS_VALUE` est directement le nombre d'équipements. Filtres appliqués : `GEO_OBJECT='COM'`, `BPE_MEASURE='FACILITIES'`, `TIME_PERIOD=2025`.

Codes `FACILITY_TYPE` du champ scolaire (sous-domaines `C1`, `C2`, `C3` — tous frères, aucun n'est un sous-total d'un autre) :

`C107` école maternelle · `C108` école primaire (maternelle **et** élémentaire) · `C109` école élémentaire · `C201` collège · `C301` lycée d'enseignement général et/ou technologique · `C302` lycée d'enseignement professionnel · `C303` lycée d'enseignement technique et/ou professionnel agricole · `C304` SGT section d'enseignement général et technologique · `C305` SEP section d'enseignement professionnel.

Sur les 32 communes du périmètre, `C304` est **absent du fichier** (valeur 0 partout) ; `C305` est non nul sur 8 communes.

`GEO = 69123` existe bien en `GEO_OBJECT = COM` — aucun agrégateur n'est nécessaire pour la BPE. `GEO = 69149` correspond déjà à la commune nouvelle Oullins-Pierre-Bénite ; `69152` est absent du fichier.

### 2.2 Contrôle externe — INSEE, Dossier complet, tableau EQUIP T3

| | |
|---|---|
| Producteur | INSEE |
| URL | https://www.insee.fr/fr/statistiques/2011101?geo=COM-*{code}* |
| Tableau | **EQUIP T3 — « Établissements scolaires »**, source « base permanente des équipements (BPE 2025) » |
| Lignes publiées | `École` · `Collège` · `Lycée d'enseignement général et/ou technologique` · `Lycée d'enseignement professionnel ou agricole` |

C'est **la** référence de comparabilité : c'est ce que l'INSEE affiche publiquement pour une commune. Elle est indépendante de notre lecture du fichier brut et sert de contrôle externe (§6). Elle fixe aussi la convention d'agrégation (§3).

### 2.3 Dénombrement alternatif / quasi temps réel — Annuaire de l'éducation

| | |
|---|---|
| Producteur | Ministères de l'Éducation nationale (DEPP) |
| Page data.gouv | https://www.data.gouv.fr/datasets/annuaire-de-leducation (id `5889d03fa3a72974cbf0d5b1`) |
| Export | https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/exports/json?where=code_departement%3D%22069%22 — **1 558 lignes** pour le Rhône |
| Licence | Licence Ouverte v2.0 (Etalab) |
| Fréquence | quotidienne (`date_maj_ligne` = 2026-08-20 sur les fiches testées) |

Colonnes utiles : `identifiant_de_l_etablissement` (UAI), `nom_etablissement`, `type_etablissement`, `libelle_nature`, `code_nature`, `statut_public_prive`, `code_commune`, `ecole_maternelle`, `ecole_elementaire`, `etat`, `multi_uai`, `ministere_tutelle`.

**Point clé : l'annuaire ne connaît PAS le code 69123.** Les établissements lyonnais sont sous **69381→69389** : agrégateur obligatoire. Le code `69152` (Pierre-Bénite) subsiste dans certaines lignes → agréger vers `69149`.

**Piège corrigé le 2026-09-05 : un même UAI peut apparaître sous deux `type_etablissement` différents.** L'UAI `0692165D` (Élie Vignal, Caluire-et-Cuire, `libelle_nature = COLLEGE SPECIALISE`, `multi_uai = 1`) figure à la fois en « Lycée Élie Vignal » et en « Collège Élie Vignal ». Il était compté une fois dans `annuaireColleges` **et** une fois dans `annuaireLycees`. Le dédoublonnage est désormais **global** : arbitrage par `libelle_nature`, donc collège. Neuf UAI du périmètre sont dupliqués dans l'annuaire ; les huit autres le sont à l'intérieur d'une même catégorie (sites multiples, annexes).

### 2.4 Résultats collège — IVAC (Indicateurs de valeur ajoutée des collèges)

| | |
|---|---|
| Producteur | Ministères de l'Éducation nationale (DEPP) |
| Page data.gouv | https://www.data.gouv.fr/datasets/indicateurs-de-valeur-ajoutee-des-colleges (id `6455d121686917088af10162`) |
| Dataset ODS | `fr-en-indicateurs-valeur-ajoutee-colleges` |
| Export | `.../exports/json?where=code_departement%3D%2269%22` — 670 lignes pour le Rhône, dont **171 en session 2025**, 171 UAI distincts (aucun doublon) |
| Licence | Licence Ouverte v2.0 (Etalab) |

Colonnes utiles : `session`, `uai`, `nom_de_l_etablissement`, `commune` (libellé), `code_departement`, `secteur`, `nb_candidats_g`, `taux_de_reussite_g`, `va_du_taux_de_reussite_g`.

**Piège majeur : IVAC ne contient aucun code commune INSEE**, et son `code_departement` vaut `"69"` (2 caractères) alors que l'annuaire utilise `"069"`. Le champ `commune` est un **libellé en majuscules non accentué**. La jointure doit se faire **par UAI** via l'annuaire, jamais par le nom.

### 2.5 Résultats lycée — IVAL général/technologique et IVAL professionnel

| | GT | PRO |
|---|---|---|
| Page data.gouv | https://www.data.gouv.fr/datasets/indicateurs-de-valeur-ajoutee-des-lycees-denseignement-general-et-technologique-2 | https://www.data.gouv.fr/datasets/indicateurs-de-valeur-ajoutee-des-lycees-denseignement-professionnel |
| Dataset ODS | `fr-en-indicateurs-de-resultat-des-lycees-gt_v2` | `fr-en-indicateurs-de-resultat-des-lycees-pro_v2` |
| Export Rhône | `.../exports/json?where=code_departement%3D%2269%22` → 970 lignes | idem → 748 lignes |
| Dernière année | **2025** | **2025** |
| Licence | Licence Ouverte v2.0 (Etalab) | Licence Ouverte v2.0 (Etalab) |

Colonnes utiles : `annee` (type **date** dans l'API : un filtre `annee=2025` renvoie `IncompatibleTypesInComparisonFilter`, filtrer côté client), `uai`, `libelle_uai`, `secteur`, **`code_commune`**, `presents_total`, `taux_reu_total`, `va_reu_total`.

**Point clé : IVAL utilise les codes d'arrondissement pour Lyon** (`69381` … `69389`). Agrégateur obligatoire vers 69123.

**Piège corrigé le 2026-09-05 : IVAL publie des LIGNES, pas des établissements.** Un lycée polyvalent apparaît **deux fois sous le même UAI** — une ligne dans IVAL GT et une ligne dans IVAL PRO. `nbLyceesEvaluesBac` comptait des lignes. Sept UAI du périmètre sont concernés : `0692517L` Camus-Sermenaz (Rillieux), `0692717D` Jacques Brel (Vénissieux), `0690103M` Frédéric Fays (Villeurbanne), `0693504J` (Dardilly), `0693330V` (Givors), `0692800U` (Décines-Charpieu), `0690128P` (Lyon). Les deux lignes restent **cumulées** dans `nbPresentsBac` et dans la pondération — ce sont deux cohortes réelles — mais l'établissement n'est compté qu'une fois. Le dédoublonnage ne change donc **ni `tauxReussiteBac`, ni `vaBac`, ni `nbPresentsBac`**.

---

## 3. Méthodologie retenue

### 3.1 Dénombrement — convention de comptage

La convention est **alignée sur le tableau EQUIP T3 du Dossier complet de l'INSEE**, pour que nos chiffres soient directement comparables à ce que l'INSEE publie.

| Champ | Formule BPE | Ligne INSEE correspondante |
|---|---|---|
| `ecolesTotal` | `C107 + C108 + C109` | **École** |
| `ecolesMaternelles` | `C107 + C108` | *(non publié par l'INSEE)* |
| `ecolesElementaires` | `C109 + C108` | *(non publié par l'INSEE)* |
| `colleges` | `C201` | **Collège** |
| `lyceesGeneralTechno` | `C301 + C304` | **Lycée d'enseignement général et/ou technologique** |
| `lyceesProfessionnels` | `C302 + C303 + C305` | **Lycée d'enseignement professionnel ou agricole** |
| `lycees` | `lyceesGeneralTechno + lyceesProfessionnels` | *(somme des deux lignes)* |

**Décision sur les sections C305.** Elles sont **comptées** avec les lycées professionnels, et non exclues comme dans la version précédente. Ce n'est pas un choix arbitraire : c'est ce que l'INSEE agrège lui-même sous « Lycée d'enseignement professionnel ou agricole ». Vérifié le 2026-09-05 sur les huit communes où `C305 > 0` :

| Commune | C302 | C303 | C305 | Somme | Publié par l'INSEE |
|---|---:|---:|---:|---:|---:|
| Dardilly | 0 | 1 | 1 | 2 | **2** |
| Givors | 1 | 0 | 1 | 2 | **2** |
| Décines-Charpieu | 0 | 0 | 1 | 1 | **1** |
| Meyzieu | 0 | 0 | 1 | 1 | **1** |
| Rillieux-la-Pape | 2 | 0 | 1 | 3 | **3** |
| Vénissieux | 2 | 0 | 1 | 3 | **3** |
| Villeurbanne | 4 | 0 | 1 | 5 | **5** |
| Lyon | 23 | 1 | 3 | 27 | **27** |

Conséquence à assumer et à afficher : **`lycees` ne compte pas des UAI, il compte des implantations au sens BPE.** Une section d'enseignement professionnel est adossée à un lycée général et technologique et n'a pas d'UAI propre dans l'annuaire — c'est pourquoi `annuaireLycees` est inférieur à `lycees` sur ces communes (Lyon : 65 contre 69).

Une école primaire (`C108`) est comptée à la fois comme maternelle et comme élémentaire — c'est ce qu'elle est. La somme `ecolesMaternelles + ecolesElementaires` n'a donc aucun sens ; le nombre d'écoles est `ecolesTotal`.

### 3.2 Résultats

2. **DNB** — moyenne des `taux_de_reussite_g` des collèges de la commune, **pondérée par `nb_candidats_g`** ; même pondération pour `va_du_taux_de_reussite_g`. Rattachement commune par jointure UAI via l'annuaire.
3. **Bac** — moyenne des `taux_reu_total` des lycées GT **et** PRO de la commune, **pondérée par `presents_total`** ; même pondération pour `va_reu_total`. `nbLyceesEvaluesBac` = nombre d'**UAI distincts**, pas de lignes.
4. Toute commune sans collège (ou sans lycée) évalué reçoit `null` — jamais 0, jamais une valeur départementale de substitution.

---

## 4. Limites à afficher à l'utilisateur

- **Aucun taux de réussite communal officiel n'existe.** Les valeurs affichées sont une moyenne pondérée, calculée par nous, des établissements situés sur la commune.
- **Ce n'est pas « le niveau scolaire de vos enfants ».** Un enfant est affecté à un collège de secteur qui peut se trouver dans une autre commune, et les lycées recrutent sur un bassin bien plus large. Le lycée implanté à Charbonnières-les-Bains présente 471 candidats au bac pour une commune de 5 383 habitants.
- **Le taux brut mesure surtout le milieu social des familles**, pas la qualité de l'établissement. C'est l'objet de la **valeur ajoutée** (VA). Vénissieux : 82,7 % de réussite au DNB, VA +4,1.
- **Petits effectifs.** Sur une commune à un seul collège, le taux porte sur une centaine de candidats : 5 points d'écart d'une année sur l'autre n'ont pas de signification statistique.
- **Le taux « bac » mélange voies générale, technologique et professionnelle.** Caluire-et-Cuire 63 %, Brignais 58 %, Écully 65 % sont des lycées professionnels, pas le « niveau » de la commune.
- **Couverture réelle de `tauxReussiteBac` — à déclarer, pas à masquer.** L'indicateur ne couvre que les lycées présents dans IVAL : ceux sous tutelle du **ministère de l'Éducation nationale** ayant une cohorte évaluée en 2025. Comparer systématiquement `nbLyceesEvaluesBac` à `lycees`. Douze communes sont en couverture partielle :

  | Commune | Lycées (BPE) | Évalués au bac |
  |---|---:|---:|
  | Lyon | 69 | 54 |
  | Villeurbanne | 10 | 8 |
  | Vénissieux | 5 | 4 |
  | Rillieux-la-Pape | 5 | 4 |
  | Saint-Genis-Laval | 5 | **1** |
  | Décines-Charpieu | 4 | **1** |
  | Dardilly | 3 | **1** |
  | Givors | 3 | 2 |
  | Vaulx-en-Velin | 3 | 2 |
  | Meyzieu | 3 | **0** |
  | Caluire-et-Cuire | 2 | 1 |
  | Sainte-Foy-lès-Lyon | 2 | 1 |
  | Francheville | 1 | **0** |

  Cas le plus marquant, **Saint-Genis-Laval** : 5 lycées dénombrés, **un seul évalué** — le lycée René Descartes (`0693654X`, 477 présents, voie GT). Le lycée public d'enseignement général, technologique et professionnel agricole **André Paillot** (`0690279D`) et le lycée horticole privé **Don Bosco** (`0692681P`) ont `ministere_tutelle = AGRICULTURE` et sont hors IVAL ; deux lycées professionnels privés (`0690636S` CEPAJ, `0693332X` La Vidaude) sont absents d'IVAL 2025. **Le 94 % affiché pour Saint-Genis-Laval est le taux d'un seul lycée général et technologique, pas celui de la commune.** Ce n'est pas une erreur de calcul, c'est une limite de couverture — elle doit être affichée.
- **Communes sans indicateur** (valeur `null`, jamais estimée) :
  - pas de collège évalué : Dardilly et Charbonnières-les-Bains (aucun collège), Saint-Cyr-au-Mont-d'Or (seul un collège privé, absent d'IVAC) ;
  - pas de lycée évalué au bac 2025 : Meyzieu, Saint-Fons, Francheville, Mions, Genas, Craponne, Corbas, Chassieu, Feyzin, Irigny, Champagne-au-Mont-d'Or, Saint-Cyr-au-Mont-d'Or. À Meyzieu, le lycée polyvalent Arnaud Beltrame existe mais n'a pas encore de cohorte évaluée.
- **Décalage temporel** : dénombrement au 1er janvier 2025, résultats session de juin 2025. Une école ouverte aux rentrées 2025 ou 2026 n'apparaît pas encore dans la BPE.
- **Écarts BPE / annuaire.** Écart maximal sur les 32 communes : **4 unités**, sur les lycées de Lyon (annuaire 65, BPE 69) — l'annuaire n'a pas d'UAI propre pour les sections d'enseignement professionnel que la BPE compte en `C305`. Tous les autres écarts valent 1 unité. Nous retenons la BPE.
- **Public et privé confondus** dans les comptages comme dans les taux agrégés.

---

## 5. Valeurs vérifiées le 2026-09-05

Dénombrement : BPE 2025, fichier de dénombrement général (au 01/01/2025). Résultats : IVAC session 2025 et IVAL 2025, agrégés par commune selon la méthode du §3. Triées par nombre d'écoles décroissant.

| Code INSEE | Commune | Mater. | Élém. | **Écoles** | Collèges | Lyc. GT | Lyc. pro/agri. | **Lycées** | Réussite DNB (%) | VA DNB | Candidats DNB | Réussite bac (%) | VA bac | Lycées évalués bac |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 69123 | Lyon | 159 | 148 | 216 | 51 | 42 | 27 | 69 | 93.6 | 0.6 | 6286 | 93.9 | -1.6 | 54 |
| 69266 | Villeurbanne | 37 | 36 | 61 | 15 | 5 | 5 | 10 | 87.3 | 3.7 | 1415 | 86.7 | -1.3 | 8 |
| 69259 | Vénissieux | 23 | 24 | 41 | 7 | 2 | 3 | 5 | 82.7 | 4.1 | 846 | 74.8 | -8.5 | 4 |
| 69256 | Vaulx-en-Velin | 22 | 20 | 36 | 4 | 1 | 2 | 3 | 80.4 | 2.6 | 457 | 79.3 | -4.7 | 2 |
| 69290 | Saint-Priest | 17 | 17 | 23 | 5 | 1 | 1 | 2 | 89.2 | 5.3 | 626 | 83.5 | -7.1 | 2 |
| 69034 | Caluire-et-Cuire | 15 | 15 | 21 | 4 | 1 | 1 | 2 | 90.5 | 2 | 262 | 63 | -12 | 1 |
| 69091 | Givors | 11 | 11 | 20 | 3 | 1 | 2 | 3 | 75.1 | -3 | 287 | 85.9 | -3.2 | 2 |
| 69149 | Oullins-Pierre-Bénite | 14 | 13 | 18 | 7 | 3 | 3 | 6 | 96.5 | 4.3 | 738 | 90.5 | -2.4 | 6 |
| 69286 | Rillieux-la-Pape | 11 | 11 | 18 | 3 | 2 | 3 | 5 | 91.9 | 5.7 | 351 | 88 | -0.6 | 4 |
| 69029 | Bron | 11 | 11 | 16 | 4 | 1 | 2 | 3 | 87 | 4.1 | 316 | 86.4 | -5 | 3 |
| 69275 | Décines-Charpieu | 11 | 13 | 14 | 4 | 3 | 1 | 4 | 87.2 | 0.7 | 346 | 92.5 | -1.7 | 1 |
| 69081 | Écully | 7 | 7 | 12 | 2 | 0 | 1 | 1 | 92 | -2.5 | 274 | 65 | -10 | 1 |
| 69282 | Meyzieu | 10 | 11 | 12 | 3 | 2 | 1 | 3 | 85 | -0.8 | 427 | null | null | null |
| 69202 | Sainte-Foy-lès-Lyon | 9 | 9 | 11 | 1 | 1 | 1 | 2 | 89 | -3 | 81 | 92 | -3 | 1 |
| 69244 | Tassin-la-Demi-Lune | 9 | 9 | 11 | 2 | 1 | 0 | 1 | 94.9 | 0.2 | 372 | 100 | 0 | 1 |
| 69199 | Saint-Fons | 8 | 8 | 9 | 1 | 0 | 0 | 0 | 86 | 11 | 181 | null | null | null |
| 69204 | Saint-Genis-Laval | 6 | 6 | 8 | 3 | 1 | 4 | 5 | 75.4 | -7.7 | 166 | 94 | -4 | 1 |
| 69027 | Brignais | 4 | 5 | 7 | 1 | 0 | 1 | 1 | 95 | 0 | 81 | 58 | -15 | 1 |
| 69100 | Irigny | 4 | 5 | 7 | 1 | 0 | 0 | 0 | 83 | -3 | 144 | null | null | null |
| 69271 | Chassieu | 4 | 4 | 7 | 1 | 0 | 0 | 0 | 86 | -5 | 182 | null | null | null |
| 69276 | Feyzin | 7 | 7 | 7 | 1 | 0 | 0 | 0 | 69 | -15 | 93 | null | null | null |
| 69069 | Craponne | 4 | 4 | 6 | 2 | 0 | 0 | 0 | 89 | -5 | 184 | null | null | null |
| 69089 | Francheville | 5 | 5 | 6 | 1 | 1 | 0 | 1 | 94 | -1 | 137 | null | null | null |
| 69143 | Neuville-sur-Saône | 5 | 5 | 6 | 2 | 2 | 0 | 2 | 95.6 | -0.3 | 496 | 99 | 0.5 | 2 |
| 69277 | Genas | 5 | 5 | 5 | 2 | 0 | 0 | 0 | 95.2 | -1.1 | 400 | null | null | null |
| 69283 | Mions | 4 | 4 | 5 | 1 | 0 | 0 | 0 | 79 | -7 | 152 | null | null | null |
| 69072 | Dardilly | 3 | 3 | 4 | 0 | 1 | 2 | 3 | null | null | null | 94.5 | 6.5 | 1 |
| 69191 | Saint-Cyr-au-Mont-d'Or | 3 | 3 | 4 | 1 | 0 | 0 | 0 | null | null | null | null | null | null |
| 69040 | Champagne-au-Mont-d'Or | 2 | 2 | 3 | 1 | 0 | 0 | 0 | 86 | -3 | 132 | null | null | null |
| 69142 | La Mulatière | 3 | 3 | 3 | 1 | 1 | 0 | 1 | 93 | -2 | 99 | 100 | 1 | 1 |
| 69273 | Corbas | 3 | 3 | 3 | 1 | 0 | 0 | 0 | 83 | -6 | 124 | null | null | null |
| 69044 | Charbonnières-les-Bains | 1 | 1 | 1 | 0 | 1 | 0 | 1 | null | null | null | 98 | -1 | 1 |

*Lyon = code 69123 : le dénombrement BPE est directement disponible en COM ; les résultats DNB et bac agrègent les arrondissements 69381 à 69389. Oullins-Pierre-Bénite = 69149, périmètre fusionné.*

---

## 6. Contrôle externe du dénombrement

L'ancien contrôle de cohérence — « la somme des 9 arrondissements égale 69123 » — **n'avait aucune valeur probante** : il comparait le cube BPE à lui-même. Un sous-comptage homogène sur les neuf arrondissements le franchissait sans encombre, et c'est précisément ce qui s'est produit.

Il est remplacé par une **confrontation à une publication INSEE distincte** : le tableau EQUIP T3 du Dossier complet, interrogé le 2026-09-05 commune par commune. Treize communes vérifiées, **treize concordances exactes sur les quatre lignes publiées** :

| Commune | École | Collège | Lycée GT | Lycée pro/agri. | Verdict |
|---|---:|---:|---:|---:|---|
| Lyon (69123) | 216 | 51 | 42 | 27 | ✅ identique |
| Villeurbanne (69266) | 61 | 15 | 5 | 5 | ✅ identique |
| Vénissieux (69259) | 41 | 7 | 2 | 3 | ✅ identique |
| Caluire-et-Cuire (69034) | 21 | 4 | 1 | 1 | ✅ identique |
| Givors (69091) | 20 | 3 | 1 | 2 | ✅ identique |
| Oullins-Pierre-Bénite (69149) | 18 | 7 | 3 | 3 | ✅ identique |
| Rillieux-la-Pape (69286) | 18 | 3 | 2 | 3 | ✅ identique |
| Décines-Charpieu (69275) | 14 | 4 | 3 | 1 | ✅ identique |
| Meyzieu (69282) | 12 | 3 | 2 | 1 | ✅ identique |
| Sainte-Foy-lès-Lyon (69202) | 11 | 1 | 1 | 1 | ✅ identique |
| Saint-Genis-Laval (69204) | 8 | 3 | 1 | 4 | ✅ identique |
| Craponne (69069) | 6 | 2 | 0 | 0 | ✅ identique |
| Dardilly (69072) | 4 | 0 | 1 | 2 | ✅ identique |

Le tableau du Dossier complet ne publie pas la ventilation maternelles / élémentaires : `ecolesMaternelles` et `ecolesElementaires` ne sont donc **pas** couverts par ce contrôle externe. Ils sortent directement des cellules `C107`, `C108` et `C109` du même fichier de dénombrement général, dont la somme, elle, est contrôlée.

---

## 7. Corrections appliquées le 2026-09-05

Cause racine unique du dénombrement : filtrage `_T`/`_Z` sur les six dimensions du cube Enseignement, qui écartait les établissements codés `_U`.

| Commune | Champ | Avant | Après |
|---|---|---:|---:|
| 69069 Craponne | `colleges` | 1 | **2** |
| 69123 Lyon | `ecolesMaternelles` | 157 | **159** |
| 69123 Lyon | `ecolesElementaires` | 146 | **148** |
| 69123 Lyon | `ecolesTotal` | 214 | **216** |
| 69149 Oullins-Pierre-Bénite | `ecolesElementaires` | 12 | **13** |
| 69149 Oullins-Pierre-Bénite | `ecolesTotal` | 17 | **18** |
| 69202 Sainte-Foy-lès-Lyon | `ecolesMaternelles` | 8 | **9** |
| 69202 Sainte-Foy-lès-Lyon | `ecolesElementaires` | 8 | **9** |
| 69202 Sainte-Foy-lès-Lyon | `ecolesTotal` | 10 | **11** |
| 69259 Vénissieux | `ecolesMaternelles` | 22 | **23** |
| 69259 Vénissieux | `ecolesElementaires` | 23 | **24** |
| 69259 Vénissieux | `ecolesTotal` | 39 | **41** |
| 69266 Villeurbanne | `ecolesMaternelles` | 35 | **37** |
| 69266 Villeurbanne | `ecolesElementaires` | 35 | **36** |
| 69266 Villeurbanne | `ecolesTotal` | 59 | **61** |

Changement de convention sur les sections `C305` (désormais comptées avec les lycées professionnels ou agricoles) :

| Commune | `lyceesProfessionnels` | `lycees` |
|---|---|---|
| 69072 Dardilly | 1 → **2** | 2 → **3** |
| 69091 Givors | 1 → **2** | 2 → **3** |
| 69123 Lyon | 24 → **27** | 66 → **69** |
| 69259 Vénissieux | 2 → **3** | 4 → **5** |
| 69266 Villeurbanne | 3 → **5** | 8 → **10** |
| 69275 Décines-Charpieu | 0 → **1** | 3 → **4** |
| 69282 Meyzieu | 0 → **1** | 2 → **3** |
| 69286 Rillieux-la-Pape | 2 → **3** | 4 → **5** |

*Note : à Villeurbanne, `lyceesProfessionnels` passe de 3 à 5 pour deux raisons cumulées — un lycée professionnel `_U` récupéré (`C302` : 3 → 4, l'INSEE publie bien 4) et la section `C305` désormais comptée.*

Dédoublonnage par UAI :

| Commune | Champ | Avant | Après | UAI en cause |
|---|---|---:|---:|---|
| 69034 Caluire-et-Cuire | `annuaireLycees` | 3 | **2** | `0692165D` Élie Vignal (listé en collège **et** en lycée) |
| 69072 Dardilly | `nbLyceesEvaluesBac` | 2 | **1** | `0693504J` |
| 69091 Givors | `nbLyceesEvaluesBac` | 3 | **2** | `0693330V` |
| 69123 Lyon | `nbLyceesEvaluesBac` | 55 | **54** | `0690128P` |
| 69259 Vénissieux | `nbLyceesEvaluesBac` | 5 | **4** | `0692717D` Jacques Brel |
| 69266 Villeurbanne | `nbLyceesEvaluesBac` | 9 | **8** | `0690103M` Frédéric Fays |
| 69275 Décines-Charpieu | `nbLyceesEvaluesBac` | 2 | **1** | `0692800U` |
| 69286 Rillieux-la-Pape | `nbLyceesEvaluesBac` | 5 | **4** | `0692517L` Camus-Sermenaz |

**Inchangés et re-vérifiés à l'identique sur les 32 communes** : `tauxReussiteDnb`, `vaDnb`, `nbCandidatsDnb`, `nbCollegesEvaluesDnb` (IVAC 2025, aucun doublon d'UAI), ainsi que `tauxReussiteBac`, `vaBac`, `nbPresentsBac` et `voiesBacEvaluees` (le dédoublonnage ne touche que le décompte d'établissements). `annuaireEcolesMaternelles`, `annuaireEcolesElementaires` et `annuaireColleges` sont identiques sur les 32 communes après recalcul.
