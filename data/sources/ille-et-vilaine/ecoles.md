# Écoles — note de source (Ille-et-Vilaine, 128 communes)

Clé technique : `ecoles`
Extraction : 2026-09-06 (toutes les URL citées ont renvoyé HTTP 200 ce jour-là).

> Cette extraction **reproduit à l'identique** la méthode validée et corrigée pour la Métropole de Lyon (`data/sources/metropole-lyon/ecoles.md`), y compris son point le plus critique : le dénombrement est lu directement dans le **fichier de dénombrement général de la BPE** (`DS_BPE_CSV_FR`), jamais dans le cube croisé du domaine Enseignement (`DS_BPE_EDUCATION`) qui avait provoqué un sous-comptage silencieux sur Lyon. Le bug n'a donc pas été reproduit ici : voir §6 pour la preuve (13 communes confrontées au Dossier complet de l'INSEE, concordance exacte sur les 13).

---

## 1. Ce que l'on peut produire, et ce que l'on ne peut pas produire

**Disponible et fiable à la maille commune :** nombre d'écoles, de collèges et de lycées **implantés** sur le territoire de la commune (INSEE BPE 2025).

**Non disponible en tant que tel :** comme pour Lyon, **aucun indicateur officiel de résultats scolaires n'est publié à la maille commune** en France. Les seuls résultats officiels sont publiés **par établissement (UAI)** ; toute valeur communale ci-dessous est une **agrégation dérivée que nous calculons nous-mêmes**, pas un indicateur de secteur scolaire.

Le jeu **« Diplôme national du brevet par établissement »** (`fr-en-dnb-par-etablissement`) est abandonné (dernière session 2021) et n'a pas été utilisé ; le remplaçant officiel IVAC a été utilisé à la place, comme pour Lyon.

---

## 2. Sources retenues

### 2.1 Dénombrement — INSEE, Base permanente des équipements (BPE) 2025, fichier de dénombrement général

| | |
|---|---|
| Producteur | INSEE |
| Millésime | **2025** — équipements au **1er janvier 2025**, géographie communale au 01/01/2026 |
| Ressource | `https://www.insee.fr/fr/statistiques/fichier/8217527/DS_BPE_CSV_FR.zip` (ZIP 14,5 Mo, HTTP 200 le 2026-09-06) → `DS_BPE_2025_data.csv`, **2 347 651 lignes** |
| Format | CSV séparateur `;`, UTF-8, format SDMX harmonisé européen |
| Licence | Licence Ouverte / Etalab v2.0 |

Filtres appliqués : `GEO_OBJECT='COM'`, `BPE_MEASURE='FACILITIES'`, `TIME_PERIOD=2025`, `GEO` commençant par `35`, `FACILITY_TYPE` ∈ {`C107`,`C108`,`C109`,`C201`,`C301`,`C302`,`C303`,`C304`,`C305`}. Ce filtrage donne **511 lignes** sur le département, couvrant les 128 communes cibles **sans exception** (vérifié : les 128 codes INSEE fournis ont chacun au moins une ligne dans le fichier filtré). `C304` (SGT) vaut 0 sur les 128 communes, comme sur Lyon.

### 2.2 Contrôle externe — INSEE, Dossier complet, tableau EQUIP T3

Même usage que pour Lyon : `https://www.insee.fr/fr/statistiques/2011101?geo=COM-{code}`, tableau **EQUIP T3 — « Établissements scolaires »**, source « base permanente des équipements (BPE 2025) ». C'est la référence de comparabilité externe, indépendante de notre lecture du fichier brut (voir §6).

### 2.3 Dénombrement alternatif / contrôle de fraîcheur — Annuaire de l'éducation

| | |
|---|---|
| Export | `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/exports/json?where=code_departement%3D%22035%22` — **1 007 lignes** pour l'Ille-et-Vilaine (HTTP 200) |
| Licence | Licence Ouverte v2.0 (Etalab) |

Contrairement à Lyon, **Rennes n'a pas d'arrondissements** : le code INSEE `35238` est utilisé directement par toutes les sources (BPE, annuaire, IVAC, IVAL), aucun agrégateur n'est nécessaire. Aucune commune fusionnée du périmètre ne pose de problème de code (Val-Couesnon 35004, Val d'Anast 35168, Guipry-Messac 35176, Les Portes du Coglais 35191, Maen Roch 35257, Rives-du-Couesnon 35282, Mesnil-Roc'h 35308 : toutes présentes et cohérentes dans les quatre sources sous leur code post-fusion actuel).

Filtres appliqués sur les 776 lignes de l'annuaire rattachées aux 128 communes cibles : `etat = 'OUVERT'`, `libelle_nature` ne commençant pas par `SECTION`, et exclusion des établissements hors champ scolaire (`type_etablissement` ∈ {Médico-social, Service Administratif, Information et orientation, Autre} — ce dernier type couvrant notamment les **Maisons Familiales Rurales**, sous tutelle du ministère de l'Agriculture) — 96 UAI exclus à ce titre. Dédoublonnage **global** par UAI ensuite (voir anomalie §7).

