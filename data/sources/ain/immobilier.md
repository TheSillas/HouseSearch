# Prix immobilier (clé : `immobilier`)

> Note de source vérifiée le **6 septembre 2026**. Toutes les URL listées ont été réellement
> interrogées (HTTP 200) pendant la rédaction de cette note. Méthodologie strictement
> identique à celle documentée pour la Métropole de Lyon et l'Ille-et-Vilaine, appliquée au
> département 01 (Ain) et à sa liste de 87 communes de 2 000 habitants et plus.

## 1. Source retenue

DVF géolocalisées (DGFiP / Etalab), fichiers départementaux du 01 :
`https://files.data.gouv.fr/geo-dvf/latest/csv/{2021..2025}/departements/01.csv.gz`.

| Millésime | Taille (octets, HTTP 200) |
|---|---|
| 2021 | 9 150 250 (décompressé) |
| 2022 | 8 738 393 |
| 2023 | 7 546 214 |
| 2024 | 6 705 647 |
| 2025 | 7 147 314 |

## 2. Méthodologie (identique à Lyon et l'Ille-et-Vilaine)

Dédoublonnage strict, `nature_mutation` ∈ {Vente, VEFA, Adjudication}, `code_type_local` ∈
{1 Maison, 2 Appartement, 4 Local industriel/commercial} pour le filtrage mono-bien, mono-bien
strict (un seul `id_mutation` retenu après filtrage), `prix_m2 = valeur_fonciere /
surface_reelle_bati`, exclusion des prix ≥ 100 000 €/m², médiane par commune et par type de
bien sur les 5 années cumulées.

**Raccordement des codes communes** : la colonne `ancien_code_commune` est vide sur
l'intégralité des lignes des 5 fichiers départementaux (vérifié programmatiquement) — aucune
mutation n'est restée sous un ancien code, y compris pour les 3 communes nouvelles du
périmètre (Valserhône 01033, Culoz-Béon 01138, Plateau d'Hauteville 01185). Aucun raccordement
manuel n'a donc été nécessaire.

## 3. Couverture constatée (87 communes)

- **85/87** communes ont une médiane appartement sur 5 ans ; **2 communes sans aucune vente
  d'appartement mono-bien retenue** (marché quasi exclusivement pavillonnaire).
- **87/87** communes ont une médiane maison sur 5 ans (marché présent partout).
- Évolution 1 an publiée (seuil 30 ventes/an dans les deux millésimes) : **18/87** en
  appartement, **25/87** en maison.

## 4. Limites à afficher à l'utilisateur

Identiques à celles documentées pour Lyon et l'Ille-et-Vilaine : prix d'acte notarié hors
frais, médiane sur 5 ans cumulés (pas le marché du jour), retard d'environ 8 mois, surface
réelle bâtie (pas Carrez), ventes en lot exclues, VEFA incluse, garde-fou aberrants minimal
(100 000 €/m²), petits volumes = chiffres fragiles pour les communes rurales du département.

## 5. Série 5 ans (clé `immobilier-historique`)

Calculée dans la même passe que la médiane cumulée (mêmes fonctions, mêmes données source) :
aucun écart d'arrondi possible entre les deux fichiers par construction.
