# Cartes sportives — principes et architecture cible

**Décision produit — 14 octobre 2026.** Contrat des cartes sportives ; les changements committés ne sont pas une preuve de déploiement Cloudflare ni de validation terrain.

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

Un signalement concerne **la performance qui a entraîné le gain**, pas la carte transférable dans son ensemble. Il est rattaché exclusivement à l'**époque de propriété** (`card_id`, `owner_epoch`) de ce gain. **Une donation, une fermeture de compte ou une nouvelle acquisition ne transmet jamais l'ancienne alerte** : le nouveau détenteur commence sans avertissement. L'historique de propriété demeure inchangé.

Le catalogue public expose uniquement la carte, la difficulté, les pseudos publics, les dates de transfert et un éventuel avertissement. Les coordonnées GPS brutes, rapports détaillés de télémétrie, identifiants privés et données de connexion n'y figurent jamais. En cas de suppression de compte, les pseudos historiques sont anonymisés.

## État technique au 14 octobre 2026

- **Codé sur GitHub :** carte locale hors ligne ; synchronisation Cloudflare `/api/account/device/sport/reconcile` ; registre mondial D1 ; catalogue public ; anomalies de vitesse/pauses/jalons non bloquantes ; file de revue asynchrone `worker/sport-card-telemetry.js`, exécutée par Cloudflare (cron de 15 minutes) ; avertissement associé au seul `owner_epoch` et exposé sur le site et dans le deck personnel.
- **Activation demandée :** `SPORT_ASYNC_TELEMETRY_ENABLED=true` dans la configuration production du dépôt. Le Worker prépare de façon idempotente le schéma additif de `0011` dans D1 à partir d'une tâche différée après gain ou du cron. En cas d'absence ou d'échec de cette table, les consultations reviennent à l'affichage des cartes sans avertissement et l'attribution reste indépendante. La présence effective du schéma et le déploiement Cloudflare doivent encore être vérifiés sur l'environnement réel.
- **Validation encore nécessaire :** exécuter l'ensemble des tests et vérifier sur appareil réel le gain, l'alerte différée, la donation sans alerte, le catalogue et la VM arrêtée. Une migration native n'est pas nécessaire aux simples textes de warning, sous réserve de vérification OTA/runtime.
- **Conservé temporairement :** l'ancien code V2 désactivé pour compatibilité, sans apparition dans le catalogue « Défis ».

Le code est activé dans `wrangler.jsonc` mais sa publication et la validation terrain ne sont pas confirmées. Vérifier la synchronisation, l'unicité mondiale, la donation, l'anti-rejeu, la panne de télémétrie et la confidentialité, sans manipuler les cartes ni les utilisateurs réels.
