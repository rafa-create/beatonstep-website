# #454 — Récupération du mot de passe BeatOnStep (branche isolée)

**Développement préparé, NON déployé.** Travail dans la PR site dédiée
`feature/454-password-reset-email` ; branche `main`, binaire iPhone
TestFlight, site public et D1 **inchangés**. Ne pas fusionner tant que
le provider e-mail, la migration et les tests manuels ne sont pas validés.

## Source d'inspiration SaaS

Le dépôt privé `rafa-create/saas` utilise : PBKDF2-SHA-256
100 000 itérations, sessions de durée limitée, cookie HttpOnly et
limitation des tentatives par IP/email. Sa branche `main` ne
contient **pas** de fonctionnalité de mot de passe oublié livrée;
la présente implémentation reprend les **principes**, pas un
parcours de reset existant.

## Parcours utilisateur

- Sur `compte.html`, bouton **Mot de passe oublié ?**.
- Saisie de l'e-mail : même réponse HTTP pour un compte connu et
  inconnu ; aucune confirmation de l'existence du compte.
- Si le compte existe et que le service est configuré, envoi d'un
  lien **à usage unique**, valable **20 minutes**, par Resend.
- Le jeton de 256 bits est généré côté serveur, stocké **haché
  SHA-256**, transmis en **fragment URL #reset=...**, retiré de la
  barre d'adresse immédiatement et jamais mis dans les querystrings.
- Nouveaux mots de passe d'inscription et de réinitialisation : **6 à 128 caractères**, minimum inclusif. La connexion des comptes existants reste inchangée.
- Après confirmation : consommation unique du jeton ; actualisation
  du hash PBKDF2 et du salt ; révocation des sessions navigateur,
  appareils mobiles et anciens codes de liaison ; cookie effacé.
- Les cartes/achievements, possessions, liens cadeaux valides et
  signatures historiques ne sont pas effacés. L'utilisateur se
  reconnecte ensuite sur site et, si besoin, via le flow web
  de connexion ouvert depuis BeatOnStep iOS/Android.

## Configuration manuelle nécessaire avant tout déploiement

1. Vérifier le nom et l'UUID de la D1
   `beatonstep-catalog-prod`, réaliser une **sauvegarde** et
   contrôler le schéma existant. **Ne pas relancer les migrations
   0005 ou 0006**, déjà déclarées exécutées manuellement.
2. Revoir puis appliquer **uniquement la nouvelle migration
   additive** `migrations/0007_community_password_reset.sql`
   après contrôle sur une D1 de test.
3. Configurer Resend (ou remplacer explicitement l'adaptateur par
   le prestataire validé) en **vérifiant le domaine d'envoi** :
   SPF/DKIM/DMARC, adresse dédiée `no-reply@beatonstep.app`.
4. Dans les **secrets du Worker Cloudflare** (et pas GitHub), définir
   `RESEND_API_KEY`. Dans les variables ou secrets, définir
   `PASSWORD_RESET_EMAIL_FROM=no-reply@beatonstep.app`.
5. Confirmer `CATALOG_RATE_SALT` déjà défini : les tentatives
   `password-reset-ip` (8 / heure), e-mail (3 / jour), confirmation
   (12 / 15 minutes) sont stockées sous clés salées hachées.
6. Valider en préproduction : e-mail réel, spam, liens expirés,
   rejoués, concurrence de demandes, erreurs du fournisseur,
   origine HTTP, reconnexion sur application, révocation, suppression
   de compte et maintien de la collection. **Pas de tests d'envoi
   vers des personnes réelles sans autorisation.**

Sans configuration de l'expéditeur et de la clé fournisseur, l'API
répond uniformément `password_reset_unavailable` (503) et
**n'annonce jamais un e-mail envoyé**. Les erreurs de livraison ne
divulguent pas l'existence d'un compte ; un jeton non livré est
révoqué quand le prestataire refuse l'envoi.

## Tests

`npm run build` exécute aussi `tests/password-reset.test.mjs` :
migration non destructive, UI, provider manquant, réponses
indiscernables connu/inconnu, secret uniquement en mail, jeton
haché, confirmation, révocation navigateur + mobile, anti-rejeu,
mot de passe trop court (5 refusé, 6 accepté). **Les tests unitaires ne valident pas le
déploiement ni la réception d'un e-mail réel.**

**Ne pas confondre avec l'auth Google/YouTube/Spotify.**
Le mot de passe ici concerne uniquement le compte catalogue BeatOnStep.
