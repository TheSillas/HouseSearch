# Décisions prises pour le MVP

Les trois points laissés ouverts par le brief, et ce qui a été tranché.

## 1. Zone géographique du test

**Retenu : Métropole de Lyon (30 communes) + Genas et Brignais, hors métropole. 32 communes au total.**

Pourquoi cette zone :

- **Variance maximale sur les quatre critères.** L'écart de prix va du simple au triple
  entre Givors et Sainte-Foy-lès-Lyon ; la réussite au brevet couvre une amplitude de
  plus de vingt points ; le trajet vers le centre va de 12 à plus de 50 minutes. Un jeu
  de test resserré n'aurait pas permis de voir le classement bouger.
- **Un centre unique et incontesté.** Le critère « temps de trajet vers la grande ville
  la plus proche » a une réponse évidente ici : Lyon Part-Dieu. Dans une zone
  polycentrique, ce critère aurait demandé un arbitrage discutable par commune.
- **Couverture complète par les producteurs.** Les 32 communes sont présentes dans DVF,
  dans la base communale du SSMSI, dans la BPE, dans les fichiers électoraux et dans le
  GTFS du réseau TCL. Aucun trou de couverture n'est dû au découpage.
- **Deux communes hors métropole volontairement incluses** (Genas, Brignais) pour
  vérifier que rien dans la chaîne ne suppose l'appartenance à la Métropole.

Deux particularités du périmètre ont demandé un traitement explicite :

- **Lyon** est une commune unique (code INSEE 69123) mais ses neuf arrondissements
  portent leurs propres codes dans plusieurs jeux de données. Les chiffres affichés
  portent sur la commune entière ; c'est signalé sur sa fiche.
- **Oullins-Pierre-Bénite** est une commune nouvelle née le 1ᵉʳ janvier 2024. Les
  données antérieures existent sous les deux anciens codes (69149 et 69152) et ont été
  agrégées. C'est signalé sur sa fiche et dans les limites du critère concerné.

## 2. Source des données de transport

C'était le point non confirmé du brief. **Retenu : composition de quatre jeux officiels,
avec calcul d'itinéraire réel.**

