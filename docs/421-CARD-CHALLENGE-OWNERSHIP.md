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

## Nouveau schéma 0006 (préparé, NON appliqué)

Le 12 octobre, le coureur a confirmé que **0005 était déjà appliquée**.
Elle conserve toutefois un CHECK historique comparant
`elapsed_music_sec` à `playlist_duration_sec`, incompatible avec la
décision finale : le temps limite sportif est indépendant de la musique.
Ces colonnes ne doivent jamais recevoir des durées sportives sous de faux
noms pour contourner le CHECK.

La migration additive `migrations/0006_distance_challenge_sport_clock.sql`
prépare donc trois tables **v2 distinctes** pour les futurs essais :
`workout_distance_attempts_v2`, `workout_distance_validations_v2` et
`workout_distance_transfers_v2`. La preuve de course y possède
`deadline_sec` et `elapsed_sport_sec` séparés de toute playlist.
Les tables 0005, leurs enregistrements et le registre historique de
propriété restent intacts. Le nouveau code de lecture
`/api/account/achievements` (navigateur connecté) et
`/api/account/device/achievements` (grant appareil) lit uniquement v2 ;
aucun endpoint d'attribution de succès n'est encore activé.

**Aucune migration de production à lancer à ce stade.**
La commande de smoke SQLite purement locale est
`npm run test:distance-d1` ; elle n'ouvre aucune connexion Cloudflare.
Avant une future exécution distante : accès D1 vérifié, sauvegarde,
lecture de `d1_migrations` et de `sqlite_master`, Preview isolée,
endpoint transactionnel et tests physiques GPS validés, puis accord
explicite pour le changement de production. Ne pas relancer 0005.

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
