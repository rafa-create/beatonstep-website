# Cartes sportives — courses hors ligne et synchronisation

**Mise à jour du 14 octobre 2026.** La référence fonctionnelle actuelle est [Cartes sportives — principes et architecture cible](SPORT-CARDS-ARCHITECTURE.md). Ce document précise les contraintes de synchronisation et les différences encore présentes dans le code.

## Course et récompense locale

Une course libre ou musicale, avec le GPS du téléphone ou une montre Garmin, ne doit exiger ni réseau, ni démarrage d'un « mode défi », ni transmission continue de positions. L'utilisateur peut courir sans pause. Après l'enregistrement de la séance, l'application conserve localement la carte calculée ; l'attribution mondiale attend seulement la synchronisation du compte.

Les temps SUB utilisent le temps écoulé, pauses comprises. En l'absence d'un pointage au franchissement de la distance, le calcul utilise prudemment l'heure de fin de séance ; il n'extrapole pas un passage plus rapide.

## Autorité mondiale et indépendance

Le Worker Cloudflare authentifie les résultats terminés, protège l'anti-rejeu et modifie la propriété des cartes dans D1. Il peut fonctionner lorsque la VM est indisponible. Les résultats non synchronisés restent en attente sur l'appareil ; ils ne sont pas présentés comme une deuxième propriété mondiale.

La télémétrie est **non bloquante** dans l'architecture cible. Une analyse tardive pourra uniquement faire apparaître « Performance non validée » sur la fiche du détenteur et dans le catalogue. Elle ne retire pas la carte. Les contrôles de structure, d'identité et d'unicité restent nécessaires.

## Différences à résorber

Le code actuel `worker/sport-offline-eligibility.js` peut encore retourner `unverified` lors d'une anomalie de vitesse ou de jalons. `worker/sport-offline-reconciliation.js` convertit ce statut en refus, et l'application peut alors marquer la carte `rejected`. Ce fonctionnement doit être remplacé avant de considérer l'architecture cible comme livrée.

La persistance des avertissements, leur association aux événements de gain, leur affichage public et privé, ainsi que les tests sans VM restent également à réaliser. L'accès au catalogue des cartes sportives est déjà séparé de l'ancien catalogue de partages musicaux.

La suppression technique de l'ancien V2 doit attendre un inventaire des usages et des données : il est désactivé et hors parcours produit, mais son code reste référencé.

