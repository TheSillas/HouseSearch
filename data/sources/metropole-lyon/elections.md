# Critère « Historique politique » (`elections`)

> Note de source vérifiée le **5 septembre 2026**. Toutes les URL listées ci-dessous ont
> effectivement renvoyé un **HTTP 200** lors de cette vérification, et le contenu de chaque
> fichier a été ouvert et contrôlé sur les 32 communes du référentiel.

---

## 1. Scrutins retenus

Trois scrutins, du plus récent au plus ancien :

| # | Scrutin | Date | Pourquoi |
|---|---------|------|----------|
| 1 | **Élections municipales 2026** (1er et 2nd tour) | 15 et 22 mars 2026 | Scrutin le plus récent, scrutin local par excellence. **Tenue et résultats officiels vérifiés** : les deux jeux de données du ministère de l'Intérieur existent et sont complets. |
| 2 | **Élections européennes 2024** | 9 juin 2024 | Scrutin de liste à **circonscription nationale unique** : les mêmes 38 listes sont proposées dans les 32 communes, donc les résultats sont **directement comparables d'une commune à l'autre**. |
| 3 | **Élection présidentielle 2022** (1er et 2nd tour) | 10 et 24 avril 2022 | Scrutin national, mêmes 12 candidats partout, forte participation, sert de repère de fond. |

**Pourquoi européennes 2024 plutôt que législatives 2024 ?** Les législatives se jouent par
circonscription : les candidats ne sont pas les mêmes d'une commune à l'autre, et une même
commune peut être coupée entre deux circonscriptions. Comparer « le candidat arrivé en tête »
entre Lyon et Genas n'aurait donc pas de sens. Les fichiers législatifs 2024 par commune restent
listés en annexe (§6) pour qui voudrait les afficher, mais ils ne sont pas retenus par défaut.

**Vérification du millésime** : au 5 septembre 2026, le dernier scrutin national publié par le
ministère de l'Intérieur sur data.gouv.fr reste les **législatives des 30 juin / 7 juillet 2024**.
Aucun jeu « législatives 2025 » ou « législatives 2026 » n'existe sur data.gouv.fr (recherche API
effectuée sur l'organisation `ministere-de-linterieur`). Le dernier scrutin toutes catégories est
donc bien les municipales de mars 2026.

---

## 2. Sources

Producteur unique : **Ministère de l'Intérieur** (organisation data.gouv.fr
`ministere-de-linterieur`, id `534fff91a3a7292c64a77f53`).

### 2.1 Municipales 2026 — 1er tour

- Page : https://www.data.gouv.fr/datasets/elections-municipales-2026-resultats-du-premier-tour
- Dataset id : `69b82a7de5d58cc06ad35ce0` — licence **Licence Ouverte v2.0 (lov2)** — dernière modification `2026-03-20`
- Ressource **« Municipales 2026 - Résultats - Communes_2026-03-20.csv »**
  - resource id `4feeef01-24f7-4d5a-914f-8aa806f31ec2`
  - URL : https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260320-164339/municipales-2026-resultats-communes-2026-03-20.csv
  - CSV `;`, **UTF-8**, 34 836 lignes, 187 colonnes, ~13,8 Mo
  - ⚠️ l'API tabulaire renvoie **HTTP 410** sur cette ressource (déclarée supprimée côté index tabulaire le 2026-04-02) : il faut **télécharger le CSV statique**, qui lui répond bien 200.
- Ressource **« Municipales 2026 - Candidatures - France entière - Tour 1 »** (têtes de liste)
  - resource id `b929c2a4-18ec-4e8b-bc37-2ff346a867cd` (page : `elections-municipales-2026-listes-candidates-au-premier-tour`)
  - URL : https://static.data.gouv.fr/resources/elections-municipales-2026-listes-candidates-au-premier-tour/20260313-152615/municipales-2026-candidatures-france-entiere-tour-1-2026-03-13.csv
  - CSV `;`, UTF-8, ~138 Mo. Contient `Code circonscription` (= code INSEE 5 car.), `Numéro de panneau`, `Tête de liste` (OUI/vide), `Nom sur le bulletin de vote`, `Prénom sur le bulletin de vote`.

### 2.2 Municipales 2026 — 2nd tour

