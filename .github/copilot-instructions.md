# Contribution guidance for AI assistants

This repository publishes the BeatOnStep website.

- Make code, content, and documentation changes **directly on `main`**.
- **Do not create branches or pull requests** for changes to this repository.
- Inspect the relevant files before editing; keep each change small and focused.
- Check the affected pages and both FR/EN versions when applicable.
- Changes committed to `main` can be published automatically. Never add secrets or private project details to this public repository.

## Maintenance incrémentale des pages et des API

Le dépôt contient aussi les API Cloudflare Workers/D1 consommées par l'application mobile : ce n'est pas qu'une vitrine.

- Lorsqu'une évolution touche une page ou un module Worker volumineux, **envisager un découpage local et cohérent** (composant, fonction, traitement, route, service). Extraire uniquement si cela réduit vraiment le couplage, la duplication ou la difficulté des tests. La taille du fichier seule ne justifie pas un refactoring, et aucune limite de lignes n'est imposée.
- Garder l'évolution ciblée et préserver les comportements des utilisateurs, les contrats des API, les formats de données, les permissions, les règles D1, la compatibilité des clients mobiles, l'accessibilité et les contenus FR/EN.
- Toute extraction effectuée doit être accompagnée de **tests de non-régression ciblés** ; lancer les validations pertinentes, notamment `npm run build` lorsque possible. Signaler les vérifications non exécutées.
- Si aucune extraction sûre et réellement utile ne se présente, conserver le fichier tel quel et l'expliquer brièvement dans le bilan.
- Pour les modifications d'API, vérifier les conséquences à la fois sur le site et sur l'application mobile. Ne pas supposer qu'une modification du Worker n'affecte que le site.
