# Cartes uniques de séance — état et déploiement (12 octobre 2026)

**État : code et interfaces versionnés sur `beatonstep-website/main`, fonctionnalité désactivée (variable `CARDS_ENABLED` absente ou différente de `true`). Migration D1 partielle constatée, réparation préparée mais non exécutée. Aucune OTA.**

## Contrat fonctionnel
- Une séance partageable est identifiée par l'**ordre de lecture des morceaux** (titres + artistes normalisés), sans tenir compte du titre de séance, de ses BPM/PPM, durées, phases et identifiants musicaux propriétaires.
- À séquence identique, réutiliser l'ID de la première carte, son titre, son créateur et son historique d'imports. Une vraie modification de morceau ou d'ordre crée une nouvelle carte. Run Mix non concerné.
- Créateur initial immuable tant que son compte existe ; en cas d'effacement légal du compte, afficher « Anonyme ». Propriétaire unique et transférable.
- Toute séance demeure importable par tous. Le propriétaire est discrètement visible dans le catalogue ; le créateur apparaît dans le détail.
- Les cartes publiées anonymement vont dans la réserve, tant qu'elles n'ont pas de propriétaire. Les créations connectées appartiennent initialement à leur créateur.
- Un compte peut ouvrir un pack depuis son espace personnel seulement s'il existe du stock. **Un pack = une carte**. La première version limite volontairement à **un pack de bienvenue par compte** pour éviter l'épuisement de la petite réserve ; les récompenses de fin de course sont un développement ultérieur.
- Seul l'administrateur crée un lien de don (sept jours, un usage). Le destinataire doit être connecté. Aucun don direct ni vente par les membres.
- Conserver l'historique des propriétaires, et protéger une séance publiée contre la suppression individuelle par son créateur.

## Implémentation livrée

| Élément | Chemin |
| --- | --- |
| Identité musicale (SHA-256, artiste/titre normalisés) | `worker/workout-identity.js` |
| Publication idempotente, alias et backfill progressif | `worker/cards.js` |
| Route publique et métadonnées propriétaire/créateur | `worker/index.js` |
| Pack atomique, collection et acceptation de don | `worker/pack.js` + `worker/account.js` |
| Génération du lien et réconciliation admin | `worker/admin.js`, `admin.html` |
| Catalogue avec propriétaire discret | `partages.html` |
| Collection, pack et réception dans le profil | `compte.html` |
| Schéma additif et triggers d'historique et de pack | `migrations/0004_workout_cards.sql` |
| Tests inclus dans `npm run build` | `tests/workout-identity.test.mjs`, `tests/card-ownership.test.mjs` |

La comparaison multi-plateforme est **volontairement limitée aux mêmes libellés titre + artiste**, après normalisation des espaces et de la casse. Les titres différents entre Spotify et YouTube, les reprises et les métadonnées manquantes ne sont pas réconciliés à cette étape. Les anciennes séances sans artiste peuvent rester hors collection tant qu'elles n'ont pas été contrôlées.

## État de D1 observé le 12 octobre 2026 à 13h21 (retour utilisateur)

- `shared_items WHERE kind='workout'` : **4** séances préservées.
- `workout_cards` : **0** ; `workout_card_aliases` : **0** ; stock : **0**. C'est attendu avant réconciliation, pas un signe de perte.
- Sur les 9 objets attendus, **seules 3 tables existent** : `workout_cards`, `workout_card_aliases`, `workout_card_history`. Les 2 tables de pack/don et les 4 triggers ne sont pas installés.
- **Ne pas lancer le backfill ni activer `CARDS_ENABLED` dans cet état.**
- Un correctif `worker/cards.js` vérifie désormais l'existence des 5 tables + 4 triggers. Migration partielle = erreur bloquante avant attribution ou backfill.
- Pour terminer : après sauvegarde D1, exécuter `migrations/0004b_complete_partial_install.sql` dans la console SQL de `beatonstep-catalog-prod`. Le script est idempotent et n'écrit aucune ligne métier. Si la console coupe un `CREATE TRIGGER`, exécuter chaque définition entière (jusqu'à `END;`) séparément.
- Vérifier à nouveau `SELECT name,type FROM sqlite_master ...` : **9 lignes (5 tables + 4 triggers)** ; si moins, récupérer l'erreur SQL exacte et ne pas continuer.
- Après cette vérification et les contrôles sauvegarde, lancer la réconciliation admin, puis contrôler `workouts=canonical+aliases+skipped`. Ne pas activer les packs tant que le traitement et les tests ne sont pas validés.