- Page : https://www.data.gouv.fr/datasets/elections-municipales-2026-resultats-du-second-tour
- Dataset id `69c17fed9f18c7781fd11a14` — licence **lov2** — dernière modification `2026-03-23`
- Ressource **« Municipales 2026 - Résultats - Communes_2026-03-23_16h14.csv »**
  - resource id `6ff67a28-01bf-459e-beca-dd7aa8132dc1`
  - URL : https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-scond-tour/20260323-180124/municipales-2026-resultats-communes-2026-03-23-16h14.csv
  - CSV `;`, UTF-8, 1 526 lignes (uniquement les communes passées au 2nd tour), 83 colonnes, ~873 Ko
  - API tabulaire **disponible** : `https://tabular-api.data.gouv.fr/api/resources/6ff67a28-01bf-459e-beca-dd7aa8132dc1/data/?Code%20commune__exact=69123`
  - ⚠️ noter la faute de frappe **`du-scond-tour`** (et non `du-second-tour`) dans le chemin statique : c'est bien l'URL officielle.

### 2.3 Municipales 2026 — détail par arrondissement de Lyon (facultatif)

- « Conseils d'arrondissement Paris Lyon Marseille 2026 - Résultats - Secteurs » — T1 : resource `46a6a820-f9fa-42ab-9486-f536568a1350`, T2 : resource `966a28fb-8de6-4a6d-a32f-5595388e7a76`
- T1 : https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260316-160627/conseils-darrondissement-paris-lyon-marseille-2026-resultats-secteurs-2026-03-16.csv
- T2 : https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-scond-tour/20260323-180123/conseils-d-39-arrondissement-paris-lyon-marseille-2026-resultats-secteurs-2026-03-23-16h22.csv

### 2.4 Répertoire national des élus (RNE) — nom du maire

- Page : https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1
- Dataset id `5c34c4d1634f4173183a64f1` — licence **lov2** — fréquence déclarée **trimestrielle**
- Ressource **`elus-maires-mai.csv`**, resource id `2876a346-d50c-4911-934e-19ee07b0e503`,
  version en ligne datée du **2026-08-11** (donc postérieure aux municipales de mars 2026)
  - URL : https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/20260811-155100/elus-maire-mai.csv
  - CSV `;`, UTF-8, ~4,1 Mo
  - API tabulaire disponible : `https://tabular-api.data.gouv.fr/api/resources/2876a346-d50c-4911-934e-19ee07b0e503/data/?Code%20de%20la%20commune__exact=69123`

### 2.5 Européennes 2024

- Page : https://www.data.gouv.fr/datasets/resultats-des-elections-europeennes-du-9-juin-2024
- Dataset id `666b1337471f4fe2f19f2573` — licence **lov2** — dernière modification `2024-06-13`
- Ressource **`resultats-definitifs-par-commune.csv`**, resource id `6a782ef9-8ad6-4e66-832d-338b1041a42d`
  - URL : https://static.data.gouv.fr/resources/resultats-des-elections-europeennes-du-9-juin-2024/20240613-154634/resultats-definitifs-par-commune.csv
  - CSV `;`, UTF-8, 35 228 lignes, **322 colonnes** (38 listes × 8 colonnes), ~121 Mo
  - API tabulaire **indisponible** (HTTP 404) : téléchargement du CSV obligatoire.

### 2.6 Présidentielle 2022

- 1er tour — page : https://www.data.gouv.fr/datasets/election-presidentielle-des-10-et-24-avril-2022-resultats-du-1er-tour
  (dataset id `6253eea27f69325894b0d111`, licence **lov2**)
  - Ressource `resultats-par-niveau-subcom-t1-france-entiere.txt`, resource id `1ffb6125-1cea-4a03-80be-520c1c3a5411`
  - URL : https://static.data.gouv.fr/resources/election-presidentielle-des-10-avril-et-24-avril-2022-resultats-du-1er-tour/20220411-110616/resultats-par-niveau-subcom-t1-france-entiere.txt
