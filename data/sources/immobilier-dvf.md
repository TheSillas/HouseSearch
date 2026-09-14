# Immobilier — prix médian au m² (DVF géolocalisées, Etalab), toutes les communes

Import : `node scripts/importer-immobilier.mjs [--dossier <cache>] [--departement 01]` →
`data/raw/<département>/immobilier.json` et `immobilier-historique.json`.

- Source : « Demandes de valeurs foncières géolocalisées », DGFiP (données) / Etalab
  (géolocalisation, mise en forme). Fichiers départementaux
  `https://files.data.gouv.fr/geo-dvf/latest/csv/<année>/departements/<dép>.csv.gz`,
  millésimes 2021 à 2025 (mutations jusqu'au 31 décembre 2025). Licence Ouverte 2.0.
- **Méthode** (celle des premières extractions, retrouvée à une vente près sur les 87
  communes de l'Ain déjà extraites) :
  1. dédoublonnage strict des lignes identiques ;
  2. ventes seules : `Vente`, `Vente en l'état futur d'achèvement`, `Adjudication` ;
  3. locaux de type 1, 2 ou 4 (maison, appartement, local commercial) ; un même local
     apparaît sur plusieurs lignes quand la vente porte sur plusieurs parcelles ou lots,
     les locaux distincts se reconnaissent au couple (type, surface) ;
  4. mutations **mono-bien** uniquement : exactement un local distinct de ces types,
     retenu s'il est une maison ou un appartement ;
  5. prix au m² = valeur foncière / surface réelle bâtie ; exclusion des prix ≥ 100 000 €/m²
     et des surfaces ou valeurs nulles ;
  6. médiane (arrondie à l'euro) par commune et par type sur les cinq années cumulées,
     puis par année ; évolution 2024 → 2025 publiée seulement si chaque millésime compte
     au moins 30 ventes du type, sinon `echantillon_insuffisant`.
- Une commune sans vente retenue a une médiane absente (`null`), jamais estimée. Le
  nombre de ventes retenues est affiché avec la médiane : dans une petite commune, une
  médiane sur quelques ventes est volatile.
- Codes commune : ceux du fichier Etalab (`code_commune`, géographie courante) ; la
  colonne `ancien_code_commune` n'est pas exploitée. Paris, Lyon et Marseille sont codés à
  l'arrondissement (75101-75120, 69381-69389, 13201-13216) : leurs ventes sont rattachées à
  la commune (75056, 69123, 13055).
- **Alsace-Moselle (57, 67, 68) et Mayotte** : DVF ne publie rien (droit local, livre
  foncier). Les prix y sont `null` avec le statut `indisponible`, et la fiche le dit ; les
  loyers d'annonce (Carte des loyers) y restent la seule mesure classante du critère.
- Contrôle : Paris 10 237 €/m² en appartement sur 150 827 ventes retenues 2021-2025 ;
  Lyon 4 833 €/m².
