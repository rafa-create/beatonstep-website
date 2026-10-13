# Cartes de performance V1 — moteur métier isolé (sans attribution)

**Date : 13 octobre 2026.** Branche d'étude indépendante du build iPhone
TestFlight et du déploiement du Worker. Références produit :
[BeatOnStep #420](https://github.com/rafa-create/BeatOnStep/issues/420),
[#444](https://github.com/rafa-create/BeatOnStep/issues/444),
[#448](https://github.com/rafa-create/BeatOnStep/issues/448),
[#450](https://github.com/rafa-create/BeatOnStep/issues/450),
[#451](https://github.com/rafa-create/BeatOnStep/issues/451),
[#452](https://github.com/rafa-create/BeatOnStep/issues/452).

## Fichiers ajoutés

- `worker/sport-card-rules.js` : fonctions **pures** sans appels Worker,
  GPS, D1, session utilisateur ni calcul de récompense authentifiée.
- `tests/sport-card-rules.test.mjs` : catalogue fermé, dix distances,
  frontières au demi-mètre, sept niveaux, seuils stricts de minute,
  sélection du plus grand jalon et **aucun repli**. Inclus dans
  `npm run build` pour les vérifications futures.

## Contrat V1

Dix distances explicites : **400 m sub1, 1/5/10/15/20 km,
semi-marathon exactement 21 097,5 m, 30/40 km, marathon exactement
42 195 m**. Les autres distances ne créent **aucune** carte. Les
identités `distanceCm` en centimètres entiers évitent de perdre le
demi-mètre du semi, sans promettre une précision GPS de 1 cm.

Sur une activité **réellement finalisée et dont la preuve a été
authentifiée et validée côté serveur**, le moteur choisit la plus
grande distance de ce catalogue atteinte et horodatée, puis seulement
son `subMinute=floor(elapsedMs/60000)+1` (chrono continu,
**pauses comprises**). Si cette distance ne satisfait pas son plafond
de qualification V1 : **0 carte, même si un 5 km antérieur était bon**.
Le plafond et le niveau `difficulty_*_v1` suivent strictement les
ancres marathon et l'exposant Riegel 1,06 de #451. Le 400 m reste
l'exception `sub1` Expert.

Le résultat `status:'candidate'` est **un calcul**, pas une preuve
cryptographique, pas une propriété mondiale et pas l'annonce d'un gain.
Aucune route ne l'utilise. Les objets de sortie n'ont aucun champ de
rareté ; les 7 codes de difficulté sont secondaires, **jamais des
étiquettes dévalorisantes**. Les skins graphiques précis nécessitent
validation visuelle avant déploiement.

## Priorité Garmin : déjà vraie pour le récapitulatif, pas encore pour ce moteur

Le récapitulatif mobile existant préfère une **distance Garmin
récente ou finale** aux autres valeurs. Le nouveau pilote iPhone
`DistanceGpsPilot` / `DistanceRunSession` est encore relié
uniquement au GPS du téléphone. Une sélection Garmin prioritaire pour
l'**attribution des cartes** devra réutiliser un enregistrement
Garmin correctement horodaté (`runId`, split, pause, freshness),
ne jamais prendre `timerMs` actif comme chronomètre officiel
pauses comprises et ne pas additionner des portions issues de
GPS différents. Sans preuve vérifiable : aucun gain.

## Étapes bloquantes **avant toute activation**

1. Vérifier les capteurs iPhone et Garmin sur vrais appareils, puis
   construire une preuve sportive cohérente et attestée côté serveur.
2. Établir les règles de croisement avec les anciennes activités et
   les imports Apple Santé; éviter que la même course soit revendiquée
   plusieurs fois.
3. Créer un schéma **sportif distinct** du registre historique
   `workout_cards` musical, avec `UNIQUE(distance_cm,sub_minute)`,
   `run_id`, historique privé et transactions D1 atomiques.
4. Réaliser les gains automatiques, vols, notifications et liens
   cadeau à invalidation irréversible, sous **feature flag désactivé**
   jusqu'aux tests de concurrence et sécurité.
5. Dessiner et faire approuver 7 skins **discrets et également
   gratifiants**, puis ajouter collection, site, PNG, tests FR/EN.
6. Tests D1/API, GPS réel/verrouillage, iOS/Android, cas hors ligne
   avant toute fusion release, migration de production ou activation.

**Garde de sécurité :** `DISTANCE_CHALLENGES_ENABLED=false`
dans la configuration Worker. Les migrations 0005 et 0006 ont été
signalées comme déjà appliquées manuellement en production ; ne pas
les rejouer. Aucune modification de la branche
`release/v1.0.0` ni du workflow Codemagic en cours.
