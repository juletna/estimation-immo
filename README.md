# Estimer mon bien

[Ouvrir l'estimateur en ligne](https://juletna.github.io/estimation-immo/)

Estimateur indicatif de maisons et appartements (y compris les studios de moins de 20 m²) en France à partir des ventes DVF. La page cherche une adresse ou une référence cadastrale, sélectionne des ventes comparables à proximité et affiche leur prix de vente, une projection à la surface saisie et un score de pertinence.

Le site statique se trouve dans [`dist/`](dist/). Il utilise en direct les API publiques DVF, de géocodage et du cadastre : une connexion Internet est nécessaire, même en local. L'état du bien, les travaux, la piscine et le DPE ne sont pas valorisés automatiquement. Le résultat ne constitue pas une expertise immobilière.

## Utilisation

Ouvrir le site GitHub Pages ou lancer `Ouvrir l’estimateur.command` sur macOS pour servir la page localement. Après une estimation, le bouton « Imprimer / enregistrer en PDF » permet d'exporter le résultat.

Chaque modification poussée sur la branche `main` publie le contenu de `dist/` avec GitHub Actions.

## Garages et parkings

Le mode « Garage / parking » utilise la catégorie DVF « Dépendance », qui inclut aussi les caves : le type exact ne peut pas être confirmé. Il affiche la médiane des prix totaux observés, sans surface requise ni projection au m². Ce repère n’est pas une estimation spécifique d’un garage.

Par prudence, seules les mutations comportant une seule ligne distincte de dépendance et un seul lot déclaré dans les données reçues sont retenues. Les ventes mixtes, les lots multiples et les lots manquants sont exclus. Les doublons exacts entre réponses sont dédupliqués. Une transaction peut néanmoins inclure un bien situé hors des secteurs consultés.

Le classement utilise la distance (70 points, décroissance jusqu’à 5 km) et la date (30 points, décroissance jusqu’à 5 ans), sans pondérer la médiane. La recherche s’élargit jusqu’à 10 km dans les secteurs consultés de la commune si nécessaire.

## Dossier d’estimation (maisons et appartements)

- **Décrire mon bien** : configuration, nombre de logements/pièces, état, DPE, stationnement, surfaces annexes, espaces communs, atouts, points à examiner et photo facultative. Ces informations sont déclaratives et ne modifient pas le calcul DVF.
- **Carte interactive** : toutes les ventes de la sélection initiale sont numérotées. Un repère ouvre sa vente ; le nom d’une vente recentre la carte. Le fond OpenStreetMap nécessite Internet et reçoit la zone affichée.
- **Exclusions motivées** : chaque vente peut être exclue puis réintégrée. Médiane, quartiles, graphique et effectif sont recalculés sans élargir automatiquement la recherche. Le repère initial et les motifs restent visibles. Sans vente retenue, aucun prix estimé n’est affiché.
- **Prix envisagé** : saisie ou curseur, positionnement par rapport aux prix au m² des ventes retenues, graphique prix total/surface et net vendeur après honoraires saisis (0 % par défaut). Cette simulation ne change pas le repère DVF et ne prédit pas le délai de vente.
- **PDF** : quatre sections imprimables (synthèse, fiche descriptive, carte et comparables, méthode). Six ventes retenues sont détaillées ; le calcul repose sur toute la sélection. Des textes ou listes d’exclusions longs peuvent ajouter des pages. Utiliser le bouton d’impression pour préparer le fond de carte avant l’export.

Aucune fiche ni photo n’est enregistrée sur un serveur ou dans le stockage du navigateur. Elles restent en mémoire jusqu’au rechargement ou à « Nouvelle estimation ». Les photos JPG/PNG/WebP de moins de 5 Mo sont redimensionnées localement. Exporter le PDF pour conserver le dossier. La photo et les caractéristiques saisies ne sont pas transmises aux API.

La carte utilise Leaflet 1.9.4, distribué localement dans `dist/vendor/leaflet/` avec sa licence BSD-2-Clause, et les tuiles standard OpenStreetMap avec attribution. Les autres fonctionnalités restent accessibles si le fond de carte est indisponible.

## Vérification

Tests de calcul et de sélection : `node --test tests/*.test.cjs`.

Parcours navigateur reproductible (Playwright requis) : démarrer `python3 -m http.server 8765 --directory dist`, puis `node tests/browser.cjs`. Les API de recherche sont simulées pour vérifier le recalcul, les exclusions, le PDF, la photo, le mobile et le mode garage ; les tuiles cartographiques restent en ligne. `BASE_URL` permet de changer l’URL et `CHROME_PATH` de choisir un exécutable Chrome. Les captures et le PDF de contrôle sont écrits dans un dossier temporaire indiqué en sortie.
