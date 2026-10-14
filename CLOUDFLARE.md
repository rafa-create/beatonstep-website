# Déploiement du site BeatOnStep

Le site officiel **[beatonstep.app](https://beatonstep.app/)** est hébergé par **Cloudflare Workers**. Le dépôt GitHub public [beatonstep-website](https://github.com/rafa-create/beatonstep-website) contient son code source.

## Publication en production

1. Une modification est enregistrée sur la branche `main` de GitHub.
2. L'intégration Git de **Cloudflare Workers Builds** construit le site (`npm run build`) et publie le Worker et ses ressources statiques (`npx wrangler deploy`).
3. La livraison est contrôlée dans Cloudflare, puis vérifiée sur `https://beatonstep.app/`.

**GitHub fournit le code source, pas l'hébergement de production.** GitHub Pages, utilisé auparavant, n'est plus un canal de déploiement du site. Ses anciennes exécutions peuvent rester visibles dans l'historique GitHub Actions.

## Vérifications après publication

- Confirmer le succès du déploiement dans le tableau de bord Cloudflare du Worker `beatonstep-website`.
- Vérifier l'accueil, les pages d'information et le manifeste `/app-update.json` sur le domaine officiel.
- Contrôler la disponibilité de `/api/health` et des fonctions concernées par la mise à jour.

Les branches autres que `main` peuvent être testées au moyen des prévisualisations Cloudflare configurées pour le projet. Elles ne doivent pas publier sur l'environnement de production.

## Responsabilités distinctes

- **GitHub** : gestion du code et de son historique.
- **Cloudflare Workers** : construction, publication et exploitation du site web et de ses API.
- **Application mobile** : mises à jour et distribution indépendantes du déploiement du site.

La configuration de déploiement se trouve dans `wrangler.jsonc`. Les secrets opérationnels sont gérés dans les paramètres Cloudflare et ne doivent jamais être ajoutés au dépôt public.
