# Critère « Historique politique » (`elections`)

> Note de source vérifiée le **6 septembre 2026**. Toutes les URL listées ci-dessous ont
> effectivement renvoyé un **HTTP 200** lors de cette vérification (téléchargements refaits en
> direct pendant cette tâche, mêmes tailles d'octets qu'une vérification antérieure de la veille
> sur les mêmes ressources), et le contenu de chaque fichier a été ouvert et contrôlé sur les
> 128 communes du référentiel du département d'Ille-et-Vilaine (35).

Méthodologie **identique** à celle déjà validée pour la Métropole de Lyon
(`data/sources/metropole-lyon/elections.md`) : mêmes scrutins, mêmes jeux de données du ministère
de l'Intérieur, mêmes règles d'affichage. Seules les particularités propres à l'Ille-et-Vilaine
sont détaillées ici ; se reporter au document Lyon pour la justification générale du choix des
scrutins et des règles d'affichage (non reproduites intégralement pour éviter la redondance).

---

## 1. Scrutins retenus

| # | Scrutin | Date | Couverture réelle constatée |
|---|---------|------|----------|
| 1 | **Élections municipales 2026** (1er et 2nd tour) | 15 et 22 mars 2026 | T1 : **128/128**. T2 : **16/128** (les 112 autres ont élu leur conseil dès le 1er tour). |
| 2 | **Élections européennes 2024** | 9 juin 2024 | **128/128** |
| 3 | **Élection présidentielle 2022** (1er et 2nd tour) | 10 et 24 avril 2022 | **128/128** (dont 1 commune reconstituée par agrégation, voir §3) |

---

## 2. Sources

Producteur unique : **Ministère de l'Intérieur** (organisation data.gouv.fr
`ministere-de-linterieur`). Ce sont **les mêmes fichiers nationaux** que ceux utilisés pour la
Métropole de Lyon (un seul CSV « France entière », filtré ici sur le département `35` au lieu du
`69`) ; ils ont été **retéléchargés intégralement pendant cette tâche** (et non réutilisés depuis
une exécution antérieure) pour garantir que chaque valeur provient d'une réponse HTTP obtenue
durant ce travail.

| Jeu | URL | Taille obtenue (HTTP 200, ce jour) |
|---|---|---|
| Municipales 2026 — 1er tour, résultats par commune | `https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260320-164339/municipales-2026-resultats-communes-2026-03-20.csv` | 14 423 228 octets |
| Municipales 2026 — 2nd tour, résultats par commune | `https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-scond-tour/20260323-180124/municipales-2026-resultats-communes-2026-03-23-16h14.csv` (noter la faute de frappe officielle `du-scond-tour`) | 893 849 octets |
| Municipales 2026 — candidatures France entière T1 (têtes de liste) | `https://static.data.gouv.fr/resources/elections-municipales-2026-listes-candidates-au-premier-tour/20260313-152615/municipales-2026-candidatures-france-entiere-tour-1-2026-03-13.csv` | 144 523 474 octets |
| Européennes 2024 — résultats définitifs par commune | `https://static.data.gouv.fr/resources/resultats-des-elections-europeennes-du-9-juin-2024/20240613-154634/resultats-definitifs-par-commune.csv` | 126 707 881 octets |
| Présidentielle 2022 — 1er tour, résultats par commune | `https://static.data.gouv.fr/resources/election-presidentielle-des-10-avril-et-24-avril-2022-resultats-du-1er-tour/20220411-110616/resultats-par-niveau-subcom-t1-france-entiere.txt` | 17 579 378 octets |
| Présidentielle 2022 — 2nd tour, résultats par commune | `https://static.data.gouv.fr/resources/election-presidentielle-des-10-et-24-avril-2022-resultats-du-second-tour/20220425-100403/resultats-par-niveau-subcom-t2-france-entiere.txt` | 6 092 456 octets |
| Répertoire national des élus — maires (version 2026-08-11) | `https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/20260811-155100/elus-maire-mai.csv` | 4 257 507 octets |

