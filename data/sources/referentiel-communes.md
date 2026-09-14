# Référentiel des communes — toutes les communes de France métropolitaine

Import : `node scripts/importer-referentiel.mjs [--departement 01]` →
`data/raw/<département>/referentiel.json` (un dossier par département, 96 avec la Corse).

- Source : geo.api.gouv.fr (découpage administratif communal et populations légales
  de l'INSEE), endpoint `departements/<code>/communes` avec les champs nom, code,
  codesPostaux, population, centre, mairie, surface, epci, departement, region.
  Licence Ouverte 2.0.
- **Périmètre** : toutes les communes du département, sans seuil de population —
  34 746 communes au 8 septembre 2026. Le référentiel précédent ne retenait que les
  communes de 2 000 habitants et plus (5 302) ; l'interface le disait nulle part,
  c'est corrigé par le passage à l'exhaustivité.
- Population municipale : millésime 2023 (populations légales servies par l'API, vérifié
  sur Ambérieu-en-Bugey, 15 934 hab.). Coordonnées : centre de la commune. Surface
  convertie des hectares en km². Une commune sans population publiée serait écartée et
  signalée, jamais complétée — aucune ne l'a été.
- Homonymes (1 475 noms partagés entre départements) : le slug des deux communes est
  suffixé du code département (voir `scripts/build-noyau.mjs`).

## Conséquence sur les critères

Les critères importés nationalement couvrent toutes les communes : recensement
(démographie, emploi), Filosofi (revenus), APL et BPE (santé, écoles), gares, loyers,
délinquance SSMSI et prix DVF. Dans les petites communes, beaucoup de valeurs restent
absentes à la source (secret statistique SSMSI, aucune vente DVF) : elles s'affichent
comme telles. Les résultats aux examens (DEPP) et l'historique électoral sont eux aussi
importés nationalement : chaque commune a désormais les mêmes sources que les autres.
