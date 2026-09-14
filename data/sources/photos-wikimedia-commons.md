# Photos des communes — Wikimedia Commons (via Wikidata)

Seule source consultée **au moment de l'usage** (et non figée à la compilation) :
les photos d'une commune sont chargées quand sa fiche s'ouvre depuis la carte,
jamais pendant qu'un curseur bouge. Elles illustrent, elles n'entrent dans
aucun calcul.

## Résolution de la commune

- **Wikidata**, API `action=query&list=search` avec `haswbstatement:P374=<code INSEE>` :
  la propriété **P374** (code commune INSEE) identifie l'entité sans ambiguïté,
  là où une recherche par nom confondrait les communes homonymes.
- Sur l'entité : **P18** (image principale) et **P373** (catégorie Commons).

## Fichiers

- **Wikimedia Commons**, API `action=query&generator=categorymembers` sur la
  catégorie P373, `prop=imageinfo` avec vignette (`iiurlwidth`), type MIME et
  métadonnées `Artist`, `LicenseShortName`, `LicenseUrl`, `ImageDescription`.
- Ne sont gardées que les images JPEG/PNG/WebP dont le nom n'évoque pas un
  symbole ou un document (blason, logo, carte, plan, drapeau, panneau, affiche…) :
  la fiche montre la commune, pas ses emblèmes. Dix photos au plus, l'image
  principale Wikidata en premier.

## Licences et crédit

Chaque photo est affichée avec l'**auteur**, la **licence** (lien vers son texte)
et le lien vers sa **page Commons**, tels que fournis par les métadonnées du
fichier. Les licences sont celles choisies par les contributeurs (Creative
Commons pour l'essentiel, parfois domaine public) ; le crédit est la condition
d'usage, il n'est jamais omis.

## Limites

- Couverture inégale : de nombreuses petites communes n'ont pas de photo — on
  affiche alors qu'aucune photo libre n'a été trouvée, jamais une image d'une
  autre commune ni une image d'illustration générique.
- Le filtrage par nom de fichier est heuristique : quelques symboles peuvent
  passer, quelques photos être écartées.
- Service tiers : indisponible, il est signalé comme tel, le reste de la fiche
  n'en dépend pas.
