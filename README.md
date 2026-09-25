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
