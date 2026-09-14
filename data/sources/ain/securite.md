# Sécurité — délinquance enregistrée pour 1 000 habitants

Clé technique : `securite`. Note rédigée le 2026-09-06. Méthodologie strictement identique à
celle documentée pour la Métropole de Lyon et l'Ille-et-Vilaine : même jeu de données SSMSI
(ressource nationale `44ef4323-1097-48d5-8719-3c544b55d294`, identique aux deux régions déjà
peuplées), seuls les codes commune interrogés changent.

## 1. Source

Bases statistiques communale, départementale et régionale de la délinquance enregistrée par la
police et la gendarmerie nationales, SSMSI (Ministère de l'Intérieur). Géographie communale au
1er janvier 2026, licence Ouverte 2.0.

## 2. Extraction

87 requêtes HTTP, une par commune, sur `tabular-api.data.gouv.fr` (`CODGEO_2026__exact=<code>`).
**Les 87 requêtes ont toutes renvoyé exactement 150 lignes** (15 indicateurs × 10 années
2016-2025), sans pagination et sans code renvoyant 0 ligne.

**Contrôle croisé de population** : la population de référence (`insee_pop`) retournée par le
SSMSI pour les 87 communes a été comparée à celle de `geo.api.gouv.fr` — **0 écart**.

## 3. Secret statistique

**603 cellules masquées sur 1 305** (87 communes × 15 indicateurs), soit **46,2 %** — un taux
comparable à celui observé pour l'Ille-et-Vilaine (46,8 %), cohérent avec la composition très
majoritairement rurale du département (hors Bourg-en-Bresse et quelques villes moyennes).

## 4. Limites à afficher à l'utilisateur

Identiques à celles documentées pour Lyon et l'Ille-et-Vilaine : faits enregistrés ≠
délinquance réelle, comptage au lieu de commission (sauf escroqueries), secret statistique si 5
faits ou moins sur 3 années consécutives (jamais estimé ni reconstitué), dénominateurs
hétérogènes (cambriolages pour 1 000 logements, le reste pour 1 000 habitants), unités de
compte hétérogènes, forte volatilité dans les petites communes rurales.