- 2nd tour — page : https://www.data.gouv.fr/datasets/election-presidentielle-des-10-et-24-avril-2022-resultats-du-second-tour
  (dataset id `6266551796a2768dc434dbf9`, licence **déclarée « non spécifiée »** sur data.gouv.fr)
  - Ressource `resultats-par-niveau-subcom-t2-france-entiere.txt`, resource id `0c9751e6-91ef-4387-9512-1322a4a52fbf`
  - URL : https://static.data.gouv.fr/resources/election-presidentielle-des-10-et-24-avril-2022-resultats-du-second-tour/20220425-100403/resultats-par-niveau-subcom-t2-france-entiere.txt
- Fichiers **`;`-séparés, encodage `cp1252` / Windows-1252** (et non UTF-8), 35 035 lignes, extension `.txt` mais contenu CSV.
- Malgré le nom « subcom », le fichier est bien **au niveau commune** : Paris = 1 ligne, Marseille = 1 ligne, Lyon = 1 ligne. Aucun arrondissement.
- ⚠️ Ne **pas** passer par l'API tabulaire pour ces deux ressources : son inférence de types casse
  les colonnes (`Code de la commune` renvoyé comme entier `123` au lieu de `"123"`,
  `Libellé de la commune` à `null`, `% Vot/Ins` arrondi à `81`).

---

## 3. Clé de jointure et cas particuliers

| Fichier | Colonne code commune | Format |
|---|---|---|
| Municipales 2026 T1/T2 | `Code commune` | INSEE 5 caractères (`69123`) |
| Municipales 2026 candidatures | `Code circonscription` | INSEE 5 caractères |
| Européennes 2024 | `Code commune` | INSEE 5 caractères |
| Présidentielle 2022 | `Code du département` + `Code de la commune` | `"69"` + `"123"` → à **concaténer** |
| RNE maires | `Code de la commune` | INSEE 5 caractères |

### Lyon (69123) — le piège n'est pas celui attendu

Contrairement aux fichiers de populations légales de l'INSEE, **aucun fichier de résultats
électoraux du ministère de l'Intérieur n'utilise les codes INSEE d'arrondissement 69381–69389.**
Vérifié sur les quatre scrutins : ces codes sont absents des fichiers municipales 2026,
européennes 2024 et présidentielle 2022.

- Les fichiers « Résultats - Communes » et les fichiers présidentielle/européennes contiennent
  **une seule ligne `69123` = Lyon entier, déjà agrégée par le ministère**. Aucune agrégation
  manuelle n'est nécessaire.
- Le détail infra-communal existe uniquement dans le fichier PLM séparé (§2.3), sous des
  **codes secteur `69123SR01` à `69123SR09`** (« Lyon 1er secteur » … « Lyon 9eme secteur »),
  qui sont les résultats de l'élection des **conseils d'arrondissement**. À Lyon la
  correspondance secteur → arrondissement est 1 pour 1 : `69123SR01` ↔ Lyon 1er (69381),
  … `69123SR09` ↔ Lyon 9e (69389).
- Contrôle effectué : somme des inscrits des 9 secteurs au T1 = **320 984**, contre **321 176**
  pour la ligne commune `69123`. L'écart (192 inscrits) vient du fait que le fichier secteurs
  est un instantané du **16 mars** alors que le fichier communes a été réactualisé le **20 mars**.
  → **Toujours privilégier la ligne `69123` du fichier communes**, jamais une somme manuelle.

### Oullins-Pierre-Bénite (69149) — commune nouvelle du 1er janvier 2024

| Scrutin | État du fichier |
|---|---|
| Municipales 2026 | **Déjà fusionné** : une seule ligne `69149 Oullins-Pierre-Bénite`. `69152` absent. |
| Européennes 2024 (9 juin 2024) | **Déjà fusionné** : une seule ligne `69149 Oullins-Pierre-Bénite`. `69152` absent. |
| Présidentielle 2022 (avril 2022) | **Deux lignes séparées** : `69149 Oullins` et `69152 Pierre-Bénite`. **Agrégation obligatoire.** |

Règle d'agrégation pour la présidentielle 2022 : **sommer les effectifs bruts**
(`Inscrits`, `Votants`, `Abstentions`, `Exprimés`, `Blancs`, `Nuls`, `Voix` par candidat) puis
**recalculer les pourcentages**. Ne jamais moyenner les pourcentages publiés.

### Autres communes

