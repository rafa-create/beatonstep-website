# Cartes sportives — principes et architecture cible

**Décision produit — 14 octobre 2026.** Ce document décrit le fonctionnement visé. Les écarts avec le code actuel sont indiqués ci-dessous ; ils ne doivent pas être présentés comme déjà livrés.

## Principe

BeatOnStep propose des séances à programmer et des cartes sportives à gagner **en courant**. Il n'existe pas de publication manuelle de défis sportifs. Le modèle historique de défi kilométrique publiable V2 n'est plus une fonctionnalité produit ; son retrait technique nécessite une vérification de compatibilité et des données existantes.

Une course enregistrée peut générer une carte pour la plus grande distance canonique éligible et son seuil SUB réellement atteint. L'identité mondiale de la carte est définie par `(distance_cm, time_unit, sub_value)` : un seul détenteur à la fois. Réussites personnelles, donations et périodes de possession restent distinctes.

## Attribution indépendante de la télémétrie

1. L'application termine la course hors ligne ou en ligne et conserve immédiatement le résultat et la carte locale.
2. Après la course, un compte connecté synchronise le résultat avec **Cloudflare Workers**. Le Worker authentifie la demande, contrôle sa structure, calcule la distance et le seuil, empêche les réutilisations d'une même séance et applique l'attribution ou le transfert dans **D1**. Une panne temporaire laisse le résultat local en attente, sans inventer de propriétaire mondial.
3. Une carte attribuée par D1 est immédiatement consultable dans le catalogue sportif public, indépendamment de la VM et des analyses de télémétrie.
4. La télémétrie facultative peut examiner la performance **après** l'attribution, sans retarder, refuser, révoquer ou transférer la carte. En cas d'anomalie, elle produit uniquement le message **« Performance non validée »** sur la carte du détenteur et sur la carte du catalogue. En l'absence de signalement, aucun avertissement n'est affiché ; cela ne constitue pas une certification exhaustive.

Le système d'analyse, qu'il fonctionne sur la VM ou ailleurs, n'est jamais une dépendance des écritures de propriété, de la synchronisation des cartes ni de leur consultation publique. Le service doit pouvoir fonctionner, puis reprendre ses analyses en retard, sans rendre les cartes indisponibles.

Une suspicion sportive (par exemple vitesse invraisemblable) doit devenir un **signalement non bloquant**. En revanche, l'absence d'une distance ou durée exploitable, un identifiant de séance invalide ou une tentative de réutilisation contradictoire restent des erreurs techniques : elles ne permettent pas de déterminer ou d'attribuer une carte mondiale fiable.

## Portée et confidentialité de l'avertissement

Un signalement concerne **la performance qui a entraîné le gain**, pas la valeur sportive de toutes les autres performances du détenteur. Il doit être rattaché de manière stable à la séance acceptée et à l'événement d'attribution, afin de survivre à une consultation ultérieure sans modifier l'historique de propriété.

Le catalogue public expose uniquement la carte, la difficulté, les pseudos publics, les dates de transfert et un éventuel avertissement. Les coordonnées GPS brutes, rapports détaillés de télémétrie, identifiants privés et données de connexion n'y figurent jamais. En cas de suppression de compte, les pseudos historiques sont anonymisés.

## État technique au 14 octobre 2026

- **Déjà codé :** carte locale hors ligne ; endpoint Cloudflare `/api/account/device/sport/reconcile` ; registre mondial D1 ; catalogue sportif public indépendant du catalogue musical.
- **Reste à implémenter :** remplacer les refus liés à la plausibilité sportive dans les parcours mobile/Worker ; stocker le résultat d'analyse séparément et de façon idempotente ; exposer le warning dans l'API publique, le catalogue et le deck personnel ; tester l'attribution avec la VM éteinte et l'analyse différée.
- **Conservé temporairement :** le code V2 désactivé pour compatibilité, sans apparition dans le catalogue « Défis ».

Le déploiement doit être validé par les tests de synchronisation, d'unicité mondiale, de donation, d'anti-rejeu, de panne de télémétrie et de confidentialité avant activation en production.
