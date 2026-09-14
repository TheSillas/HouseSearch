# Commerces & services — équipements et gammes de l'INSEE (BPE 2025)

Import : `node scripts/importer-equipements.mjs [--dossier <cache>]` →
`data/raw/<département>/equipements.json` (après `importer-insee.mjs`, qui télécharge la BPE).

- Source : Base permanente des équipements 2025, fichier de dénombrement général
  `DS_BPE_CSV_FR` (lignes `GEO_OBJECT = COM`, `BPE_MEASURE = FACILITIES`, 2025), tous les
  types d'équipements (223 dénombrés à la commune) ; composition des gammes 2025
  `BPE_gammes_equipements_2025.xlsx` (https://www.insee.fr/fr/statistiques/8217535).
  Licence Ouverte 2.0.
- **Gammes** : l'INSEE range 135 types en trois gammes selon leur fréquence d'implantation.
  Gamme de proximité (26 types ou regroupements) : boulangerie, supérette ou épicerie,
  école, médecin généraliste, pharmacie, infirmier, kinésithérapeute, coiffure, restaurant,
  poste (bureau, relais ou agence), bibliothèque, tennis, boulodrome, terrain de grands
  jeux, plateau ou gymnase, agence immobilière, institut de beauté, station de recharge,
  taxi, accueil de loisirs, artisans du bâtiment (maçon, plâtrier, menuisier, plombier,
  électricien), réparation automobile. Gamme intermédiaire : 48 ; gamme supérieure : 61.
- **Mesure classante** : nombre de types de la gamme de proximité présents dans la commune,
  sur 26 (un type ou regroupement compte s'il a au moins un équipement). C'est la lecture
  officielle de l'INSEE pour qualifier les pôles de services ; elle mesure la diversité de
  l'offre du quotidien, pas sa taille. Les gammes intermédiaire et supérieure et le total
  d'équipements sont informatifs, avec répartition détaillée.
- Limites, dites sur la fiche : comptage à la commune d'implantation ; un établissement
  vaut un, quelle que soit sa taille ; rien sur la qualité ni les horaires.
- Contrôle : Ambérieu-en-Bugey 26/26 (789 équipements, 144 types) ; L'Abergement-Clémenciat
  12/26.

## Révision du 10 septembre 2026 : trois domaines, sans double compte

Enseignement (domaine C), santé et action sociale (D) et transports (E) sont retirés du
critère : ils sont déjà comptés par Écoles, Santé et Transports, et les afficher ici
répétait les médecins, kinés, dentistes et écoles de ces sections. Le critère ne lit plus
que trois domaines de la BPE : commerces (B), services pour les particuliers (A), sports,
loisirs et culture (F).

- **Mesure classante** `quotidien-proximite` : types de la gamme de proximité de l'INSEE
  présents, restreinte à ces trois domaines — 19 types (les 26 moins école, médecin
  généraliste, kinésithérapeute, infirmier, pharmacie, accueil de loisirs sans hébergement,
  taxi). Biarritz : 19 sur 19.
- **Informatives**, par domaine et non plus par gamme (proximité / intermédiaire /
  supérieure, opaque pour un lecteur non averti) : `quotidien-commerces`,
  `quotidien-services`, `quotidien-loisirs`, chacune avec le nombre de types présents et la
  répartition par regroupement ; `quotidien-total` : équipements recensés dans ces trois
  domaines.
