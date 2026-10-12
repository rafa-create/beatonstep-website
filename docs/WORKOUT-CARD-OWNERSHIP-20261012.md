# Cartes de séances uniques — décisions et plan de livraison
Date : 2026-10-12
État : **socle de comparaison livré ; propriété et packs non activés**.

## Règles produit confirmées

- **Une séquence musicale unique = une carte unique.** Comparer les morceaux dans leur ordre de lecture, indépendamment de la plateforme, des identifiants du fournisseur, des phases, de leurs valeurs BPM/PPM, de la durée et du titre.
- Ajouter, remplacer, supprimer ou réordonner un morceau crée une nouvelle carte ; changer seulement les paramètres sportifs n'en crée pas.
- Quand une séquence existe déjà, toujours renvoyer la **première carte**, son titre canonique et son créateur d'origine, sans en cloner les téléchargements.
- Une carte a un **créateur permanent** et **un propriétaire unique à la fois**. Le créateur est affiché dans le détail et le propriétaire très discrètement sur la carte du catalogue.
- Tout le monde peut importer la séance, sans posséder sa carte.
- Une publication anonyme crée une carte dans la **réserve non attribuée**. Une publication d'un compte connecté lui donne initialement la propriété de sa nouvelle carte.
- Dans l'espace personnel d'un compte connecté uniquement, un pack permet l'attribution de **une** carte disponible, créée anonymement. Aucune option d'ouverture si la réserve est vide. Ne jamais distribuer la carte d'un membre déjà propriétaire.
- Les utilisateurs ne peuvent pas donner leurs cartes ; **seul l'administrateur** peut générer un transfert par lien spécial sécurisé à usage unique. Pas de vente à ce stade.
- Les transferts changent le propriétaire, jamais le créateur, la carte ni ses statistiques. Conserver l'historique des propriétaires.
- La popularité compte les **imports réels**, et non les simples vues ou ouvertures de lien. **Run Mix est hors du périmètre initial.**

## Audit du code actuel

| Composant | Constat | Conséquence |
| --- | --- | --- |
| `worker/index.js` | `POST /api/shared` crée systématiquement une nouvelle entrée D1 | Mettre en place un lookup unique de la séquence avant INSERT et un garde-fou SQL concurrent |
| `mobile-app/src/services/PublicSharingService.ts` | Le mobile envoie les morceaux `payload.t`, avec `p` (phase), `n` (titre), `a` (artiste) et la source | La signature doit classer les morceaux par phase puis par ordre dans la phase, sans utiliser les IDs de plateforme |
| `migrations/0003_community_profiles.sql` | `signed_shares` identifie le signataire, pas le propriétaire ; suppression de compte retire la signature | Introduire une propriété distincte et préserver la provenance historique sous réserve d'effacement de données personnelles |
| `worker/account.js` | Le propriétaire du compte peut supprimer **définitivement** un partage via `/api/account/shared/:id` | Empêcher la destruction d'une carte de collection en raison de la suppression de sa publication |
| `worker/admin.js` | Seule la modération/suppression existe | Ajouter le transfert administrateur et la vérification à usage unique côté serveur |
| `worker/index.js` + mobile | Le mobile appelle `/import` après sauvegarde, mais l'endpoint public est forgeable et limité par IP/user-agent | Ajouter un mécanisme antifraude et un décompte dédupliqué adapté aux comptes et aux appareils |
| `partages.html` et `compte.html` | Le catalogue et le profil savent montrer les créations, pas les possessions | Ajouter propriétaire discret, créateur au détail, collection et pack dans le profil |

## Socle implémenté

- `worker/workout-identity.js` exporte `workoutMusicSequence` et `workoutMusicFingerprint` ; hash SHA-256 stable basé sur artistes et titres normalisés dans l'ordre effectif.
- `tests/workout-identity.test.mjs` couvre les variations de titre, source, BPM, phases, ordre et morceaux ; quatre tests exécutés localement avec succès.
- Le test est branché dans `npm run build`.
- Cette fonction est **inertielle tant qu'elle n'est pas appelée par les routes de publication** : aucun changement D1 ou comportement utilisateur pour le moment.

### Limite actuelle de la comparaison

Une empreinte de texte artiste+titre ne garantit pas l'identité d'un enregistrement si ses métadonnées diffèrent entre YouTube et Spotify, ou si un artiste manque. Le helper v1 refuse de fusionner les morceaux sans artiste plutôt que de rapprocher abusivement deux enregistrements. Prévoir, plus tard, une table de correspondances vérifiées permettant la réconciliation des variantes d'écriture. Ne jamais comparer uniquement les IDs fournisseurs.

## Séquence de déploiement recommandée

1. **Auditer l'existant D1** : nombre de séances, séquences identiques déjà publiées, comptes et signatures ; choisir la plus ancienne comme carte de référence. Conserver les anciennes URL et les compteurs via des alias non destructifs. Aucun backfill hasardeux.
2. Créer une **migration D1 additive** avec empreinte UNIQUE, lien vers la séance canonique, créateur, propriétaire, réserve anonyme et historique des transferts. Reprendre les signatures existantes comme créateurs de leur carte ; ne pas rendre éligibles les cartes déjà attribuées.
3. Ajouter la publication idempotente et son test de concurrence ; si doublon, renvoyer le lien/titre de référence sans modifier la propriété ni le créateur. Conserver le format d'ID existant et la compatibilité mobile.
4. Exposer `creator` et `owner` dans le catalogue et le détail ; ajouter un espace « Ma collection » dans le compte, sans distraire du parcours d'import public.
5. Ajouter `GET /api/account/pack` et `POST /api/account/pack/open`, uniquement pour un compte connecté, avec sélection et attribution **atomiques** en D1 et enregistrement de l'historique dans la même transaction ou un déclencheur SQL.
6. Ajouter un lien de transfert émis uniquement par un administrateur, expirant et consommable une seule fois par un compte connecté. Tester les courses simultanées, les permissions et le stock épuisé.
7. Adapter la suppression des publications/comptes en protégeant le lien et la carte, tout en anonymisant les identifiants personnels supprimés. Renforcer le compteur d'imports avant toute mise en valeur économique.

## Contraintes d'exploitation

Le site se déploie depuis `beatonstep-website/main` via Cloudflare Workers Builds. Les changements applicatifs éventuels vont sur `BeatOnStep/release/v1.0.0`, mais aucune OTA ne doit être lancée sans VM. **La migration D1 de production est manuelle**, à exécuter dans la console Cloudflare après vérification. La VM distante n'est pas accessible et le quota GitHub Actions est épuisé : ne pas lancer de workflow.