Licences : Licence Ouverte v2.0 (Etalab) pour tous les jeux, sauf la présidentielle 2022 2nd tour
(licence déclarée « non spécifiée » sur data.gouv.fr, bien que produite par le même service).

Encodages vérifiés par lecture d'octets bruts : municipales 2026 (T1, T2, candidatures),
européennes 2024 et RNE sont en **UTF-8** ; présidentielle 2022 (T1 et T2) est en **cp1252
(Windows-1252)**, conformément à ce qui avait déjà été documenté pour Lyon.

**Format inattendu du fichier présidentielle 2022** : l'en-tête du fichier ne comporte que **26
colonnes** (dont un seul bloc « candidat »), mais chaque ligne de données en comporte en réalité
**103** (19 colonnes générales + 12 blocs de 7 colonnes, un par candidat, non nommés
individuellement dans l'en-tête). C'est le même fichier structurellement pour le 2nd tour, avec
seulement 2 blocs candidat (33 colonnes de données). Il s'agit d'une **ligne unique par commune**
avec tous les candidats en largeur, et non d'une ligne par candidat : à bien distinguer lors du
découpage par blocs de colonnes.

---

## 3. Clé de jointure et cas particuliers

### Recherche systématique des communes nouvelles à agréger

Plutôt que de se fier uniquement à la liste de communes nouvelles bretonnes fournie a priori,
une **comparaison exhaustive des 333 codes commune du fichier présidentielle 2022 (dept. 35)
contre les 331 codes du fichier municipales 2026** a été effectuée. Elle fait apparaître
exactement deux codes présents en 2022 et absents en 2026 : `35050` (Cardroc) et `35112`
(Fleurigné). C'est la méthode la plus fiable pour détecter tout regroupement communal survenu
entre les deux scrutins, y compris ceux non anticipés.

#### La Chapelle-Fleurigné (35062) — commune nouvelle du 1er janvier 2024 → agrégation nécessaire

| Scrutin | État du fichier |
|---|---|
| Municipales 2026 | **Déjà fusionnée** : une seule ligne `35062 La Chapelle-Fleurigné`. `35112` absent. |
| Européennes 2024 (9 juin 2024) | **Déjà fusionnée** : une seule ligne `35062 La Chapelle-Fleurigné`. `35112` absent. |
| Présidentielle 2022 (avril 2022) | **Deux lignes séparées** : `35062 La Chapelle-Janson` (code conservé par la commune nouvelle) et `35112 Fleurigné`. **Agrégation obligatoire.** |

Règle d'agrégation, identique à celle appliquée à Oullins-Pierre-Bénite pour Lyon : **sommer les
effectifs bruts** (`Inscrits`, `Votants`, `Abstentions`, `Exprimés`, `Blancs`, `Nuls`, `Voix` par
candidat) puis **recalculer les pourcentages** sur ces sommes. Contrôle : T1 — 1070 + 786 = 1856
inscrits, votants 886 + 625 = 1511 ; T2 — mêmes 1856 inscrits, votants 904 + 648 = 1552. Champ
`pres2022_agregeDepuis`: `["35062", "35112"]`.

#### Cardroc (35050) — absence de fusion, hors périmètre

Cardroc n'est **pas** l'une des 128 communes cibles. Son cas a néanmoins été creusé car sa
disparition du fichier municipales 2026 aurait pu, comme Fleurigné, signaler une fusion avec une
commune du périmètre. Vérifications effectuées :

- Le Code officiel géographique de l'INSEE au 1er janvier 2026 confirme explicitement qu'**aucune
  commune nouvelle n'a été créée dans le département entre janvier 2025 et janvier 2026** (les
  créations de communes nouvelles sont suspendues l'année d'élections municipales) ;
- Le fichier officiel des **candidatures** municipales 2026 contient une ligne `35050 Cardroc`
  mais **entièrement vide** (aucune liste déposée) ;
- Cardroc figure toujours, seule, dans le fichier de population de référence INSEE le plus
  récent disponible (589 + 12 = 601 habitants).

