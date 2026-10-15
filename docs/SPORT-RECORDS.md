# Palmarès Défis — records sportifs publics (15 octobre 2026)

## Objectif

Permettre à un visiteur de répondre immédiatement à deux questions :

- « Qui a conservé une carte le plus longtemps ? » — **Durée de possession**, toutes difficultés confondues ou filtrée sur un niveau.
- « Qui a conservé une carte parmi les plus difficiles le plus longtemps ? » — **Difficulté puis durée**. Le rang de difficulté prime, puis la durée départage les périodes d'un même niveau.

Un second podium montre les **trois plus grandes collections actuellement détenues** par des profils publics.

L'affichage se trouve dans `partages.html?kind=challenge&view=records`, onglet **Records** à côté de **Cartes**, avec un sélecteur de classement et un filtre de difficulté. Le mode musique n'affiche pas cet onglet. Les items relient à la fiche de carte et, si autorisé, au profil public. Aucun nouveau jeu, trophée, rareté ou statut « mythique » n'est ajouté.

## Source de vérité, inchangée

**Aucune modification du schéma ni des lignes D1**. L'endpoint **GET** `/api/sport/records?sort=duration|difficulty&level=all|<tier>` ne fait que des `SELECT` dans `sport_card_ownership_events`, `sport_world_cards`, `community_users` et `community_profile_settings`.

- Chaque gain ou cadeau crée une *époque de propriété* `(card_id,new_epoch)`. Son début est `e.changed_at` ; sa fin est l'événement suivant `next.previous_epoch=e.new_epoch`. Pour une époque encore possédée par le même compte, la durée courante est `maintenant - début`.
- Les possessions terminées continuent de figurer au classement. Celles d'un compte supprimé restent comptabilisées **anonymement**, sans recréer le profil.
- Un détenteur ayant masqué ses Défis est anonymisé dans les possessions historiques et **exclu des collections publiques**. Aucun e-mail, ID de compte, GPS, chrono privé ou donnée de preuve n'est retourné.
- Le classement de difficulté utilise exclusivement `sport-card-rules.json` via `worker/sport-card-rules.js` : `tierOrder`, `difficultyForSportCard`, `sportCardDifficultyFilterSql`. **Jamais `sport_world_cards.difficulty`**, ancien instantané persistant, ni seuil recopié. Les libellés sont traduits sur la page par `sport-card-percentile.js`, depuis le **même JSON**.
- Les records sont calculés à la requête, non sauvegardés. Les égalités de durée sont départagées de façon déterministe par carte et époque. Aucun `UNION ALL` n'est nécessaire.

## Page informative : une seule source aussi

`scripts/build-static.mjs` produit `dist/sport-card-paliers.json` à partir de `sportCardRulesManifest()`, lui-même import direct du fichier officiel `sport-card-rules.json`. Le générateur réutilise les distances, unités secondes/minutes, caps, niveaux, percentiles et numéro de révision officiels. `cartes-guide.html` charge le manifeste navigateur et rejette une fiche générée dont la révision/distances/niveaux ne correspondent plus à la source.

Les **étoiles par niveau** et les pourcentages du tableau pédagogique sont dérivés du JSON à l'affichage ; seules les traductions des noms de difficulté restent du texte local. Aucun deuxième barème et aucun niveau « mythique ».

## Validation et exploitation

`tests/sport-records.test.mjs` vérifie les époques, les propriétaires anonymisés, le classement à niveau égal, le filtrage via le barème officiel, le caractère exclusivement lecture seule et les filtres invalides. `tests/public-sharing-interactions.test.cjs` couvre l'onglet Records et son bilinguisme. `tests/sport-card-guide.test.mjs` garantit que le guide et ses explications suivent le JSON, y compris une future modification du percentile Expert. Tests intégrés dans `npm run build`.

**Attention :** les fichiers versionnés sur GitHub et la validation ciblée ne prouvent pas à eux seuls le déploiement Cloudflare, le passage complet du build, ni la présence de résultats visibles sur un téléphone réel. Ne pas annoncer ces validations sans les journaux correspondants. Le déploiement du Worker + des fichiers statiques demande une publication du site, **aucune migration D1 et aucune OTA**.
