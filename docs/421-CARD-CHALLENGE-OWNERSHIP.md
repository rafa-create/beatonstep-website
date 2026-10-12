# #421 — Cartes défis dynamiques, réussite pérenne, site et compte
**Conception du 12 octobre 2026. Non publiée / en branche isolée.**
Ne pas toucher aux cartes historiques de séances chronométriques.

## Contrat coureur retenu
- Chaque séance **Distance** est un défi, défini par kilomètres, PPM
  ciblés et une liste déterminée de chansons / durée réelle.
- Victoire dès que le GPS a vérifié le kilométrage **avant ou à la fin**
  de la playlist. Échec si fin musicale avec distance insuffisante et
  mesure GPS fiable ; sinon non vérifiable.
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
  `5 km · playlist réelle 20:00 · 160 PPM`,
  **N coureurs distincts ayant validé le défi** (depuis la table des
  validations), nom du propriétaire actuel, historique chronologique des
  propriétaires (motif + date/heure), liste de vainqueurs seulement sous
  pseudos et consentement. Exclure données GPS et sessions détaillées
  d'autres utilisateurs.
- **Fiche publique d'une carte Temps** : la présentation existante
  de la durée en minutes ; pas de compteur de réussites sportives.
- **Mon compte** : une section **Mes cartes** montrant seulement les cartes
  actuellement détenues ; une section séparée **Mes défis réussis**
  montrant toutes les validations du coureur, même les cartes cédées
  ou perdues. Pour chaque défi : date de première réussite, temps
  réussi, propriétaire actuel, mes périodes de propriété.
- **Carte colorée** uniquement via attribut serveur privé
  `goalMode==='distance' && challengeValidated===true && owner===me`.
  Le catalogue public ou l'invitation cadeau n'affichent jamais le
  badge personnel d'un autre compte.

## Exigences de compatibilité incontournables

- Identité des séances historiques (v1) actuellement calculée par
  `worker/workout-identity.js` sur la **séquence musicale seulement**.
  Pour un défi, il faut un **empreinte versionnée v2** incluant au moins
  morceaux, ordre, kilométrage total, distances/PPM des phases et durée
  exacte de playlist, afin que 5 km/20 min et 5 km/25 min ne se
  confondent pas. Conserver les vieux liens et alias, aucune
  re-dédoublonnage destructif des cartes historiques.
- `worker/index.js` valide encore les phases en secondes
  `payload.v===1`. Prévoir un schéma v2 explicite `goalMode='distance'`
  et un champ `targetMeters` ; ne pas convertir les mètres en secondes.
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
- Le mobile prépare un résumé local de chronologie musicale et mesures GPS
  plausibles, sans envoyer de trace brute : distance et temps réellement
  mesurés, contrôles des ruptures GPS, lecture continue de la playlist,
  identifiant canonique du défi. Réexaminer les limites iOS/fournisseurs.
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