Conclusion : Cardroc n'a fusionné avec aucune commune du périmètre ; l'absence de résultat
municipal 2026 s'explique par l'absence de candidature, pas par un changement de périmètre. Sans
conséquence sur ce livrable, documenté ici par souci de traçabilité de l'audit.

#### Les 6 autres communes nouvelles bretonnes signalées a priori

Val-Couesnon (35004), Val d'Anast (35168), Les Portes du Coglais (35191), Maen Roch (35257),
Rives-du-Couesnon (35282), Mesnil-Roc'h (35308), Val-d'Izé (35347) sont toutes des fusions
**antérieures à avril 2022** (créées entre 2016 et 2019). Vérifié : elles apparaissent déjà
fusionnées, avec des effectifs pleins et plausibles, dans les **quatre** fichiers de résultats
(municipales 2026 T1/T2, européennes 2024, présidentielle 2022 T1/T2). Exemple de contrôle —
inscrits présidentielle 2022 T1 : Val-Couesnon 3023, Val d'Anast 2924, Les Portes du Coglais 1687,
Maen Roch 3420, Rives-du-Couesnon 1997, Mesnil-Roc'h 3221, Val-d'Izé 1937. **Aucune agrégation
nécessaire** pour ces 7 communes.

### Rennes (35238) — vérifiée, pas d'arrondissements municipaux

Contrairement à Lyon, Marseille et Paris, **Rennes n'est pas une commune à arrondissements** au
sens du code général des collectivités territoriales : elle n'élit donc pas de conseils
d'arrondissement. Vérification effective (et non supposée) : recherche de toute occurrence de la
chaîne `35238` dans les fichiers municipales 2026 (T1 et T2) et européennes 2024 — **une seule
occurrence trouvée dans chaque fichier**, la ligne commune `35238 Rennes`. Aucun code sectoriel de
type `35238SR0x` n'existe. Rennes se traite donc exactement comme n'importe quelle autre commune
du jeu, sans étape d'agrégation ni de désagrégation.

### Autres communes

Aucun autre cas particulier. Les 128 communes cibles se joignent directement sur leur code INSEE
actuel dans les quatre fichiers de résultats.

---

## 4. Couverture réellement constatée (6 septembre 2026)

| Scrutin | Communes trouvées |
|---|---|
| Municipales 2026 — 1er tour | **128 / 128** |
| Municipales 2026 — 2nd tour | 16 / 128 (les 112 autres ont élu leur conseil dès le 1er tour) |
| Européennes 2024 | **128 / 128** |
| Présidentielle 2022 T1 et T2 | **128 / 128** (129 lignes sources agrégées pour La Chapelle-Fleurigné : 35062 + 35112) |
| Maire (RNE, version 2026-08-11) | **128 / 128** |

Aucune commune manquante.

**Communes ayant un second tour (15 mars → 22 mars 2026)** : Bains-sur-Oust (35013),
Chartres-de-Bretagne (35066), Cintré (35080), Fougères (35115), Guichen (35126), Montgermont
(35189), Noyal-sur-Vilaine (35207), Pacé (35210), Pleurtuit (35228), Rennes (35238), Maen Roch
(35257), Saint-Jacques-de-la-Lande (35281), Saint-Lunaire (35287), Saint-Malo (35288),
La Richardais (35241), Vezin-le-Coquet (35353). Les 112 autres communes ont élu leur conseil
municipal dès le 1er tour (`mun2026_t2_statut = "conseil_municipal_elu_au_premier_tour"`).

---

## 5. Méthodologie d'affichage

