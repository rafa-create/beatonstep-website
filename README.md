# BeatOnStep — site officiel

**Site web : [beatonstep.app](https://beatonstep.app/)**

BeatOnStep accompagne la marche et la course en associant musique et rythme des pas. Ce dépôt public rassemble les pages et ressources du site officiel.

## Publication du site

Le code source est versionné sur **GitHub** (`main`). **Cloudflare Workers** construit et déploie automatiquement le site après chaque mise à jour de cette branche.

GitHub Pages n'est pas utilisé pour la production. Les publications de l'application mobile suivent un processus distinct.

Les modalités de déploiement et de vérification sont décrites dans [CLOUDFLARE.md](CLOUDFLARE.md).

Les cartes de défis sportifs sont attribuées après une course, sans publication manuelle de défi. Leur registre public repose sur Cloudflare Workers et D1 ; une analyse télémétrique éventuelle est distincte de l'attribution. Voir [les principes des cartes sportives](docs/SPORT-CARDS-ARCHITECTURE.md).

## Pages principales

- [Accueil](https://beatonstep.app/)
- [Garmin et Apple Watch](https://beatonstep.app/garmin.html)
- [Politique de confidentialité](https://beatonstep.app/privacy.html)
- [Crédits musicaux](https://beatonstep.app/music-credits.html)

## Contenu du dépôt

- `index.html`, `garmin.html`, `site.css`, `i18n.js` : pages et interface.
- `assets/`, `badges/`, `store/` : éléments visuels et supports de présentation.
- `PRIVACY.fr.md`, `PRIVACY.en.md`, `MUSIC-CREDITS.fr.md`, `MUSIC-CREDITS.en.md` : informations publiques.

Le fichier `app-update.json` indique les versions mobiles disponibles sur les boutiques officielles. Il est actualisé après leur publication effective.
