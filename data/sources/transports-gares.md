# Transports — gare de voyageurs la plus proche (SNCF, national)

Import : `node scripts/importer-gares.mjs [--dossier <cache>]` →
`data/raw/<département>/transports-gare-proche.json` pour toutes les communes.

- Source : « Gares de voyageurs » du réseau ferré national, SNCF Gares & Connexions via
  data.gouv.fr (ressource `cbacca02-6925-4a46-aab6-7194debbb9b7`, CSV `;`, colonnes
  Nom_Gare, Trigramme, Segment(s) DRG, Position géographique « lat, lon », Code commune,
  Code_UIC, Id_Gare). Licence ODbL. Flux vivant sans millésime annuel : la date de
  téléchargement fait foi (2 782 lignes, 2 773 gares avec coordonnées exploitables).
- Méthode : distance à vol d'oiseau (haversine, rayon 6 371 km) entre le centre de la
  commune (geo.api.gouv.fr) et chaque gare ; la plus proche est retenue, sans restriction
  au département. `dansLaCommune` compare le code commune de la gare à celui de la
  commune ; `communeGare` donne le nom de la commune d'implantation.
- Différence avec l'extraction précédente (5 302 communes) : le point de départ était la
  mairie ; il est désormais le centre de la commune, pour toutes les communes de la même
  façon. Les distances peuvent donc différer de quelques centaines de mètres.
- Limites, dites sur la fiche : distance géométrique, pas un temps de trajet ; le fichier
  ne renseigne pas la desserte, une halte à deux trains par jour compte comme une grande
  gare.