Aucun autre cas particulier : les changements de département de 1968 (Saint-Priest, Meyzieu,
Décines, Mions, Genas, Corbas, Chassieu, Feyzin, Rillieux) et les fusions anciennes (Givors 1965,
Rillieux 1972) sont tous **antérieurs** aux scrutins retenus. Les 32 communes se joignent
directement sur leur code INSEE actuel.

---

## 4. Couverture réellement constatée (5 septembre 2026)

| Scrutin | Communes trouvées |
|---|---|
| Municipales 2026 — 1er tour | **32 / 32** |
| Municipales 2026 — 2nd tour | 15 / 32 (les 17 autres ont élu leur conseil dès le 1er tour) |
| Européennes 2024 | **32 / 32** |
| Présidentielle 2022 T1 et T2 | **32 / 32** (33 lignes sources, 69149 + 69152 agrégées) |
| Maire (RNE, version 2026-08-11) | **32 / 32** |

Aucune commune manquante.

**Communes dont le conseil municipal a été élu dès le 1er tour (15 mars 2026)** :
69027 Brignais, 69029 Bron, 69034 Caluire-et-Cuire, 69040 Champagne-au-Mont-d'Or,
69069 Craponne, 69081 Écully, 69089 Francheville, 69149 Oullins-Pierre-Bénite,
69191 Saint-Cyr-au-Mont-d'Or, 69202 Sainte-Foy-lès-Lyon, 69244 Tassin-la-Demi-Lune,
69273 Corbas, 69276 Feyzin, 69277 Genas, 69283 Mions, 69286 Rillieux-la-Pape,
69290 Saint-Priest.

Recoupement de cohérence : ces 17 codes correspondent exactement aux 17 communes dont le maire
a, dans le RNE, une `Date de début du mandat` au **2026-03-15** ; les 15 autres ont **2026-03-22**.

---

## 5. Méthodologie d'affichage

### Grandeurs publiées

- **Taux de participation** = `Votants / Inscrits`. Publié directement dans la colonne
  `% Votants` (municipales 2026, européennes 2024) ou calculable via `% Vot/Ins`
  (présidentielle 2022). Pour une commune agrégée, recalculer.
- **Taux d'abstention** = `Abstentions / Inscrits` (colonne `% Abstentions` / `% Abs/Ins`).
  Participation + abstention = 100 %.
- **Score d'une liste / d'un candidat** = **pourcentage des suffrages exprimés**
  (`Voix N / Exprimés`), colonne `% Voix/exprimés N` / `% Voix/Exp`. C'est la grandeur
  standard ; les blancs et nuls sont exclus des exprimés.
- **Sièges** au conseil municipal : colonne `Sièges au CM N` (municipales 2026 uniquement).

### Nuance politique

La colonne `Nuance liste N` / `Nuance candidat N` contient le **code de nuance officiel attribué
par le ministère de l'Intérieur** (LDVG, LDVC, LUG, LFI, LRN, LLR, LEXG, LDVD, LENS, LECO…).

**Règle éditoriale : afficher ce code (et son libellé officiel) tel quel, sans reformulation,
sans qualificatif ajouté, sans classement gauche/droite maison, sans commentaire.** La nuance est
une donnée administrative produite par l'administration, pas une analyse du site.

⚠️ La nuance peut différer entre le fichier de **candidatures** et le fichier de **résultats** :
le ministère a révisé certaines nuances entre les deux publications (exemple constaté : liste
Doucet à Lyon, `LUG` dans les candidatures du 13 mars, `LDVG` dans les résultats du 2nd tour).
**Faire foi du fichier de résultats.**

### Nom de la tête de liste

Le fichier « Résultats - Communes » du **2nd tour** renseigne `Nom candidat N` / `Prénom candidat N`.
Le fichier du **1er tour** laisse ces colonnes **vides pour les 17 communes élues au 1er tour**.
Pour ces communes, récupérer la tête de liste dans le fichier de candidatures (§2.1) :
filtrer `Code circonscription` = code INSEE **et** `Tête de liste` = `OUI`, puis joindre sur
`Numéro de panneau` ↔ `Numéro de panneau N` du fichier de résultats. Vérifié : 32/32 communes
couvertes par ce fichier.

