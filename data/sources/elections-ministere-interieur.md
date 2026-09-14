# Historique électoral — ministère de l'Intérieur et Répertoire national des élus, national

Import : `node scripts/importer-elections.mjs [--dossier <cache>]` →
`data/raw/<département>/elections.json` pour toutes les communes (la grille des nuances
`nuances.json`, nationale, est copiée dans chaque département).

- Fichiers nationaux (data.gouv.fr, Licence Ouverte 2.0), identiques à la première extraction :
  municipales 2026 résultats par commune 1er tour (20 mars 2026) et 2nd tour (23 mars 2026),
  candidatures du 1er tour (têtes de liste, dont les noms sont vides dans les résultats),
  Répertoire national des élus « maires » (version du 11 août 2026), européennes 2024
  résultats définitifs par commune, présidentielle 2022 1er et 2nd tour par commune
  (fichiers `.txt` en latin1, code commune sur trois chiffres).
- **Règles** : tout est repris tel que publié (libellés, codes de nuance, voix, pourcentages),
  aucun qualificatif. Listes classées par voix ; tour décisif = 2 si la commune figure au
  fichier du second tour, sinon 1. La nuance n'est rattachée au maire que s'il était tête de
  la liste arrivée en tête (comparaison des noms normalisés avec le RNE). Européennes : les
  cinq premières listes conservées, le nombre total dans `eur2024_nbListes`.
- **Fusions postérieures au 24 avril 2022** : le résultat présidentiel d'une commune nouvelle
  est reconstitué en additionnant les communes de 2022 (mouvements « 32 » du COG 2025,
  `v_mvt_commune_2025.csv`), pourcentages recalculés sur le total, et signalé par
  `pres2022_agregeDepuis` — 65 communes concernées. Le ministère ne publie pas ce total.
- Paris, Lyon et Marseille figurent au niveau commune dans tous ces fichiers.
- Couverture : 34 672 communes avec des municipales 2026, 34 620 avec un maire, 34 732 aux
  européennes. Contrôle : mêmes valeurs que l'extraction précédente sur les 87 communes de
  l'Ain (Ambérieu-en-Bugey, Culoz avec Béon absorbée).
