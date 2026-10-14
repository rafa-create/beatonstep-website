# BeatOnStep — site officiel

**Site web : [beatonstep.app](https://beatonstep.app/)**

BeatOnStep accompagne la course et la marche en associant rythme des pas et musique. Ce dépôt public contient les pages et ressources du site officiel.

## Hébergement et mises à jour

Le site est hébergé et publié par **Cloudflare Workers** à partir du code versionné ici sur GitHub (branche `main`). GitHub sert à gérer les versions du site ; **GitHub Pages n'est plus utilisé** comme hébergement ou moyen de déploiement.

Pour consulter BeatOnStep, utiliser uniquement **[beatonstep.app](https://beatonstep.app/)**. L'ancienne adresse `github.io` n'est plus maintenue.

## Pages principales

- [Accueil](https://beatonstep.app/)
- [Garmin et Apple Watch](https://beatonstep.app/garmin.html)
- [Politique de confidentialité](https://beatonstep.app/privacy.html)
- [Crédits musicaux](https://beatonstep.app/music-credits.html)

## Contenu du dépôt

- `index.html`, `garmin.html`, `site.css`, `i18n.js` : pages et présentation.
- `assets/`, `badges/` : visuels et badges.
- `store/` : éléments de présentation des applications.
- `PRIVACY.fr.md`, `PRIVACY.en.md`, `MUSIC-CREDITS.fr.md`, `MUSIC-CREDITS.en.md` : textes publics.

Le fichier public `app-update.json` renseigne les versions de l'application disponibles sur les boutiques. Il est mis à jour lorsque ces versions sont effectivement publiées.

Pour la configuration du déploiement Cloudflare, consulter la [documentation technique](CLOUDFLARE.md).
