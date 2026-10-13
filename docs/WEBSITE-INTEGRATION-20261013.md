# Intégration du site — cartes V1 et récupération du compte
Date : 13 octobre 2026. **Non déployé.** Branche :
`integration/website-cards-account-20261013`.

## Provenance et gestion des conflits

Branche d'intégration issue de
`feature/454-sport-card-rules-v1` (qui contient les changements #21 et
#22) et enrichie avec le parcours de récupération du mot de passe
préparé en PR #23.

Résolutions documentées :
- **`worker/account.js`** : conserver la route protégée
  `myChallengeAchievements` et toutes les cartes musicales de #21,
  ajouter les routes de réinitialisation de #23, conserver l'ancien
  minimum **six caractères** et placer consommation unique du jeton,
  changement du hash et révocation des sessions dans le **même batch
  D1 atomique**. La vérification préalable ne suffit pas à elle seule,
  les requêtes transactionnelles sont elles aussi conditionnelles.
- **`worker/index.js`** : préserver les routes Worker/cartes de #21
  et faire suivre le contexte `ctx` pour l'envoi asynchrone sécurisé.
- **`compte.html`**, tests des mots de passe : conserver la version
  de la PR #23, formulaire et réinitialisation à six caractères.
- **`tests/public-sharing-interactions.test.cjs`** : prendre la
  variante actuelle de `main`, plus récente que l'ancienne branche
  des cartes. `tests/cloudflare-worker.test.mjs` est identique sur
  `main` et la branche des cartes; les quatre routes
  `/api/*`, `/partages.html`, `/cadeau`, `/cadeau/` sont conservées.
- **`package.json`** : conserver `postinstall` et le numéro Wrangler
  actuellement présents sur `main`; cumuler les tests des cartes,
  ceux du reset et des autres fonctionnalités existantes.
- **`wrangler.jsonc`** : préserver les routes `/cadeau` de
  production, les données D1 actuelles et les drapeaux d'activation
  explicites des défis (`false`) y compris en preview.

## Périmètre V1 intégré

- Modèle sportif pur **203 familles** : 400 m par seconde, puis chaque
  km entier 1–200 ainsi que semi et marathon exacts. Sept niveaux
  discrets 400 m et 1–42 km/semi/marathon ; au-dessus du marathon
  niveau Légende. Une candidature calculée **ne donne aucune propriété
  réelle** : pas de vol, donation ou attribution serveur activée.
- Mot de passe oublié site et accès depuis le parcours mobile :
  jeton hashé, limite 20 minutes, e-mail Resend si prestataire
  configuré, mot de passe de 6 à 128 caractères, révocation des
  sessions/grants après reset.

## Déploiement et sécurité : blocages non levés

1. **Aucune fusion automatique sur `main`** : le README indique
   qu'un push sur `main` publie le site en production.
2. **Aucune migration D1 lancée**. Les migrations **0005/0006**
   sont déjà déclarées appliquées en production : **NE PAS
   les relancer**. La nouvelle **0007** doit être testée sur une copie
   D1, puis appliquée après sauvegarde et validation explicite.
3. **Ne pas activer les défis sportifs** :
   `DISTANCE_CHALLENGES_ENABLED=false`. Les preuves GPS/Garmin
   authentifiées, transferts transactionnels, protection des données
   et design restent à implémenter et à approuver.
4. **Ne pas activer le reset** avant expéditeur Resend validé
   SPF/DKIM/DMARC, secrets Worker ajoutés hors GitHub, e-mail réel
   testé et vérification des sessions révoquées. En l'absence du
   provider, l'API répond `password_reset_unavailable`.
5. Pour valider sans déployer :
   `scripts/validate-site-integration-vm.sh`, worktree temporaire,
   `npm run build` et tests SQLite locaux. Les tests VM ne prouvent
   ni une migration réelle, ni la délivrance d'un e-mail, ni un gain
   de carte.

## Étape après préflight

Si les tests combinés passent, faire la **revue de sécurité et de
migration 0007 / provider de mail** avant de préparer une petite
livraison du mot de passe. Les cartes sportives resteront derrière
leur flag, sur une ligne de travail distincte, jusqu'à l'arrivée
d'une preuve GPS/serveur et de transactions fiables.

**`main` et le site public restent inchangés tant que cette revue
et les validations terrain iOS ne sont pas terminées.**