Identique à celle décrite pour Lyon (voir `metropole-lyon/elections.md` §5) : participation et
abstention en % des inscrits, score de liste/candidat en % des suffrages exprimés (jamais
recalculé sauf pour la commune agrégée), nuance politique reprise telle quelle depuis le fichier
de RÉSULTATS, nom de tête de liste au 1er tour repris du fichier de CANDIDATURES quand la colonne
`Nom candidat N` du fichier de résultats T1 est vide (constaté vide pour les 128 communes, comme
pour Lyon), nom du maire issu exclusivement du RNE. Les tableaux `*_listes` / `*_candidats` sont
classés par voix décroissantes (le rang du fichier source, fondé sur le numéro de panneau,
n'est pas conservé).

**Constat propre à ce jeu de 128 communes** : dans les 128 cas, le maire enregistré au RNE est la
tête de la liste arrivée en tête au tour décisif (`maire_estTeteDeListeArriveeEnTete = true`
partout), y compris pour des villes à listes multiples comme Rennes, Saint-Malo, Fougères ou Vitré.
Ce constat, vérifié nominativement (comparaison exacte nom + prénom, pas seulement une
correspondance approximative), contraste avec la Métropole de Lyon où une exception avait été
relevée (Sainte-Foy-lès-Lyon). Il est présenté ici comme un fait vérifié, sans commentaire ni
interprétation.

### Nuances politiques

Les codes de nuance rencontrés dans les 128 communes ont été comparés au référentiel national déjà
constitué pour Lyon (`data/raw/metropole-lyon/nuances.json`, copié tel quel dans
`data/raw/ille-et-vilaine/nuances.json`) :

- Municipales 2026, tous rangs confondus (1 à 11 listes selon la commune) : `LDIV`, `LDVC`,
  `LDVD`, `LDVG`, `LECO`, `LEXG`, `LFI`, `LLR`, `LREG`, `LRN`, `LUC`, `LUG`.
- Européennes 2024, y compris au-delà des 5 premières listes retenues dans le livrable (recherche
  exhaustive sur les 38 listes, pour les 128 communes) : `LCOM`, `LDIV`, `LDVD`, `LDVG`, `LECO`,
  `LENS`, `LEXD`, `LEXG`, `LFI`, `LLR`, `LREC`, `LRN`, `LUG`, `LVEC`.

**Aucun code non documenté rencontré.** Tous les codes ci-dessus figuraient déjà dans le
référentiel constitué pour Lyon ; `nuances.json` a donc été copié sans modification
(`codesNonDocumentes` reste vide).

---

## 6. Limites à afficher à l'utilisateur

Les limites générales sont identiques à celles documentées pour Lyon (voir §7 du document
`metropole-lyon/elections.md`) : les résultats décrivent le corps électoral et non la population,
un score municipal ne se compare pas à un score national, les nuances sont des étiquettes
administratives, les communes sans 2nd tour n'ont pas de participation comparable au 2nd tour, les
listes/candidats sont tronqués au-delà de 5 pour les scrutins à offre large (européennes,
présidentielle), les données sont figées à leur date de publication.

Limites propres à l'Ille-et-Vilaine :

1. **La Chapelle-Fleurigné (35062)** n'existait pas en 2022 : ses résultats présidentiels sont la
   somme reconstruite de La Chapelle-Janson et de Fleurigné. Le taux de participation présidentiel
   2022 affiché pour cette commune est donc un recalcul, pas un chiffre publié tel quel par le
   ministère.
2. **Rennes n'a pas d'arrondissements municipaux** : contrairement à Lyon, aucun détail
   infra-communal n'est disponible ni pertinent pour cette commune.
3. **Uniformité maire / tête de liste.** Dans les 128 communes, le maire est toujours la tête de
   la liste arrivée en tête au tour décisif. Ce constat, vérifié, ne doit pas être présenté comme
   une règle générale du droit électoral (le conseil municipal élit formellement le maire en son
   sein et pourrait en théorie désigner un autre conseiller).

---

## 7. Licences et attribution

Identique à Lyon : Licence Ouverte / Open Licence v2.0 (Etalab) pour tous les jeux utilisés, sauf
la présidentielle 2022 2nd tour (licence déclarée « non spécifiée » sur data.gouv.fr).

Mention à afficher : *« Source : ministère de l'Intérieur, résultats électoraux officiels et
Répertoire national des élus, via data.gouv.fr — Licence Ouverte 2.0. »*
