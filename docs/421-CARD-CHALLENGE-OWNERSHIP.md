> **⚠️ Contrat produit du 13 octobre 2026 : ce document du 12 octobre décrit une ANCIENNE approche « carte Distance = défi programmé distance × deadline ». Pour les futures CARTES SPORTIVES, NE PAS l'utiliser comme spécification de référence.** La source de vérité V1 est maintenant constituée des issues mobiles [#420](https://github.com/rafa-create/BeatOnStep/issues/420), [#444](https://github.com/rafa-create/BeatOnStep/issues/444), [#448](https://github.com/rafa-create/BeatOnStep/issues/448), [#450](https://github.com/rafa-create/BeatOnStep/issues/450), [#451](https://github.com/rafa-create/BeatOnStep/issues/451) et des issues d'historique/transferts associées.
>
> **Règle désormais prioritaire :** gain passif après une course normale finalisée et vérifiée, sans mode Défi ; un seul plus grand palier de distance **dans un catalogue fermé de 10 familles** (400 m sub1, 1 km, 5 km, 10 km, 15 km, 20 km, semi-marathon exact 21,0975 km, 30 km, 40 km, marathon exact 42,195 km), chrono officiel pauses comprises, sous-minute stricte et **aucun repli** si la performance finale ne qualifie pas. Les 2/3/4/21/22/25/35/42/43/50 km ne créent pas de cartes en V1. `distance_cm` doit préserver le demi-mètre du semi sans promettre une précision GPS centimétrique.
>
> **Sept niveaux de difficulté seulement, pas de rareté ; design discret, chaleureux et également qualitatif pour le niveau Débutant comme pour Élite.** Cette hiérarchie visuelle discrète et les sept skins détaillés nécessitent encore approbation graphique.
>
> **Migration existante ≠ schéma complet du futur jeu.** `0005` et `0006` ont été déclarées appliquées manuellement en D1 production mais décrivent des tentatives liées à l'ancien défi programmé. **Ne pas rejouer ces migrations, ne pas adapter silencieusement l'identité des cartes musicales pour les performances**, ne pas activer `DISTANCE_CHALLENGES_ENABLED`. Le futur registre de cartes sportives, course/idempotence et transfert sécurisé exige un design D1 distinct et une migration ultérieure explicite. La TestFlight iPhone 1.7.2 en cours ne doit pas être modifiée pendant sa validation.

---

# #421 — Cartes défis dynamiques, réussite pérenne, site et compte
**Conception du 12 octobre 2026. Non publiée / en branche isolée.**
Ne pas toucher aux cartes historiques de séances chronométriques.

## Contrat coureur retenu
- Chaque carte **Distance** est un **défi canonique unique par distance
  et limite de temps**, indépendant des chansons et de la bibliothèque
  musicale (exemple : une seule carte 5 km / 30 min pour tout BeatOnStep).
- Les PPM/BPM et la playlist sont personnels. L'utilisateur peut modifier
  sa musique sans créer un nouvel exemplaire de la carte ou changer
  le règlement du défi.
- **Victoire** dès que le GPS confirme la distance avant ou à l'échéance
  chronométrique (5 km <= 30 min) ; **échec** à la limite de temps si
  la distance est insuffisante et le GPS fiable. La fin anticipée de la
  playlist n'est **ni une victoire ni une défaite** : continuer la musique
  via une réserve de titres compatible. Le chronomètre sportif n'est
  pas déduit de la durée des chansons.
- Un compte connecté peut importer/lancer une séance défi **sans posséder
  sa carte**. Une nouvelle victoire vérifiée fait de ce compte **le
  propriétaire courant de l'unique carte**. Le propriétaire précédent
  perd la détention mais conserve son accomplissement personnel.
- Plusieurs coureurs peuvent gagner le même défi, mais il n'existe à
  aucun moment plus d'un propriétaire. Même un ancien propriétaire peut
  retenter avec une **nouvelle** séance pour reprendre la carte.
- La possession peut durer quelques secondes. Une réalisation réussie
  reste affichée dans **Mes défis réussis**, sans dépendre de la détention.
  Ne jamais masquer la réussite si la carte change de mains, ni émettre
  une nouvelle carte juste parce que le détenteur change.
- Les **cartes Temps** existantes restent inchangées : ni défi
  obligatoire, ni recouleur, ni capture de propriété sportive.
- Les **cartes Distance** changent de couleur seulement pour un
  utilisateur à qui la carte appartient ET qui a réussi ce défi.
  Une ancienne propriété reste visible dans les archives de cet
  utilisateur ; le nouveau propriétaire n'hérite **pas** de la
  réussite sportive du précédent.

## Trois registres réutilisant l'existant

