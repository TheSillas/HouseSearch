# Fiscalité locale — taux de taxe foncière (DGFiP, REI 2025)

Import : `node scripts/importer-fiscalite.mjs [--dossier <cache>]` →
`data/raw/<département>/fiscalite.json`.

- Source : « Impôts locaux : fichier de recensement des éléments d'imposition à la
  fiscalité directe locale (REI) », DGFiP, millésime 2025, archive
  `REI-2025-fichier-notice-trace.zip` sur data.economie.gouv.fr (`REI_2025.csv`, 34 908
  lignes, 1 043 colonnes, une ligne par commune ; `TRACE_REI_2025.xlsx` décrit chaque
  colonne). Page : https://www.data.gouv.fr/datasets/impots-locaux-fichier-de-recensement-des-elements-dimposition-a-la-fiscalite-directe-locale-rei-4.
  Licence Ouverte 2.0.
- Colonnes lues (taxe foncière sur les propriétés bâties, TFB) : `E12` taux communal net
  (taux moyen appliqué pour une commune nouvelle en intégration fiscale progressive),
  `E22` syndicats, `E32` taux intercommunal net, `E52` et `E52A` taxes spéciales
  d'équipement, `E52gGEMAPI` GEMAPI, `E52TASA` TASA (Île-de-France) ; `F22` TEOM en zone à
  taux plein ; `TXMAJOTHRS` majoration de taxe d'habitation sur les résidences secondaires.
- **Mesure classante** : taux global de TFB = somme des parts ci-dessus, en pourcentage de
  la valeur locative cadastrale, hors TEOM. C'est ce qu'un propriétaire paie, à valeur
  locative égale. Parts communale et intercommunale, TEOM et majoration THRS sont
  informatives. Une TEOM absente ou nulle est « sans objet » (redevance ou budget
  général), jamais 0 %.
- Paris, Lyon et Marseille figurent au niveau commune. 34 744 communes sur 34 746 sont dans
  le REI 2025.
- Contrôle : Ambérieu-en-Bugey 37,61 % (commune 37,25 %, GEMAPI 0,22 %, TSE 0,141 %),
  TEOM 6,2 % ; Paris 21,21 %, majoration THRS 60 %.