| Besoin | Source | Ce qu'elle donne |
|---|---|---|
| Lignes desservant la commune | Arrêts et lignes TCL, `data.grandlyon.com` (WFS) + GTFS TCL de SYTRAL Mobilités | Jointure spatiale arrêt × contour communal, lignes dédoublonnées |
| Temps de trajet vers Lyon Part-Dieu | GTFS TCL, calcul d'itinéraire RAPTOR multicritère sur horaires théoriques | Médiane de 19 départs entre 7 h 30 et 9 h 00, un mardi de période scolaire |
| Desserte ferroviaire | GTFS national SNCF + Gares de voyageurs | Gares implantées dans la commune et lignes qui les desservent, courses actives au jour de référence |
| Rattachement des arrêts | `geo.api.gouv.fr` (contours ADMIN EXPRESS de l'IGN) | Contour communal et coordonnées de mairie |

**Pourquoi pas Navitia :** le palier gratuit impose des quotas incompatibles avec un
recalcul complet du jeu de données, et l'itinéraire calculé directement depuis le GTFS
est reproductible à l'identique — ce qui compte pour un chiffre que l'on affiche avec sa
méthode.

### Ce qu'on appelle « une ligne »

La règle a demandé un arbitrage, parce que compter les seules lignes du réseau urbain
sous-estimait lourdement les communes périphériques — d'un facteur quatre à Brignais.
Elle est donc formulée de façon vérifiable :

> Est comptée toute ligne typée `REG` au référentiel SYTRAL, **plus** toute ligne sans
> type ayant des courses réelles dans le GTFS de la semaine de référence.

Ce second membre fait entrer les lignes interurbaines Cars du Rhône et Libellule, qui
desservent réellement les habitants des communes périphériques, et écarte de lui-même
les codes sans type et sans course. Sont exclues par type : les lignes scolaires
(comptées à part), le transport à la demande, les lignes événementielles et Rhônexpress.

### Choix de l'itinéraire affiché

À heure d'arrivée égale, plusieurs chemins existent. Le calculateur retient celui qui
compte **le moins de correspondances**, puis le moins de marche. Sans cette règle,
l'itinéraire affiché était un simple bris d'égalité arbitraire : Rillieux-la-Pape
annonçait « C2 > C5 > C2 > B » et trois correspondances là où « C2 > B » arrive à la même
heure avec une seule.

**Limites assumées, affichées sur chaque fiche :** le trajet part de la *mairie*, pas du
domicile, et repose sur des horaires *théoriques*. Il ne dit rien des perturbations ni
des écarts entre quartiers d'une même commune.

### Mise à jour — abandon du temps de trajet comme mesure classante

Après coup, deux défauts ont fait revenir sur ce choix : le libellé court affiché dans
le classement et dans les filtres nommait une gare précise (« Vers Part-Dieu »), ce qui
ne généralise pas à une future couverture nationale, chaque région ayant son propre pôle
de référence ; et même généralisé en « vers le centre », le libellé restait ambigu sans
dire par quel mode ni vers quel centre.

**Retenu : remplacer la mesure classante du critère Transports par la distance à vol
d'oiseau entre la mairie et la gare de voyageurs la plus proche** (gare SNCF), quelle
que soit sa commune. Une commune avec une gare sur son propre territoire obtient
mécaniquement une distance faible ; une commune sans gare obtient la distance jusqu'à la
plus proche, où qu'elle soit — la donnée dit d'elle-même « gare dans la commune » ou
« gare la plus proche, ailleurs », sans indicateur booléen séparé à maintenir.

Source : même CSV « Gares de voyageurs du réseau ferré national » (SNCF, ODbL) déjà
utilisé pour dénombrer les gares de chaque commune, et mêmes coordonnées de mairie
(`geo.api.gouv.fr`, champ `mairie`) que celles qui servent au calcul de
`distance_mairie_arret_m` — cohérence entre les deux mesures.

Le calcul d'itinéraire RAPTOR décrit ci-dessus reste dans `data/raw/transports.json` et
dans son historique de vérification : ce travail n'est pas perdu, il n'alimente
simplement plus le classement ni la fiche affichée.

## 3. Fréquence de mise à jour

**Retenu : régénération trimestrielle du jeu de données**, par `npm run donnees` après
rafraîchissement de `data/raw/`.

Le trimestre est le plus petit pas qui capte chaque livraison sans travail inutile :

| Critère | Producteur | Rythme réel de publication |
|---|---|---|
| Prix immobilier | DGFiP / Etalab (DVF) | semestriel, avril et octobre |
| Sécurité | SSMSI | annuel, milieu d'année |
| Écoles — équipements | INSEE (BPE) | annuel |
| Écoles — résultats | DEPP (IVAC, IVAL) | annuel, après la session de juin |
| Transports | SYTRAL, SNCF (GTFS) | continu, flux vivants |
| Élections | Ministère de l'Intérieur | événementiel |

Deux réserves qui échappent au calendrier :

- **Les transports sont des flux vivants.** Un changement de desserte est publié en
  continu ; c'est le critère qui se périme le plus vite entre deux régénérations.
- **Les élections sont événementielles.** Un scrutin, une municipale partielle ou un
  changement de maire justifient une régénération hors calendrier. Les résultats sont
  par ailleurs publiés sous réserve des recours devant le tribunal administratif.

Chaque valeur affichée porte son millésime : un jeu partiellement vieilli reste lisible,
puisque le lecteur voit de quelle année vient chaque chiffre.

## Décisions de méthode prises en cours de route

Ces points n'étaient pas dans le brief mais ont demandé un arbitrage.

- **Aucun indicateur de sécurité agrégé.** Le SSMSI publie quinze indicateurs aux unités
  de compte différentes (victime, infraction, véhicule, mis en cause) et aux
  dénominateurs différents (habitants, logements). Les additionner n'a pas de sens. Le
  classement porte donc sur quatre indicateurs publiés tels quels, dont on moyenne les
  *positions*, jamais les valeurs.
- **Les violences intrafamiliales sont affichées mais ne classent pas.** Un taux élevé
  peut refléter un meilleur accompagnement des victimes et une plus forte propension à
  porter plainte, pas une commune plus dangereuse.
- **L'évolution des prix n'est pas comparée.** Une hausse arrange le vendeur et dessert
  l'acheteur : la mesure est affichée en clair, sans barre de position ni rang.
- **Les écoles sont classées à la densité, pas au nombre brut**, sans quoi Lyon
  arriverait mécaniquement en tête sur sa seule taille.
- **Aucune couleur politique dans l'interface.** Les barres de résultats sont d'un gris
  neutre, les nuances sont affichées avec leur code et leur libellé officiels, tels que
  publiés par le ministère de l'Intérieur.

## 4. Extension à la France entière — architecture, phase 1

Trois décisions prises avant de lancer la moindre extraction nationale.

### Périmètre retenu : communes de 2 000 habitants et plus

*Remplacé en septembre 2026 par l'exhaustivité, voir le chapitre 5.*

Pas les ~34 945 communes françaises dans leur totalité : en dessous de ce seuil, les
données se creusent au point de ne plus dire grand-chose (SSMSI masque une grande partie
des petites communes par secret statistique, DVF n'a souvent aucune vente sur cinq ans,
la commune n'a parfois ni école ni gare). Le seuil de 2 000 habitants couvre la quasi-
totalité de la population urbaine et périurbaine avec des données qui restent
exploitables, pour environ 5 000 à 6 000 communes.

### Le moteur de classement devient O(n log n), pas O(n²)

`construireReferentiel` comparait auparavant chaque commune à toutes les autres, une par
une, pour chaque mesure : négligeable à 32 communes (1 024 comparaisons), intenable à
l'échelle visée (des centaines de millions d'opérations par mesure, plusieurs milliards
pour la France entière). La position d'une commune ne dépend que de son rang dans la
mesure triée : un tri une fois par mesure, puis une recherche dichotomique par commune,
donne exactement le même résultat — même `Position`, mêmes `devancees`/`exAequo`/
`fraction` — sans jamais comparer les communes deux à deux. Un test dédié
(`scoring.test.ts`, « passage à l'échelle nationale ») fabrique un jeu de 6 000 communes
et vérifie que le calcul reste sous la seconde ; il sert de garde-fou contre une
régression future vers l'ancien algorithme.

Le moteur transcrit de la version publiée autonome (`scripts/artefact/moteur.mjs`) porte
le même algorithme, vérifié identique par `src/lib/artefact.test.ts`.

### Le jeu de données se scinde par région

`src/data/communes.json` (un seul fichier, toutes les communes) devient
`src/data/regions/<slug>.json`, un fichier par région, chargés via le registre
`src/lib/regions.ts`. Une seule région est peuplée aujourd'hui (`metropole-lyon`) ;
ajouter la suivante se fera par un import de plus dans ce registre, sans toucher au
reste de l'application.

**Ce qui n'est délibérément pas fait à cette étape**, pour rester dans le périmètre
demandé (l'architecture, validée sur les données actuelles — pas encore l'extraction
nationale ni l'interface de navigation par région) :

- `data/raw/` n'est pas encore scindé par région ; `build-dataset.mjs` a son slug de
  région en dur (`REGION_SLUG`). Peupler une deuxième région demandera de paramétrer
  ces deux points.
- Aucun sélecteur de région n'existe dans l'interface : avec une seule région peuplée,
  il n'y a rien à choisir.
- Le calcul de position reste effectué au chargement de la page (client), pas
  précalculé à la génération du jeu de données. Le test de passage à l'échelle montre
  que O(n log n) suffit largement pour 6 000 communes (quelques dizaines de
  millisecondes) ; si une échelle plus grande ou un poste client plus modeste
  l'exigeaient un jour, précalculer les positions au moment de `build-dataset.mjs`
  serait l'étape suivante.

### Abandon de « nombre de lignes de transport en commun »

Cette mesure venait du référentiel SYTRAL, propre à la Métropole de Lyon. Il n'existe
pas de source équivalente et unifiée à l'échelle nationale : chaque agglomération
française a sa propre autorité de transport et son propre flux GTFS sur
transport.data.gouv.fr, sans fichier unique qui les agrège. Plutôt qu'une mesure
présente dans certaines communes et absente ailleurs — la même incohérence qui a motivé
l'abandon du temps de trajet vers Lyon Part-Dieu —, le critère Transports ne classe
désormais que sur la distance à la gare la plus proche (source SNCF, nationale).

Les mesures « Points d'arrêt », « Gares de voyageurs » et « Lignes scolaires » restent
affichées pour la Métropole de Lyon (à titre informatif, non classantes) mais partagent
la même limite SYTRAL — sauf « Gares de voyageurs », déjà nationale. Elles devront être
retirées ou retravaillées région par région à mesure que d'autres territoires seront
peuplés.

## 5. Passage à l'exhaustivité — septembre 2026

Ce chapitre remplace le périmètre et l'architecture de données du chapitre 4, qui
restent ici comme trace du raisonnement.

### Périmètre : toutes les communes de France métropolitaine

L'utilisateur a tranché pour l'exhaustivité, fiches presque vides comprises : 34 746
communes (`importer-referentiel.mjs`, geo.api.gouv.fr, sans seuil de population). Le
seuil de 2 000 habitants n'était dit nulle part dans l'interface ; l'exhaustivité est
plus honnête qu'un périmètre tronqué en silence.

### Couverture : classée seulement si renseignée sur les critères activés

Le classement retirait déjà un critère absent du calcul. À l'échelle nationale, un
village classé sur quatre critères aurait devancé une ville complète sur six sans que rien
ne le dise. Règle retenue (`src/lib/couverture.ts`) : tout critère dont le curseur est
au-dessus de zéro doit être renseigné, avec une tolérance de critères manquants réglable
(0 par défaut, paramètre d'URL `c`). Les communes écartées restent sur la carte, grisées,
et consultables. Un curseur à zéro ne demande rien.

### Format des données : compact par département, noyau national, aperçu serveur

Le jeu complet (~260 Mo) n'est plus importé dans le bundle. `build-dataset.mjs` écrit un
format compact v2 par département (`data/dist/<slug>.json`, métadonnées de mesure et
textes de critère écrits une fois, valeurs par commune), dilaté à la demande par
`src/lib/jeu-compact.ts`. `build-noyau.mjs` en tire un noyau national en colonnes
(`data/dist/noyau.json`, ~5 Mo, mesures du classement seulement) et sa version
pré-compressée servie sous `/donnees/noyau/<empreinte>` en cache immuable. La page
d'accueil embarque un aperçu (`src/lib/apercu.ts`) — le classement demandé par l'URL,
calculé côté serveur avec les mêmes fonctions que le navigateur — puis le noyau arrive à
côté et prend le relais sans rien changer à l'écran. Résultat mesuré en production :
page d'accueil 38 Ko en 50 ms au lieu de 5,4 Mo en 3 s.

### Carte : recoloration par diff de propriétés dans le worker

Colorer 34 746 points par `setFeatureState` réévaluait la peinture de toutes les tuiles
sur le fil principal, une seconde par tick de curseur. Score et exclusion sont désormais
des propriétés des points, mises à jour par `updateData` (diff, worker MapLibre), score
arrondi au centième pour n'envoyer que les communes dont la teinte change. Tick : 25 à
250 ms.

### Toutes les sources importées nationalement, par scripts rejouables

Les extractions région par région des débuts sont remplacées par neuf importateurs
(`scripts/importer-*.mjs`), chacun vérifié contre l'extraction précédente sur l'Ain :
recensement 2022 et Filosofi 2023 (dispositif Filosofi 2, publié le 6 août 2026 ; le
millésime 2021 utilisé d'abord donnait Biarritz à 25 640 € au lieu de 29 210 €), APL
2024 et BPE 2025 (toutes les spécialités médicales et professions de santé, affichées en
répartition structurée — voir `Mesure.repartition`), gares SNCF, Carte des loyers, SSMSI
(fichier communal national, mêmes valeurs), DVF (fichiers départementaux 2021-2025,
méthode retrouvée à une vente près ; arrondissements de Paris, Lyon et Marseille
rattachés à la commune ; Alsace-Moselle hors DVF avec statut « indisponible »), DEPP
(IVAC collèges et IVAL lycées `gt_v2`/`pro_v2`, session 2025), élections (municipales
2026, européennes 2024, présidentielle 2022 avec addition des communes fusionnées
depuis, maires du RNE).

### Vérification à l'échelle

`npm run verifier` accepte l'URL de base en argument (`node scripts/verifier.mjs
http://localhost:3112`) et attend le montage de la carte avant de toucher aux curseurs,
sinon il signalait un faux écart d'hydratation en dev. Les tests de parité
(`noyau.test.ts`, `apercu.test.ts`, `artefact.test.ts`) parcourent les 34 746 communes et
ont des délais de plusieurs minutes.

## 6. Trois ajouts de valeur — septembre 2026

Retenus parmi une dizaine de pistes, pour ce qu'ils changent à une décision réelle.

### Commerces & services : la gamme de proximité de l'INSEE plutôt qu'un score

La BPE dénombre 223 types d'équipements par commune. Compter les équipements favorise les
grandes villes ; en faire un score est interdit ici. La lecture officielle de l'INSEE
convient : une commune est « pôle de proximité » quand elle possède au moins la moitié des
26 types de la gamme de proximité (boulangerie, école, médecin, pharmacie, poste, coiffeur,
restaurant, bibliothèque, terrain de sport…). La mesure classante est donc le nombre de ces
types présents, sur 26 ; les gammes intermédiaire et supérieure et le total sont
informatifs, avec la répartition détaillée. Aucune pondération, aucun panier maison.

### Fiscalité locale : le taux global de taxe foncière, pas une cotisation estimée

Le REI de la DGFiP donne chaque part du taux de TFB (communale, intercommunale, syndicats,
taxes spéciales, GEMAPI, TASA). Leur somme est ce qu'un propriétaire paie à valeur locative
égale ; c'est la mesure classante. On n'affiche pas de « taxe foncière moyenne » : elle
dépendrait de la valeur locative de chaque bien, que l'outil ne connaît pas. La TEOM et la
majoration sur les résidences secondaires sont données à part ; une TEOM absente est « sans
objet » (redevance ou budget général), jamais 0 %.

### Le repère personnel : un critère calculé, pas une donnée

« À moins de quarante minutes de mon travail » est la vraie question. Première marche
retenue : la distance à vol d'oiseau entre le centre de chaque commune et un repère choisi
(une commune, ou un clic sur la carte), qui devient un neuvième critère et un filtre de
rayon. Le calcul est local (haversine sur 34 746 communes, quelques millisecondes), donc le
principe de réactivité tient ; le repère voyage dans l'URL et le serveur applique le même
calcul pour l'aperçu, si bien qu'un lien partagé montre le bon classement au premier rendu.
Sans repère, le curseur est inerte et le dit. Un temps de trajet réel (route, train) est la
marche suivante : il exigerait un moteur d'itinéraire, appelé une seule fois au choix du
repère, jamais pendant un mouvement de curseur.

### Risques naturels : un fait administratif compté, pas un indice d'exposition

Géorisques publie beaucoup : aléas cartographiés, zonages, plans, arrêtés. En faire un
« indice de risque » serait une note, et mélangerait des choses qui ne s'additionnent pas.
La mesure classante retenue est la seule qui soit un décompte de faits publiés au Journal
officiel : le nombre de reconnaissances de l'état de catastrophe naturelle depuis 1982
(une par arrêté, par type de risque et par période), tel que Géorisques l'affiche sur la
fiche de chaque commune, avec la répartition par type et la plus récente. Zone de sismicité
(1 à 5), potentiel radon (1 à 3), plans de prévention approuvés et risques recensés dans le
dossier départemental sont montrés à côté, sans barre de position : ce sont des classements
réglementaires, pas des mesures locales. Les limites sont dites sous le chiffre : un arrêté
ne mesure ni les dégâts ni la part du territoire touchée, et la sécheresse (argiles) pèse
lourd depuis les années 2010. Le critère se place en dixième position pour que les liens
partagés à neuf valeurs restent valides.

### Comparaison côte à côte : un tableau, pas un duel

Comparer deux communes est le geste naturel après un classement. La tentation est d'en faire
un « match » avec un vainqueur ; ce serait une note déguisée. La page `/comparer` aligne donc
les mesures ligne à ligne, chiffre brut et unité pour chaque commune, et colore la valeur la
plus favorable de la ligne quand la mesure a un sens (un prix plus bas, un taux de réussite
plus haut ; les décomptes bruts d'établissements n'en ont pas et ne sont pas colorés). Sous
chaque chiffre, la même barre de position que sur la fiche, parmi les 34 746 communes, pas
seulement parmi celles comparées : la comparaison ne réécrit pas les positions. Deux à quatre
communes, désignées par leur slug dans l'adresse, pour que la comparaison se partage comme un
classement ; on y entre depuis une fiche (« Comparer avec… ») ou en ajoutant une commune sur la
page. Les sources de chaque critère sont rappelées sous le tableau.


### Climat : la station la plus proche, dite comme telle

Il n'existe pas de climat « par commune » : Météo-France observe dans des stations. Plutôt
qu'interpoler (une estimation, donc un chiffre inventé au sens de ce projet), chaque commune
reçoit les normales 1991-2020 calculées pour la station valide la plus proche, et chaque
mesure déclare sa maille : nom de la station, altitude, distance. Trois familles distinctes,
parce que les réseaux n'ont pas la même densité : l'insolation n'est mesurée que dans une
centaine de stations (distance médiane 30 km, portée 100 km), les précipitations dans plus de
trois mille (6 km), les températures dans près de dix-sept cents (8 km). Au-delà de la portée,
la grandeur reste absente. La seule mesure classante est la durée d'insolation : c'est la
grandeur que l'on cherche ou que l'on fuit sans ambiguïté. Pluie, température, jours chauds et
gelées sont donnés sans direction favorable — préférer la fraîcheur ou la pluie est un choix,
pas une erreur. Les normales sont recalculées depuis les fichiers mensuels publics (au moins
20 années sur 30 par mois de l'année) et vérifiées contre les valeurs que Météo-France publie
pour Biarritz.

### Onze critères, huit curseurs

Deux critères — fiscalité locale et risques naturels — ont quitté le panneau des priorités
après usage : ils encombraient plus qu'ils ne départageaient, et leurs plages de filtre
(« taxe foncière », « catastrophes naturelles ») n'étaient pas des questions qu'on se pose en
premier. Ils restent des données de la fiche et de la comparaison, complets et sourcés, mais
leur poids est forcé à zéro : un critère sans curseur ne doit jamais peser en secret, même
depuis un ancien lien. Le curseur Proximité et le choix du repère rejoignent les filtres
avancés, à côté de la plage « Distance au repère » qu'ils font apparaître : c'est un réglage de
plus, pas une priorité du quotidien. Les libellés des plages sont ceux qu'on cherche des yeux
(« Prix immobilier », « Écoles », « Médecins ») plutôt que la forme courte des colonnes du
classement, qui ne se comprend que par voisinage.

### Commerces & services : trois domaines, sans double compte

Le critère lisait toute la BPE à travers les gammes de l'INSEE (proximité, intermédiaire,
supérieure). Deux défauts à l'usage : les médecins, kinés, dentistes et écoles y
réapparaissaient alors que Santé et Écoles les comptent déjà — un même équipement pesait deux
fois et la fiche se répétait —, et les gammes ne disent rien à qui ne connaît pas l'INSEE. Le
critère se limite désormais aux commerces, aux services aux particuliers et au sport, loisirs
et culture ; la mesure classante reste la gamme de proximité de l'INSEE, restreinte à ces
domaines (19 types), et les listes se présentent par nature d'équipement. Enseignement, santé
et transports restent lus dans leurs propres critères.

### À l'ouverture, aucune priorité n'est réglée

Les curseurs démarraient à « Important » : la page classait d'emblée sur huit critères que
l'utilisateur n'avait pas choisis, et écartait du classement les 10 000 communes sans donnée sur
l'un d'eux, avant même qu'il ait touché à quoi que ce soit. Tous les poids partent désormais de
zéro : la carte est neutre, les 34 746 communes sont « comparées » par ordre alphabétique, et
c'est en montant un curseur que l'on dit ce qui compte. Le premier geste est un choix, pas une
correction. Les filtres avancés, eux, ont toujours été inactifs par défaut — la section repliée
ne cache rien qui agisse : plages aux bornes du jeu, aucun département, aucune tolérance à
régler tant qu'aucun critère n'est actif.

### Ma sélection : étoiler d'abord, comparer ensuite

La première comparaison obligeait à choisir une commune, puis une autre, et menait sur une page
d'où l'on ne pouvait plus chercher. Le geste devient une étoile, disponible partout où une
commune apparaît (ligne du classement, fiche, volet), qui l'ajoute à « Ma sélection ». Le
bandeau de sélection reste collé au bas du panneau pendant qu'on règle, filtre et explore. Une
seule liste, deux états : une commune gardée peut être ou non « dans la comparaison » — un
favori qu'on veut retrouver sans forcément le comparer reste dans la liste, décoché. La page de
comparaison montre les cochées, six au plus. La liste vit dans le navigateur, comme des favoris ;
l'adresse de la comparaison, qui ne porte que les cochées, reste ce que l'on partage.

### La comparaison lit comme la fiche

Le premier tableau de comparaison alignait toutes les mesures d'un coup : soixante lignes, et
pour Commerces & services un nombre de types sans dire lesquels. Il reprend désormais la
grammaire de la fiche : une ligne synthétique par critère, avec le chiffre vedette de chaque
commune, qui se déplie sur toutes les mesures avec leurs précisions, leurs mailles et leurs
répartitions — quels commerces, quels spécialistes. Une section Vie politique s'ajoute, maire
et nuance de sa liste, liste ou candidat en tête à chaque scrutin, participation, tels que le
ministère les publie, sans couleur ni commentaire. Enfin, la mesure classante de Commerces &
services ne porte plus de répartition : chaque regroupement (électricien, boulangerie…) se lit
une seule fois, dans sa section de domaine.
