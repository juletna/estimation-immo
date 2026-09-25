# Estimer ma maison

[Ouvrir l'estimateur en ligne](https://juletna.github.io/estimation-immo/)

Estimateur indicatif de maisons en France à partir des ventes DVF. La page cherche une adresse ou une référence cadastrale, sélectionne des ventes comparables à proximité et affiche leur prix de vente, une projection à la surface saisie et un score de pertinence.

Le site statique se trouve dans [`dist/`](dist/). Il utilise en direct les API publiques DVF, de géocodage et du cadastre : une connexion Internet est nécessaire, même en local. L'état du bien, les travaux, la piscine et le DPE ne sont pas valorisés automatiquement. Le résultat ne constitue pas une expertise immobilière.

## Utilisation

Ouvrir le site GitHub Pages ou lancer `Ouvrir l’estimateur.command` sur macOS pour servir la page localement. Après une estimation, le bouton « Imprimer / enregistrer en PDF » permet d'exporter le résultat.

Chaque modification poussée sur la branche `main` publie le contenu de `dist/` avec GitHub Actions.
