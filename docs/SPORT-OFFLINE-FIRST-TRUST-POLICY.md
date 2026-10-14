# Cartes sportives — courses hors ligne et synchronisation

**Mise à jour du 14 octobre 2026.** La référence fonctionnelle actuelle est [Cartes sportives — principes et architecture cible](SPORT-CARDS-ARCHITECTURE.md). Ce document précise les contraintes de synchronisation et les différences encore présentes dans le code.

## Course et récompense locale

Une course libre ou musicale, avec le GPS du téléphone ou une montre Garmin, ne doit exiger ni réseau, ni démarrage d'un « mode défi », ni transmission continue de positions. L'utilisateur peut courir sans pause. Après l'enregistrement de la séance, l'application conserve localement la carte calculée ; l'attribution mondiale attend seulement la synchronisation du compte.

Les temps SUB utilisent le temps écoulé, pauses comprises. En l'absence d'un pointage au franchissement de la distance, le calcul utilise prudemment l'heure de fin de séance ; il n'extrapole pas un passage plus rapide.

## Autorité mondiale et indépendance

Le Worker Cloudflare authentifie les résultats terminés, protège l'anti-rejeu et modifie la propriété des cartes dans D1. Il peut fonctionner lorsque la VM est indisponible. Les résultats non synchronisés restent en attente sur l'appareil ; ils ne sont pas présentés comme une deuxième propriété mondiale.

La télémétrie est **non bloquante** dans l'architecture cible. Une analyse tardive pourra uniquement faire apparaître « Performance non validée » sur la fiche du détenteur et dans le catalogue. Elle ne retire pas la carte. Les contrôles de structure, d'identité et d'unicité restent nécessaires.

## Statut et validation

Le code mobile et Worker accepte maintenant une allure anormale, une pause incohérente ou des jalons inutilisables **sans refuser une carte calculable**. La mesure de distance et le temps de départ/fin doivent malgré tout être exploitables. Les jalons incohérents sont ignorés et le temps final est utilisé par prudence.

Une revue facultative est mise en file **après** l'attribution dans `sport_card_telemetry_reviews`, puis traitée par un cron Cloudflare. Son indicateur « Performance non validée » est visible seulement durant la période de propriété `owner_epoch` concernée : **un nouveau détenteur par donation n'hérite pas du warning**. Aucun résultat de revue ne peut modifier la propriété D1.

**Activation demandée — 14 octobre 2026 :** le dépôt configure `SPORT_ASYNC_TELEMETRY_ENABLED=true` en production. La table additive `0011_sport_card_telemetry_reviews.sql` peut être initialisée de façon idempotente par le cron Cloudflare ou une tâche post-attribution, sans VM ; si l'initialisation échoue, l'attribution et l'affichage des cartes restent disponibles sans warning. Le déploiement Cloudflare effectif, le schéma D1 et les tests sur appareils doivent encore être confirmés.

Le code historique V2 de publication kilométrique reste désactivé et exclu du produit ; son retrait requiert un inventaire de compatibilité des anciennes données.

