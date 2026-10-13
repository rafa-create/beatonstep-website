# #450 — Défis sportifs, option A, course autonome, montre de bonne foi

Décision produit du 13 octobre 2026 : le coureur reste libre de toute
connexion réseau pendant sa course. Les mesures de la montre et du GPS
téléphone sont considérées de bonne foi, sous réserve de contrôles simples
d'incohérences après l'arrivée. **Une absence de pause est normale.**

## Garanties du parcours

- Course ordinaire, libre ou musicale. Aucun mode « défi », démarrage réseau
  ni vérification GPS du serveur pendant la séance.
- Le GPS natif et Garmin continuent de fonctionner sans réseau. Les données
  locales restent utilisables, quel que soit le statut de D1.
- La performance peut être présentée comme « récompense en attente » et
  synchronisée **une seule fois après la fin**, ou lors d'une reconnexion.
  Une connexion absente ne bloque jamais une course.
- Ne jamais exiger de pause, de découpage GPS, de route lat/lon, ni de signature
  Garmin pour **considérer** un résultat. Accepter `garmin_watch_saved`,
  `garmin_mobile_stop`, `garmin_live_recap` et `phone_gps` (sources
  existant dans l'application).
- Pour un résultat en temps « sub », compter le **temps écoulé réel**, pauses
  comprises lorsqu'il y en a. Une course sans pause est normale ; un nombre
  de pauses nul/absent ne constitue pas un motif de refus.
- Sans chronomètre exact au passage du kilomètre, utiliser
  **conservativement** l'heure de fin pour le plus grand palier canonique
  atteint. Ne jamais extrapoler un meilleur temps depuis la distance finale.
- Sur le serveur à la réception finale : identité du compte, anti-rejeu par
  run unique, vitesse moyenne physiquement incohérente, timestamps et
  champs impossibles ; refuser l'attribution douteuse sans effacer la sortie.
  Un serveur ne saurait garantir « GPS infalsifiable » avec une course
  hors ligne ; ne pas prétendre le contraire.
- Au plus une carte sportive par run, exclusivement le plus grand palier
  éligible et son meilleur niveau exact ; les gains/vols sont atomiques
  dans `sport_verified_run_award_v1`.
- Un résultat sportif est indépendant du bouton facultatif « Enregistrer »
  de l'Historique personnel. La synchronisation d'un résultat reste
  indépendante du stockage volontaire du résumé privé.
- Garder `SPORT_AUTO_AWARDS_ENABLED=false` jusqu'aux tests finaux
  et ne jamais ouvrir un endpoint prenant `evidenceVerified=true` comme
  preuve suffisante.

## Code

`worker/sport-offline-eligibility.js` applique la politique d'éligibilité
**sans effectuer d'attribution** ni appel réseau.
`tests/sport-offline-eligibility.test.mjs` protège en particulier
« montre sans pause », « mobile sans réseau » et « pause incluse ».
Le service d'insertion D1 `worker/sport-awards.js` et les triggers
sportifs restent volontairement séparés jusqu'à un parcours de fin de
course, dédoublonnage et éventuelle file locale fiable.
