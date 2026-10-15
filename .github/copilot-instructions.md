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

## Règle SQL obligatoire pour les agents IA

- **Ne jamais commencer un fichier `.sql` par un commentaire**, notamment `--`, `/* ... */` ou un en-tête descriptif ; la première ligne non vide doit être une **instruction SQL exécutable** (`CREATE`, `SELECT`, etc.). Déplacer la documentation en fichier `.md` adjacent ou **après la première instruction SQL terminée par `;`**.
- **Pourquoi :** `wrangler d1 execute --remote --command "$(cat script.sql)"` peut interpréter un texte qui commence par `--` comme un argument de CLI et échouer avec `Unknown argument`, avant tout SQL. Sur une migration critique, le lanceur doit vérifier cette propriété et un test automatique doit empêcher toute régression.
- **Incident connu le 15/10/2026 :** passage de la migration D1 via `--command` bloqué par le commentaire `-- BeatOnStep...` en tête du SQL. Corrigé en commençant le fichier par `CREATE TABLE _bos_track_20261015_guard (...);`. À cet instant **aucun résultat de migration D1 réussi n'est encore attesté** : ne pas confondre correction Git et exécution production.

## Cartes sportives : D1 et demi-fond (état au 15/10/2026)

- La mémoire IA opératoire réside dans le dépôt privé BeatOnStep : `docs/ai-history/SPORT-CARDS-D1-TRACK-20261015.md` et l'index `docs/DOCS-AGENT-MAP.md` ; l'issue [#448](https://github.com/rafa-create/BeatOnStep/issues/448) trace les actions. **Lire ce document avant toute intervention D1 ou activation des distances 800 m, 1 500 m et mile.**
- D1 `beatonstep-catalog-prod` contient **deux cartes sportives de test à conserver**, avec leurs exploits, époques, cadeaux et revues. Ne jamais exécuter de reset destructif. Le seul script envisagé est `scripts/d1-sport-track-preserve-20261015.sql`, à répéter sur une copie puis appliquer **uniquement après autorisation humaine explicite**, bookmark de restauration et fenêtre sans nouvelles écritures.
- **Preuves reçues de l'opérateur** : test SQLite du SQL exact **PASS** ; préflight Cloudflare distant **PASS** (`2/2/2/2/2/2/0` sur les sept tables sportives, `8` références SQL à `sport_world_cards`) ; point de restauration récupéré. **La migration n'a PAS encore été exécutée en production** lors de cette note. Ne pas la déclarer réalisée sans les sorties Wrangler et les vérifications après opération.
- Sur la VM : Node système `v20.20.1` ne permet pas de lancer Wrangler `v4.129.1`; invocation temporaire **validée** `npm exec --yes --package=node@22 --package=wrangler@4.129.1 -- wrangler ...`. Ne pas modifier le Node système simplement pour Wrangler.
- `sport-card-rules.json` conserve **203 distances gagnables** ; `80000,150000,160934` sont dans `pendingTrackDistancesCm` pour le simulateur, mais **non gagnables**. L'accord SQL ne suffit pas à activer les attributions : synchroniser JSON, Worker, mobile, validations et tests après confirmation D1.
- Le rendu premium doit rester sobre : **400 m doré** et **5 km cuivré** même si leur nombre d'étoiles a changé. Mythique = identité `(distance_cm,time_unit,sub_value)` exacte et non tous les SUB plus rapides ; ne pas activer sans décision produit.