1. **Possession actuelle** : `workout_cards.owner_user_id` et
   `acquired_at` restent source de vérité (ne pas créer d'inventaire bis).
2. **Passage de main** : `workout_card_history` et son trigger
   `workout_card_history_change` conservent les transitions, motif
   `challenge_win` / `gift` / `pack`, avec horodatage serveur.
   L'ancien propriétaire peut retrouver toutes les périodes de détention.
3. **Preuve personnelle et palmarès** : migration additive proposée
   `migrations/0005_workout_challenge_validations.sql`, avec
   `workout_challenge_attempts` (journal d'essais), `workout_challenge_validations`
   (une première victoire par `user_id + share_id`) et
   `workout_challenge_transfers` (lien entre tentative et transfert).
   **On ne déduit JAMAIS un vainqueur de la liste des anciens
   propriétaires** : pack ou cadeau n'est pas une victoire.

## Site Internet (compte et fiche de carte)

- **Fiche publique d'une carte Distance** :
  `5 km · limite 30:00` (playlist/PPM personnels, non constitutifs de
  l'identité de la carte), **N coureurs distincts ayant validé le défi** (depuis la table des
  validations), nom du propriétaire actuel, historique chronologique des
  propriétaires (motif + date/heure), liste de vainqueurs seulement sous
  pseudos et consentement. Exclure données GPS et sessions détaillées
  d'autres utilisateurs.
- **Fiche publique d'une carte Temps** : la présentation existante
  de la durée en minutes ; pas de compteur de réussites sportives.
- **Mon compte** : une section **Mes cartes** montrant seulement les cartes
  actuellement détenues ; une section séparée **Mes défis réussis**
  montrant toutes les validations du coureur, même les cartes cédées
  ou perdues. Pour chaque défi : date de première réussite, meilleur
  temps, **nombre total de réussites** (journal des tentatives),
  propriétaire actuel et mes périodes de propriété.
- **Carte colorée** uniquement via attribut serveur privé
  `goalMode==='distance' && challengeValidated===true && owner===me`.
  Le catalogue public ou l'invitation cadeau n'affichent jamais le
  badge personnel d'un autre compte.

## Exigences de compatibilité incontournables

- Identité des séances historiques (v1) actuellement calculée par
  `worker/workout-identity.js` sur la **séquence musicale seulement**.
  Pour un défi, il faut une **empreinte versionnée v2 du règlement
  sportif** incluant `distanceMeters` et `deadlineSec`, et excluant
  titres, ordre des morceaux, BPM, PPM personnels et fournisseur musical.
  Cela distingue 5 km/20 min de 5 km/25 min mais garde **une seule**
  carte 5 km/30 min quel que soit le coureur. Conserver les anciens
  liens et alias sans fusion destructive des cartes v1.
- `worker/index.js` valide encore les phases en secondes
  `payload.v===1`. Prévoir un schéma v2 explicite `goalMode='distance'`
  et des champs `targetMeters` et `deadlineSec` ; ne pas convertir les
  mètres en secondes ni la playlist en chrono de défi.
- Adapter ensemble le catalogue `partages.html`, `compte.html`,
  les cartes natives `CommunityCardsService.ts` /
  `CollectibleWorkoutCard.tsx`, l'import, l'export et les pages cadeaux.
- Le modèle et le flux **pack + cadeau** restent valables. Un cadeau
  en cours devient caduc si un tiers gagne la carte entre émission du
  lien et acceptation ; l'API actuelle revalide déjà le propriétaire
  au moment de l'acceptation. L'IHM doit expliquer ce cas.
- `workout_card_history` stocke `previous_owner_id` et
  `new_owner_id`, sans notion de fin : pour une période de possession,
  la date de fin se déduit de l'événement suivant. Une absence de
  transfert suivant veut dire « détention actuelle ».
- Le compte peut être supprimé et les données personnelles doivent
  respecter les obligations de retrait ; « preuve pérenne » signifie
  **jamais effacée par un don/transfert**, pas une promesse
  d'immutabilité légale ou cryptographique.

## Sécurité minimale sans exclure les coureurs de bonne foi

- La vérification côté serveur repose sur une tentative **authentifiée**
  et unique, pas un simple POST disant `won:true`.
- Le mobile prépare un résumé local de mesures GPS et chronologie du
  **chrono sportif** plausibles, sans envoyer de trace brute. La playlist
  est facultative/personnelle pour l'identité du défi, sans donner de
  minutes supplémentaires si un morceau dure plus que prévu.
- Antirejeu (`attempt_id` unique), rate limit, ordre officiel des
  attributions fixé **par réception/validation serveur**, mise à jour
  atomique de la propriété et de l'historique D1. Si deux courses se
  terminent à la même seconde, chaque événement est ordonné côté serveur.
- Ne pas présenter un GPS de téléphone comme une preuve infalsifiable :
  filtrer les vitesses/sauts impossibles, conserver un état
  `unverified` et un mécanisme de signalement/modération.
  Bannissements ciblés après examen, pas de bannissement arbitraire.
- Éviter le spam de transfert par revalidation d'un **ancien** résultat :
  une nouvelle prise de propriété exige une nouvelle tentative réelle.
- Hors connexion : le défi sportif peut être terminé localement,
  mais la **détention officielle** ne change qu'après réception
  et acceptation par le serveur ; ne pas antidater une propriété en
  supprimant les transferts intervenus entre-temps.

## Migration D1 0005 déjà exécutée le 12 octobre

Le propriétaire du projet a confirmé l'exécution du script dans D1.
**Ne pas relancer une migration ni supprimer de tables existantes.**
Les colonnes historiques `playlist_duration_sec` et
`elapsed_music_sec` du journal de tentatives reflètent l'ancienne
conception. Le Worker définitif devra conserver la durée musicale
séparément de `deadlineSec` et du temps sportif enregistré (une
migration additive de colonnes supplémentaires pourra être nécessaire).
Le schéma installé ne constitue pas une API anti-triche ou de transfert.

## Nouveau schéma 0006 — appliqué manuellement en production (déclaratif)

Le propriétaire a confirmé l'application de
`migrations/0006_distance_challenge_sport_clock.sql` dans **la base D1 de
production**, après 0005, alors que **la plateforme n'a pas encore
d'utilisateurs**. Cette déclaration n'est pas une vérification directe des
tables et index. **NE PAS relancer 0005 ni 0006.**

0005 garde son historique de durée musicale. 0006 a été conçu pour
ajouter trois tables sportives indépendantes :
`workout_distance_attempts_v2`,
`workout_distance_validations_v2` et
`workout_distance_transfers_v2`, avec `deadline_sec` et
`elapsed_sport_sec`. Les données anciennes et la propriété actuelle
des cartes ne sont pas migrées ni écrasées par ces instructions.

L'installation en production du schéma ne vaut **pas activation du
service** : `DISTANCE_CHALLENGES_ENABLED=false` reste obligatoire ;
les routes de succès sécurisé, anti-rejeu et transfert atomique ne sont
pas encore finalisées ni validées. Les endpoints de consultation v2
restent désactivés tant que cette bascule est fausse.

**Prochain contrôle D1 en lecture seule seulement** : inspecter
`sqlite_master` pour les trois tables et les quatre index v2, vérifier
`PRAGMA foreign_key_check` et le registre `d1_migrations` si présent.
Une migration exécutée par copier-coller dans l'interface D1 peut ne
pas être enregistrée dans le journal officiel de Wrangler. Documenter
ce décalage s'il existe, ne pas réappliquer le fichier et ne pas modifier
le journal à l'aveugle. Avant toute prochaine modification de schéma,
préparer une sauvegarde.

Les tests SQLite en mémoire (`npm run test:distance-d1`) sont
indépendants de la D1 en production.

## Publication canonique v2 préparée sur la branche

Le Worker accepte structurellement le règlement versionné exact
`{v:2,goalMode:'distance',targetMeters,deadlineSec}` uniquement.
Il refuse les champs supplémentaires comme playlist privée, morceaux,
coordonnées GPS ou jetons. Le nom affiché est généré par le serveur.
Le hash global de la carte dépend uniquement de la distance et du temps limite.
Deux personnes publiant le même règlement obtiennent le même identifiant.

Le compte ayant publié **ne gagne aucune carte** : le nouveau
`workout_cards.owner_user_id` est NULL, avec `pack_eligible=0`
jusqu'à une victoire future officiellement acceptée. Les séances
Temps v1 gardent leur mécanisme de création/propriété historique.

**`DISTANCE_CHALLENGES_ENABLED=false` dans la configuration production
et Preview.** Publier du v2, ainsi que consulter les réussites v2,
reste indisponible tant que le schéma 0006 présent en production n'a
pas été vérifié en lecture seule, que le transfert transactionnel et l'anti-rejeu ne sont
pas livrés et que les essais GPS réels ne sont pas concluants.
Ne pas activer le drapeau uniquement parce que les tests SQLite passent.

## Tests et ordre de livraison

1. Tests identité v1 conservée / identité v2 distincte ;
   migration additive / aucun compte ni carte effacés.
2. Tests de victoire, preuve par user/card, compteur distinct,
   tentative rejouée, concurrence, prise de carte sans la posséder.
3. Tests cadeau avec transfert concurrent, pack, ancien propriétaire,
   compte supprimé, compte anonyme, statistiques publiques respectueuses
   de la confidentialité.
4. Tests de rendu sur site et mobile ; seuls les défis validés appartenant
   au compte courant changent de couleur.
5. Puis et seulement ensuite pilote GPS/audio sur téléphone physique,
   release du Worker avec migration vérifiée, validation du site et
   nouvelle build native sous autorisation explicite.

**Statut : concept approuvé pour réflexion de produit, pas encore
l'ensemble des comportements développés ni validés en production.**
