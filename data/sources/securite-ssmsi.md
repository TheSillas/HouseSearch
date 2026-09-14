# Sécurité — délinquance enregistrée (SSMSI), base communale nationale

Import : `node scripts/importer-securite.mjs [--dossier <cache>]` →
`data/raw/<département>/securite.json` et `securite-historique.json` pour toutes les communes.

- Source : « Bases statistiques communale, départementale et régionale de la délinquance
  enregistrée par la police et la gendarmerie nationales », SSMSI (ministère de
  l'Intérieur), data.gouv.fr — ressource communale `44ef4323-1097-48d5-8719-3c544b55d294`
  (csv.gz, ~40 Mo, `donnee-data.gouv-2025-geographie2026-produit-le2026-06-25`).
  Licence Ouverte 2.0. Millésime 2025, géographie communale au 1er janvier 2026.
- Contenu : 15 indicateurs × 10 années (2016-2025) pour 34 920 communes. Colonnes :
  CODGEO_2026, annee, indicateur, unite_de_compte, nombre, taux_pour_mille, est_diffuse,
  insee_pop, insee_pop_millesime, insee_log, insee_log_millesime, compléments.
- **Secret statistique** : `est_diffuse = ndiff` (5 faits ou moins sur 3 années
  consécutives) → nombre et taux laissés `null`, jamais estimés ni reconstitués. Les
  compléments d'information (moyennes départementales) ne sont pas utilisés.
- Champs écrits : `taux<Indicateur>` et `nb<Indicateur>` pour 2025, dénominateurs INSEE
  (population millésime 2023, logements 2022), `nbIndicateursDiffuses`,
  `nbIndicateursSecretStatistique`, total des violences physiques quand les deux
  composantes sont diffusées. Historique : taux 2016-2025 des quatre indicateurs
  classants (violences hors cadre familial, vols sans violence, cambriolages,
  destructions et dégradations), années sous secret omises.
- Contrôle : mêmes valeurs que l'extraction commune par commune des premières régions
  (Ambérieu-en-Bugey : 63 violences hors cadre familial, 3,95 ‰ en 2025).
- Limites, dites sur la fiche : faits enregistrés ≠ délinquance réelle ; comptage au lieu
  de commission ; dénominateurs et unités de compte hétérogènes ; dans les petites
  communes, la plupart des indicateurs sont sous secret et le taux pour mille est volatil.
