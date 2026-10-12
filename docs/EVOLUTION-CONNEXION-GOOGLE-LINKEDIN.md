# Évolution différée — connexion au catalogue avec Google et LinkedIn

**Statut : à faire plus tard. Aucune configuration fournisseur demandée pour l'instant.**

## Objectif utilisateur

Permettre l'inscription et la connexion au **compte facultatif du catalogue BeatOnStep** via Google et LinkedIn. Le pseudo du catalogue reste la signature affichée sur les séances et Run Mix. Les personnes non connectées continuent à publier anonymement, comme aujourd'hui.

Le compte du catalogue et la connexion à YouTube Music sont **strictement distincts**. Se connecter avec Google au catalogue ne doit pas autoriser automatiquement YouTube, ni l'inverse.

## Prérequis bloquants

- Créer et configurer une application OAuth auprès de **Google** et de **LinkedIn**, leurs identifiants client et URI de retour HTTPS sur `beatonstep.app`.
- Définir les secrets correspondants côté Cloudflare Worker uniquement (jamais dans le dépôt Git ni dans le binaire mobile).
- Confirmer les autorisations disponibles et les éventuels contrôles requis par chaque fournisseur au moment de l'implémentation.

**L'utilisateur a demandé de ne procéder à aucune configuration de fournisseur maintenant.** Ne pas afficher de boutons « Continuer avec Google » ou « Continuer avec LinkedIn » tant qu'ils ne fonctionnent pas réellement.

## Conception prévue

1. Ajouter au Worker un échange OAuth sécurisé, avec state anti-CSRF, vérification d'identité, nonce et PKCE quand applicables, validation de l'émetteur et de l'audience.
2. Ajouter une table d'identités externes associées à `community_users`, identifiées par le couple fournisseur + identifiant stable. Conserver l'e-mail privé et le pseudo public.
3. Permettre de lier un fournisseur à un compte existant **seulement après authentification vérifiée**, sans fusion automatique sur la seule base d'une adresse e-mail potentiellement différente/non vérifiée.
4. Maintenir la liaison application-site déjà conçue : le site authentifié remet une autorisation mobile limitée à la publication, quel que soit le mode de connexion.
5. Définir les comportements de reconnexion, retrait d'accès, déconnexion, suppression de compte et perte d'accès à un fournisseur.
6. Mettre à jour les règles de confidentialité, les traductions FR/EN et les tests complets. Montrer les boutons seulement une fois le parcours déployé et testé.

## Situation actuelle

Le site propose une inscription classique par pseudo, e-mail et mot de passe. Le seuil de création a été abaissé à **6 caractères minimum** sur le formulaire et dans le Worker. Les comptes existants et leur méthode de vérification ne changent pas.

Aucune migration Cloudflare D1 ni nouvelle OTA mobile ne sont nécessaires pour ce changement de longueur de mot de passe.
