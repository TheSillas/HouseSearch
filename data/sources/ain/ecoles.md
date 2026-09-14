# Écoles — note de source (Ain, 87 communes)

Clé technique : `ecoles`. Extraction : 2026-09-06. Reproduit à l'identique la méthode validée
pour la Métropole de Lyon et l'Ille-et-Vilaine : dénombrement lu dans le fichier de
dénombrement général de la BPE (`DS_BPE_CSV_FR`), résultats agrégés depuis l'annuaire de
l'éducation + IVAC (collèges) + IVAL GT/PRO (lycées).

## 1. Sources

- **Dénombrement** : INSEE BPE 2025, fichier `DS_BPE_2025_data.csv` (2 347 652 lignes), filtré à
  `GEO_OBJECT='COM'`, `BPE_MEASURE='FACILITIES'`, `TIME_PERIOD=2025`, `GEO` commençant par `01`,
  types d'équipement écoles/collèges/lycées — **477 lignes** retenues, couvrant les 87 communes
  cibles sans exception.
- **Annuaire de l'éducation** : `code_departement=001` (format à 3 chiffres, propre à ce jeu de
  données — distinct du format à 2 chiffres utilisé par IVAC/IVAL) — 663 lignes.
- **IVAC (collèges, session 2025)** et **IVAL GT/PRO (lycées, 2025)** : `code_departement=01`
  (2 chiffres) — 65 lignes IVAC en session 2025, 18 lignes IVAL GT et 15 lignes IVAL PRO en 2025.

## 2. Méthodologie (identique à Lyon et l'Ille-et-Vilaine)

Écoles = C107+C108+C109 (BPE), collèges = C201, lycées GT = C301+C304, lycées pro/agri. =
C302+C303+C305. DNB : moyenne pondérée par le nombre de candidats des collèges implantés sur la
commune (idem VA). Bac : moyenne pondérée par le nombre de présents des lycées GT+PRO implantés
sur la commune (idem VA), dédoublonnage par UAI pour les lycées polyvalents comptés une fois
côté GT et une fois côté PRO. Toute commune sans collège/lycée évalué reçoit `null`, jamais 0.

## 3. Couverture constatée

- **41/87** communes ont un indicateur DNB, **14/87** ont un indicateur bac — cohérent avec un
  département très majoritairement rural (peu de communes disposent d'un collège ou lycée
  propre).
- Aucune commune cible sans aucun établissement au sens BPE (dénombrement complet).

## 4. Limites à afficher à l'utilisateur

Identiques à Lyon et l'Ille-et-Vilaine : aucun taux de réussite communal officiel n'existe (les
valeurs sont une moyenne pondérée calculée par nos soins), le taux brut mesure surtout le milieu
social des familles (toujours afficher taux + VA ensemble), décalage temporel (dénombrement
janvier 2025, résultats session juin 2025), public et privé confondus, voie du bac mélangée
(GT/PRO, champ `voiesBacEvaluees`).
