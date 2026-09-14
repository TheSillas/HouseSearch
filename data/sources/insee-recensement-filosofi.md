# Démographie, emploi et revenus — INSEE (recensement 2022, Filosofi 2023)

Import : `node scripts/importer-insee.mjs [--dossier <cache>]` → `data/raw/<région>/population.json`
et `emploi.json`. Les fichiers nationaux sont téléchargés dans le dossier de cache
(`.cache-insee/` par défaut, ignoré par git) et lus en flux.

## Recensement de la population 2022 — bases communales

- **Évolution et structure de la population** :
  https://www.insee.fr/fr/statistiques/8581696 — `base-cc-evol-struct-pop-2022_csv.zip`
  (313 variables ; on lit `P22_POP`, `P16_POP`, `P11_POP` et les sept tranches
  d'âge `P22_POP0014` … `P22_POP90P`). Millésimes 2011 et 2016 exprimés dans la
  géographie 2025, donc comparables à 2022.
- **Emploi – population active** :
  https://www.insee.fr/fr/statistiques/8581444 — `base-cc-emploi-pop-active-2022_csv.zip`
  (`P22_POP1564`, `P22_ACT1564`, `P22_ACTOCC1564`, `P22_CHOM1564`, `P22_RETR1564`,
  `P22_ETUD1564`, `P22_EMPLT`).
- Producteur : INSEE. Licence Ouverte / Etalab 2.0. Exploitation principale, publiée en 2025.

**Taux calculés** (uniquement quand les deux termes sont publiés) :
chômage des 15-64 ans = `P22_CHOM1564 / P22_ACT1564` ; activité = `P22_ACT1564 / P22_POP1564`.
C'est le chômage **au sens du recensement** (déclaratif) : il n'est pas comparable au
chômage BIT ni aux inscrits à France Travail — la fiche le dit.

## Filosofi 2023 — revenus, pauvreté, niveau de vie (dispositif Filosofi 2)

- https://www.insee.fr/fr/statistiques/8984752?sommaire=8984758 —
  `FILOSOFI_CC_csv.zip` (`DS_FILOSOFI_CC_2023_data.csv`, format long : une mesure
  par ligne, `GEO_OBJECT = COM`). Publié le 6 août 2026 (rediffusion des taux de
  pauvreté après correction d'une erreur technique).
- Mesures lues : `MED_SL` (niveau de vie médian, €/an par unité de consommation),
  `PR_MD60` (taux de pauvreté au seuil de 60 %, une décimale). Le rapport
  interdécile `IR_D9_D1_SL` est lu mais vide pour toutes les communes du millésime
  2023 (diffusé seulement aux mailles supérieures) : la mesure a été retirée de la
  fiche. Le nombre de ménages fiscaux (`NUM_HH`) n'est plus publié.
- **Absences** : `CONF_STATUS = C` → secret statistique ; `OBS_STATUS = O` → valeur
  manquante (sous le seuil de diffusion). Dans les deux cas la valeur reste absente,
  jamais remplacée. Le taux de pauvreté n'est diffusé que pour ~5 200 communes.
- **Comparabilité** : Filosofi 2 est un nouveau dispositif ; l'INSEE prévient que
  ses indicateurs ne sont pas comparables aux millésimes 2012-2021 (le millésime
  2022 n'a jamais été produit). Aucune évolution n'est donc calculée.
- Contrôle : Biarritz (64122) = 29 210 €/an et 14,3 % de pauvreté, conformes au
  dossier complet INSEE de la commune.

## Usage dans l'application

- `population.json` → portrait démographique de la fiche (contexte, **hors classement**).
- `emploi.json` → critère **Emploi & revenus** : classent le taux de chômage, le
  niveau de vie médian et le taux de pauvreté ; le taux d'activité et le nombre
  d'emplois sont informatifs (aucun sens « bon » univoque).