### Nom du maire

Colonnes `Nom de l'élu`, `Prénom de l'élu`, `Date de début du mandat`, `Date de début de la
fonction` du RNE. **Le RNE ne contient aucune information d'étiquette politique** : ne jamais
tenter d'y accoler une nuance. La nuance de la liste gagnante vient du fichier de résultats.

---

## 6. Annexe — législatives 2024 (non retenues par défaut)

Vérifiées HTTP 200, licence lov2, format CSV `;` UTF-8, colonne `Code commune` en INSEE 5 car. :

- 1er tour (30 juin 2024) : resource `bd32fcd3-53df-47ac-bf1d-8d8003fe23a1` —
  https://static.data.gouv.fr/resources/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-1er-tour/20240711-075056/resultats-definitifs-par-communes.csv (~73 Mo)
- 2nd tour (7 juillet 2024) : resource `5a8088fd-8168-402a-9f40-c48daab88cd1` —
  https://static.data.gouv.fr/resources/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-2nd-tour/20240710-170606/resultats-definitifs-par-commune.csv (~12 Mo)

---

## 7. Limites à afficher à l'utilisateur

1. **Les résultats sont ceux du bureau de vote, pas ceux des habitants.** Le corps électoral
   d'une commune ne recouvre pas sa population : les mineurs et les résidents étrangers
   non-communautaires ne votent pas, et beaucoup d'habitants restent inscrits ailleurs. À Lyon,
   321 188 inscrits au 2nd tour des municipales 2026 pour 519 127 habitants.
2. **Un score municipal ne se compare pas à un score national.** Une élection municipale se joue
   sur des listes locales, souvent sans étiquette nationale et parfois d'union ; rapprocher le
   score d'une liste municipale de celui d'un parti aux européennes est trompeur.
3. **Les nuances sont des étiquettes administratives.** Elles sont attribuées par les préfectures
   selon une grille du ministère de l'Intérieur, parfois contestées par les candidats eux-mêmes,
   et peuvent être révisées entre deux publications. Elles ne constituent ni un positionnement
   validé par la liste, ni une analyse du site.
4. **Les 17 communes élues dès le 1er tour n'ont pas de 2nd tour** : le comparatif de
   participation entre communes doit préciser de quel tour il parle.
5. **Périmètres communaux.** Oullins-Pierre-Bénite n'existait pas en 2022 : ses résultats
   présidentiels sont la somme reconstruite d'Oullins (69149) et Pierre-Bénite (69152). Le taux
   de participation présidentiel 2022 affiché pour cette commune est donc un recalcul, pas un
   chiffre publié tel quel par le ministère.
6. **Lyon est publié en un seul bloc.** Les écarts entre le 1er et le 9e arrondissement sont
   réels mais ne figurent pas dans le chiffre commune ; le détail par arrondissement, s'il est
   affiché, provient d'un scrutin distinct (conseils d'arrondissement) et d'un instantané
   antérieur (16 mars).
7. **Données figées, non rafraîchies en continu.** Les fichiers municipales 2026 sont des
   publications ponctuelles (« punctual ») arrêtées aux 20 et 23 mars 2026. Une élection
   partielle, une annulation par le juge électoral ou une démission de maire postérieure n'y
   apparaît pas. Le RNE, lui, est mis à jour trimestriellement (version utilisée : 11 août 2026).
8. **Le site ne commente pas.** Aucun classement gauche/droite, aucun qualificatif, aucune
   interprétation n'est ajouté aux chiffres et aux nuances officiels.

---

## 8. Licences et attribution

- Municipales 2026 (T1, T2, candidatures), européennes 2024, présidentielle 2022 1er tour,
  législatives 2024, RNE : **Licence Ouverte / Open Licence v2.0 (Etalab)**.
- Présidentielle 2022 2nd tour : licence **déclarée « non spécifiée »** sur data.gouv.fr, bien
  que produite par le ministère de l'Intérieur comme le 1er tour. À signaler si l'on veut être
  strict sur la chaîne de droits.
- Mention à afficher : *« Source : ministère de l'Intérieur, résultats électoraux officiels et
  Répertoire national des élus, via data.gouv.fr — Licence Ouverte 2.0. »*