### 2.4 Résultats collège — IVAC (session 2025)

Export `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-indicateurs-valeur-ajoutee-colleges/exports/json?where=code_departement%3D%2235%22` — 429 lignes tous millésimes, **109 lignes en session 2025**, 109 UAI distincts (aucun doublon). Jointure vers la commune par UAI via l'annuaire (IVAC ne porte pas de code commune).

### 2.5 Résultats lycée — IVAL GT et IVAL PRO (2025)

| | GT | PRO |
|---|---|---|
| Export | `.../fr-en-indicateurs-de-resultat-des-lycees-gt_v2/exports/json?where=code_departement%3D%2235%22` → 519 lignes, **38 en 2025** | `.../fr-en-indicateurs-de-resultat-des-lycees-pro_v2/exports/json?where=code_departement%3D%2235%22` → 351 lignes, **25 en 2025** |

`code_commune` est directement utilisable (pas d'arrondissement à Rennes).

---

## 3. Méthodologie retenue (identique à Lyon)

### 3.1 Dénombrement

| Champ | Formule BPE | Ligne INSEE correspondante |
|---|---|---|
| `ecolesTotal` | `C107 + C108 + C109` | **École** |
| `ecolesMaternelles` | `C107 + C108` | *(non publié par l'INSEE)* |
| `ecolesElementaires` | `C109 + C108` | *(non publié par l'INSEE)* |
| `colleges` | `C201` | **Collège** |
| `lyceesGeneralTechno` | `C301 + C304` | **Lycée d'enseignement général et/ou technologique** |
| `lyceesProfessionnels` | `C302 + C303 + C305` | **Lycée d'enseignement professionnel ou agricole** |
| `lycees` | `lyceesGeneralTechno + lyceesProfessionnels` | *(somme des deux lignes)* |

Une école primaire (`C108`) est comptée à la fois comme maternelle et élémentaire ; `ecolesTotal` (pas la somme des deux) est le nombre d'écoles.

### 3.2 Résultats

- **DNB** : moyenne des `taux_de_reussite_g` des collèges de la commune, pondérée par `nb_candidats_g` ; même pondération pour `va_du_taux_de_reussite_g`, **restreinte aux établissements où la VA est publiée** (voir §7 — 9 collèges du département ont un taux brut publié mais une VA absente).
- **Bac** : moyenne des `taux_reu_total` des lycées GT et PRO de la commune, pondérée par `presents_total` ; même règle pour `va_reu_total` (1 lycée professionnel du département concerné). `nbLyceesEvaluesBac` = nombre d'**UAI distincts**, pas de lignes IVAL (voir §7 — 11 lycées polyvalents).
- Toute commune sans collège (ou sans lycée) évalué reçoit `null` — jamais 0, jamais une valeur départementale de substitution.

---

## 4. Limites à afficher à l'utilisateur

- **Aucun taux de réussite communal officiel n'existe** ; les valeurs affichées sont une moyenne pondérée calculée par nous à partir des établissements implantés sur la commune, pas un indicateur de secteur scolaire.
- **Couverture très partielle sur ce périmètre, à afficher systématiquement.** Sur les 128 communes : **54 seulement** ont un indicateur DNB (`tauxReussiteDnb` non `null`), **19 seulement** ont un indicateur bac. Les 74 communes sans DNB et 109 communes sans bac n'ont, le plus souvent, tout simplement pas de collège ou de lycée implanté sur leur territoire (Ille-et-Vilaine compte 128 communes retenues ici, très majoritairement rurales, contre un périmètre 100 % urbain/métropolitain pour Lyon) — comparer systématiquement `nbCollegesEvaluesDnb` à `colleges`, et `nbLyceesEvaluesBac` à `lycees`, avant d'afficher un taux.
- **Établissements « lycées » BPE sans évaluation bac.** Sur les 27 communes qui comptent au moins un lycée au sens BPE, 25 sont en couverture partielle ou totalement non couvertes. Huit communes ont un lycée dénombré par la BPE mais **aucun** évalué au bac 2025 : Baulon, Goven, Hédé-Bazouges, Janzé, Guipry-Messac, Saint-Aubin-d'Aubigné et Saint-Aubin-du-Cormier — dans chacune, un lycée d'enseignement technique et/ou professionnel agricole (BPE `C303`) tenu par une **Maison Familiale Rurale**, sous tutelle du ministère de l'Agriculture, absente d'IVAL (même mécanisme que le lycée horticole Don Bosco de Saint-Genis-Laval sur Lyon) ; et Saint-Père-Marc-en-Poulet — un petit lycée général privé (Ecole secondaire privée Sainte Marie) présent dans l'annuaire mais sans cohorte publiée dans IVAL 2025.
- **Le taux brut mesure surtout le milieu social des familles**, pas la qualité de l'établissement ; toujours afficher le taux et la VA ensemble.
- **Petits effectifs.** Sur 9 collèges et 1 lycée professionnel du département, la DEPP publie le taux brut mais pas la valeur ajoutée (effectif trop faible) ; le taux brut communal reste calculé normalement, la VA communale ne porte alors que sur le sous-ensemble équipé d'une VA (`null` si aucun établissement de la commune n'en a).
- **Le taux « bac » mélange voies générale, technologique et professionnelle** (`voiesBacEvaluees`).
- **Décalage temporel** : dénombrement au 1er janvier 2025, résultats de la session de juin 2025.
- **Public et privé confondus** dans les comptages comme dans les taux agrégés.
- **Un collège hors-contrat absent d'IVAC** : Sixt-sur-Aff (Collège privé hors-contrat Hêtre et devenir) a un collège au sens BPE mais aucun indicateur DNB.

---

## 5. Exemple complet — Rennes (35238)

| Champ | Valeur |
|---|---|
| Écoles maternelles / élémentaires / **total** | 65 / 64 / **99** |
| Collèges | 20 |
| Lycées GT / pro-agri / **total** | 15 / 13 / **28** |
| Réussite DNB (%) / VA / candidats / collèges évalués | 88.56 / -1.67 / 2289 / 19 |
| Réussite bac (%) / VA / présents / lycées évalués / voies | 94.07 / -1.21 / 5090 / 19 / GT+PRO |
| Contrôle annuaire — écoles mat. / élém. / collèges / lycées | 64 / 63 / 20 / 26 |

Écarts avec le contrôle annuaire, expliqués : `ecolesTotal` (BPE, 99) vs annuaire (64+63, une école primaire comptant dans les deux) — cohérent avec la convention documentée en §3.1 ; `lycees` (BPE 28) vs `annuaireLycees` (26) — écart de 2, imputable aux 3 sections d'enseignement professionnel `C305` sans UAI propre et au lycée agricole `C303` classé hors « Lycée » dans l'annuaire (MFR), moins les établissements effectivement recensés côté annuaire ; le même mécanisme que Lyon (65 vs 69, écart de 4) où le détail figure au §3.1 de la note Lyon. Sur les 28 lycées BPE, 19 sont évalués au bac 2025 (couverture 68 %) : voir §4 et §7 pour le détail des 9 lycées manquants au niveau départemental, dont 3 sont à Rennes même (lycées polyvalents dédoublonnés, non des établissements manquants).

---

## 6. Contrôle externe du dénombrement

Confrontation au tableau EQUIP T3 du Dossier complet de l'INSEE, interrogé le 2026-09-06 sur **treize communes**, choisies pour couvrir toute la gamme de tailles du périmètre et deux cas particuliers (Retiers pour l'anomalie d'UAI du §7, Hédé-Bazouges pour le lycée agricole absent de l'annuaire) — **Rennes incluse comme demandé** :

| Commune | Code | École | Collège | Lycée GT | Lycée pro/agri. | Verdict |
|---|---|---:|---:|---:|---:|---|
| Rennes | 35238 | 99 | 20 | 15 | 13 | ✅ identique |
| Retiers | 35239 | 2 | 1 | 0 | 0 | ✅ identique |
| Saint-Malo | 35288 | 22 | 5 | 4 | 4 | ✅ identique |
| Fougères | 35115 | 13 | 4 | 2 | 5 | ✅ identique |
| Vitré | 35360 | 10 | 4 | 2 | 3 | ✅ identique |
| Redon | 35236 | 5 | 3 | 3 | 4 | ✅ identique |
| Cesson-Sévigné | 35051 | 5 | 3 | 2 | 1 | ✅ identique |
| Bruz | 35047 | 5 | 2 | 2 | 1 | ✅ identique |
| Dinard | 35093 | 5 | 1 | 1 | 1 | ✅ identique |
| Betton | 35024 | 7 | 2 | 0 | 0 | ✅ identique |
| Montauban-de-Bretagne | 35184 | 5 | 3 | 1 | 3 | ✅ identique |
| Saint-Grégoire | 35278 | 5 | 3 | 1 | 2 | ✅ identique |
| Hédé-Bazouges | 35130 | 2 | 0 | 0 | 1 | ✅ identique |

**Treize concordances exactes sur treize, quatre lignes publiées à chaque fois — aucun écart.** Le cas Retiers confirme que l'anomalie d'UAI du §7 (un « Lycée la Mennais » dupliqué et mal localisé dans l'annuaire) ne correspond à aucun lycée réel à Retiers : l'INSEE, comme la BPE, y comptent bien 0 lycée. Le cas Hédé-Bazouges confirme à l'inverse qu'un lycée agricole (C303) peut être correctement compté par la BPE et l'INSEE tout en étant absent de l'annuaire de l'éducation (tenu par une Maison Familiale Rurale, hors périmètre de cet annuaire).

---

## 7. Anomalies rencontrées et arbitrages

1. **Anomalie de données dans l'annuaire de l'éducation — UAI dupliqué et mal localisé.** L'UAI `0350778F` apparaît **deux fois** dans l'export départemental : une fois comme « Lycée Assomption » à Rennes (code_commune `35238`, adresse et géocodage cohérents), une fois comme « Lycée la Mennais » avec le **même** code_commune `35238` mais un `nom_commune` = « Retiers » et un géocode **strictement identique** (mêmes latitude/longitude à 15 décimales) à la première ligne. C'est manifestement une ligne dupliquée et mal renseignée par la DEPP, pas un second établissement réel. Deux contrôles indépendants tranchent : IVAL montre cet UAI comme « Lycée Assomption » à Rennes sur **14 sessions consécutives** (2012 à 2025, jamais Retiers) ; et le Dossier complet de l'INSEE (§6) confirme que Retiers compte 0 lycée. Notre dédoublonnage global par UAI retient donc la ligne Rennes. Conséquence assumée : si un véritable « Lycée la Mennais » existe par ailleurs à Retiers sous un UAI distinct non présent dans cet export, il resterait invisible dans `annuaireLycees` pour Retiers — mais `lycees` (BPE, source de référence) n'est pas affecté et vaut 0, conforme à l'INSEE.
2. **Onze lycées polyvalents dédoublonnés dans `nbLyceesEvaluesBac`** (une ligne IVAL GT + une ligne IVAL PRO sous le même UAI, comptées une seule fois) : `0350005R` Yvon Bourges (Dinard), `0350030T` Pierre Mendès France (Rennes), `0350048M` Jacques Cartier (Saint-Malo), `0350769W` Jean-Baptiste Le Taillandier (Fougères), `0350791V` Marcel Callo (Redon), `0350793X` Frédéric Ozanam (Cesson-Sévigné), `0350795Z` De La Salle (Rennes), `0350797B` Jeanne d'Arc (Rennes), `0350808N` Sainte Jeanne d'Arc (Vitré), `0351930H` La Providence (Montauban-de-Bretagne), `0352072M` Institution Saint-Malo-Providence (Saint-Malo). `nbPresentsBac`, `tauxReussiteBac` et `vaBac` restent inchangés (les deux lignes sont cumulées dans la pondération), seul le décompte d'établissements est affecté.
3. **Dix établissements à VA absente malgré un taux brut publié** (petits effectifs, DEPP) : 9 collèges (IVAC) et 1 lycée professionnel (`0351930H` La Providence, Montauban-de-Bretagne) sont dans ce cas. Le taux brut communal reste calculé sur l'ensemble des candidats ; la VA communale, quand elle existe, est recalculée sur le seul sous-ensemble équipé.
4. **Un collège hors-contrat absent d'IVAC** : Sixt-sur-Aff (`0353096A` Collège privé hors-contrat Hêtre et devenir).
5. **Aucune ligne du fichier de dénombrement BPE filtré n'est orpheline** : les 128 codes INSEE cibles ont chacun au moins une ligne dans `bpe_35_schools.csv`, et l'assertion d'égalité entre l'ensemble des codes cibles et l'ensemble des codes agrégés a été vérifiée programmatiquement (128 = 128).

---

## 8. Fichiers produits

- `data/raw/ille-et-vilaine/ecoles.json` — 128 communes, mêmes champs que `data/raw/metropole-lyon/ecoles.json`.
- Résumé départemental : 486 écoles, 115 collèges, 96 lycées (dont 40 lycées GT et 56 lycées pro/agri.) sur les 128 communes ; 54/128 communes avec indicateur DNB, 19/128 avec indicateur bac.