## Procédure de mise en service (manuelle, ne pas sauter d'étape)

1. Faire une **sauvegarde/export D1** de la production `beatonstep-catalog-prod` (UUID `278e152c-3338-4e0d-adfd-673eac7c60cb`) et conserver une fenêtre de retour arrière. Ne pas exécuter les commandes sur une autre base.
2. Dans la console SQL de cette base, exécuter le contenu **intégral** de `migrations/0004_workout_cards.sql`. Ce script n'efface et ne transforme aucune publication historique. Vérifier les tables et triggers :
   ```sql
   SELECT name,type FROM sqlite_master
   WHERE name IN ('workout_cards','workout_card_aliases',
     'workout_card_history','workout_pack_claims','workout_card_gifts',
     'workout_card_history_first','workout_card_history_change',
     'workout_card_pack_claim','workout_card_alias_imports')
   ORDER BY type,name;
   ```
   Attendu : **5 tables et 4 triggers**.
3. Se connecter à `https://beatonstep.app/admin.html`, cliquer sur **Réconcilier les séances historiques**. Le Worker traite par pages de 40, dans l'ordre de création. La plus ancienne devient canonique ; les copies deviennent des alias (anciens liens conservés) et leurs imports historiques sont reportés une seule fois.
4. Vérifier en D1 les totaux puis les doublons résiduels et les exclusions (métadonnées manquantes) :
   ```sql
   SELECT (SELECT COUNT(*) FROM shared_items WHERE kind='workout') AS workouts,
     (SELECT COUNT(*) FROM workout_cards) AS canonical,
     (SELECT COUNT(*) FROM workout_card_aliases) AS aliases,
     (SELECT COUNT(*) FROM workout_cards WHERE pack_eligible=1 AND owner_user_id IS NULL) AS stock;
   SELECT fingerprint,COUNT(*) FROM workout_cards GROUP BY fingerprint HAVING COUNT(*)>1;
   ```
   Attendu : aucune empreinte en double ; `workouts = canonical + aliases + exclus` (les séances non comparables sont comptées à part dans le bilan admin).
5. **Après seulement** : activer dans `wrangler.jsonc` > `vars` la variable `"CARDS_ENABLED":"true"`, puis publier le site via Cloudflare Workers Builds. Ne pas activer tant que le backfill n'est pas terminé.
6. Vérifier sur le site le retour d'une publication musicale identique (même ID et titre), le pack d'un utilisateur test avec une seule carte anonyme, l'indisponibilité quand stock=0, les liens de don expirés et consommés, puis la disponibilité continue des anciennes URL. Contrôler la création et la suppression de compte.

**Ne pas lancer GitHub Actions ni OTA** : la VM est indisponible et le quota Actions épuisé. Les changements concernent le Worker et les pages du site ; le mobile n'est pas modifié.

## Risques et travail restant
- Le compteur d'imports actuel est appelé après sauvegarde locale, mais le endpoint public `/import` reste falsifiable malgré sa limitation IP/jour. **Il n'est pas encore une mesure robuste des imports réels**. Prévoir une attestation et une déduplication par compte/appareil côté serveur avant de donner une valeur financière à la popularité.
- L'identité des morceaux sans artiste et les variantes textuelles des plateformes sont volontairement remises à plus tard.
- Les packs ne sont pas encore liés à l'événement de fin de course. Le pack de bienvenue (une ouverture par compte) permet de valider l'expérience web sans nouvelle OTA.
- Le backfill doit être testé sur une copie D1 avant production ; seuls des contrôles de syntaxe et tests unitaires/mocks ont été effectués ici, **pas un test bout en bout sur la D1 réelle**.
