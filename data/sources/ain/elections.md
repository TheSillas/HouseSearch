# Critère « Historique politique » (`elections`) — Ain

> Note vérifiée le 6 septembre 2026. Mêmes fichiers nationaux du ministère de l'Intérieur que
> pour la Métropole de Lyon et l'Ille-et-Vilaine (filtrés ici sur le département `01`),
> retéléchargés intégralement pendant cette tâche.

## 1. Scrutins retenus

Identiques aux deux autres régions : municipales 2026 (T1 + T2 quand nécessaire), européennes
2024, présidentielle 2022 (T1 + T2, T1 tronqué aux 5 premiers candidats comme pour les deux
autres régions — règle documentée dans `metropole-lyon/elections.md` §6 pour les scrutins à
offre large).

## 2. Sources et tailles obtenues (HTTP 200, ce jour)

| Jeu | Taille |
|---|---|
| Municipales 2026 T1 | 14 423 228 octets |
| Municipales 2026 T2 | 893 849 octets |
| Municipales 2026 candidatures T1 (têtes de liste) | 144 523 474 octets |
| Européennes 2024 | 126 707 881 octets |
| Présidentielle 2022 T1 | 17 579 378 octets |
| Présidentielle 2022 T2 | 6 092 456 octets |
| RNE — maires | 4 257 507 octets |

Tailles identiques à celles déjà documentées pour l'Ille-et-Vilaine : mêmes versions de
fichiers.

## 3. Format des codes département selon les jeux

Point de vigilance propre à cette extraction : le champ `code_departement` n'a pas le même
format selon le jeu de données. Les résultats électoraux (mun2026, eur2024) et le RNE utilisent
le code commune complet à 5 chiffres directement. Le fichier de la présidentielle 2022
(cp1252, colonnes non nommées individuellement au-delà de la 26e) sépare `Code du département`
(`01`) et `Code de la commune` (3 chiffres, à préfixer par le code département pour obtenir le
code INSEE complet).

## 4. Communes nouvelles et agrégation

Trois communes nouvelles dans le périmètre : Valserhône (01033, fusion 2019), Culoz-Béon
(01138, fusion 2023) et Plateau d'Hauteville (01185, fusion 2019). Seule Culoz-Béon nécessite
une agrégation : sa fusion (1er janvier 2023) est postérieure à la présidentielle 2022, dont les
résultats existent encore sous deux codes séparés (01138 Culoz, 01039 Béon) à cette date.
Résultats sommés (inscrits, votants, abstentions, exprimés, blancs, nuls, voix par candidat) puis
pourcentages recalculés sur ces sommes — même règle que pour Oullins-Pierre-Bénite (Lyon) et
La Chapelle-Fleurigné (Ille-et-Vilaine). Les municipales 2026 et européennes 2024, postérieures à
la fusion, sont déjà nativement sous le code actuel 01138. Valserhône et Plateau d'Hauteville
(fusions 2019) sont antérieures à toutes les élections de ce jeu : aucune agrégation requise.

## 5. Répertoire national des élus — couverture incomplète

**10 des 87 communes cibles sont absentes du RNE** (version du 2026-08-11) : Arbent (01014),
Balan (01027), Civrieux (01105), Plateau d'Hauteville (01185), Loyettes (01224), Meximieux
(01244), Oyonnax (01283), Pont-d'Ain (01304), Villieu-Loyes-Mollon (01450), Vonnas (01457).
Vérification effectuée : ces 10 codes sont valides, actuels, non concernés par une fusion
récente (recherche exhaustive dans le fichier des mouvements de communes) — leur absence est un
trou réel de cette publication du RNE, pas une erreur de raccordement. Le nom du maire reste
`null` pour ces 10 communes plutôt que d'être deviné.

## 6. Maire ≠ tête de liste arrivée en tête (2 cas sur 77 maires connus)

Sur les 77 communes où le maire est connu, **75 correspondent à la tête de la liste arrivée en
tête**, et **2 exceptions vérifiées** : à Valserhône, ni Guy Larmanjat (liste arrivée en tête) ni
Isabelle De Oliveira (2e liste) n'est devenu maire — c'est Anne-Laure Olliet, élue par le conseil
municipal parmi ses membres ; à Culoz-Béon, ni Déborah Gleyze ni Daniel Rossi n'est devenu maire
— c'est Jean-Marc Dupont. Ce sont des cas réels (le conseil municipal élit formellement le maire
en son sein, qui n'est pas nécessairement la tête de la liste arrivée en tête), du même type que
l'exception déjà relevée pour Sainte-Foy-lès-Lyon dans la note Lyon.

## 7. Anomalie de cache rencontrée (sans conséquence sur le livrable)

Un appel groupé initial à `geo.api.gouv.fr/departements/01/communes` a brièvement renvoyé des
noms de communes obsolètes pour deux communes nouvelles (« Bellegarde-sur-Valserine » au lieu de
« Valserhône », code 01033 ; nom antérieur à la fusion pour 01138). Un second appel, quelques
minutes plus tard, a renvoyé les noms actuels et corrects ; vérification croisée effectuée
commune par commune (appel unitaire `geo.api.gouv.fr/communes/{code}`) sur les 87 communes du
référentiel final : **0 écart**. Les fichiers de données produits utilisent tous le second appel
(noms corrects).

## 8. Limites à afficher à l'utilisateur

Identiques aux deux autres régions (voir `metropole-lyon/elections.md` §7) : les résultats
décrivent le corps électoral et non la population, un score municipal ne se compare pas à un
score national, les nuances sont des étiquettes administratives, les listes/candidats sont
tronqués au-delà de 5 pour les scrutins à offre large. Limite propre à ce jeu : nom du maire
absent pour 10 communes sur 87 (RNE incomplet, non reconstitué).
