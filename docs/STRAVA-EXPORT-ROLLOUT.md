# BeatOnStep → Strava (prototype isolé, non déployé)

## Parcours

Fin de course → Partager → **Envoyer sur Strava**. Au premier export seulement, consentement OAuth via navigateur système. Le Worker crée une activité **manuelle** Strava (`POST /api/v3/activities`) avec la date de début, le temps écoulé (pauses comprises) et la distance uniquement si une source fiable l'a enregistrée. Aucun fichier GPX/FIT, aucun tracé GPS inventé, aucun accès lecture aux activités Strava.

Cette route n'est PAS le flux Garmin Connect → Strava (#155). Si une montre Garmin synchronise déjà la même activité avec Strava, BeatOnStep ne peut pas détecter ce doublon avec le seul scope `activity:write`. Informer les testeurs de ne pas lancer les deux exports.

## Capacité 10 et interface

- Capacité **locale configurée** via `STRAVA_ATHLETE_CAPACITY` (défaut **1**, jusqu'à confirmation que la capacité Strava est effectivement portée à 10).
- Un **unique INSERT SQL conditionnel** plafonne les athlètes distincts en D1 ; 2 callbacks concurrents ne peuvent pas ouvrir le 11e compte. Même athlète reconnecté = pas de nouveau slot.
- `GET /api/strava/status` expose uniquement `used`, `capacity`, `connected`, `canConnect` pour cet appareil. Sur mobile, **bouton désactivé** si `used >= capacity` et que cet appareil n'est pas connecté. Les coureurs déjà connectés peuvent exporter.
- Le compteur D1 est interne à BeatOnStep. Strava reste la **source d'autorité** du quota réellement alloué ; ses connexions préexistantes hors de ce backend ou ses révocations manuelles ne sont pas visibles. Tout refus Strava doit être affiché honnêtement, jamais contourné.
- Toute capacité supérieure à dix exige un **accord effectif** de Strava. Ne jamais relever le paramètre pour contourner leur limite.

## Pré-requis avant une recette de bout en bout

1. Dans https://www.strava.com/settings/api, renseigner le **Authorization Callback Domain** `beatonstep.app` et confirmer la capacité autorisée (1 ou 10). Ne pas copier de tokens dans le dépôt ou la conversation.
2. Exécuter explicitement la migration D1 `migrations/20261013_strava_export.sql` sur l'environnement correct **après validation**. Ne pas relancer les anciennes migrations de cartes.
3. Fournir au Worker Cloudflare les secrets `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_ENCRYPTION_KEY` (**64 caractères hexadécimaux aléatoires / 32 octets AES**), au moyen des secrets Cloudflare. L'ancienne valeur du secret Strava affichée dans une capture doit être remplacée avant activation. Ne jamais utiliser une valeur de capture.
4. Fournir `STRAVA_EXPORT_ENABLED=true` et `STRAVA_ATHLETE_CAPACITY=1` pour le POC, puis `10` seulement après validation du plafond autorisé dans le tableau de bord Strava. Tous les paramètres absents → 503, pas d'export.
5. Vérifier sur un appareil iOS et un Android (auth via Expo WebBrowser, `beatonstep://strava-auth` déjà déclaré), sans test prod automatique.
6. Revue confidentialité/branding Strava et demande de capacité au-delà de 10, avec captures d'écran authentiques.

### Protection des données

Le `client_secret` ne quitte jamais le Worker. Les access/refresh tokens sont chiffrés AES-256-GCM au repos dans D1, la clé hors dépôt. L'app utilise un identifiant d'installation aléatoire, sans compte Strava stocké dans AsyncStorage. L'utilisateur peut déconnecter Strava depuis le menu de partage (révocation distante ; en cas d'échec, conservation pour retenter).

Les publications sont idempotentes pour le couple installation + session datée : une nouvelle requête pour une course déjà publiée retourne son URL ; si l'issue d'un POST Strava est incertaine, **bloquer le retry automatique** pour ne pas fabriquer de doublon. L'utilisateur doit vérifier Strava. Les sessions de course plus anciennes sans horodatages fiables ne peuvent pas être publiées.

### Limites MVP / gates

- Dépendance à l'identifiant d'installation : une **réinstallation** pourrait ne plus avoir accès au couplage précédent ; prévoir un futur rattachement par compte et un mécanisme de nettoyage des connexions orphelines avant généralisation.
- Une révocation faite sur le site Strava n'est pas instantanément reflétée dans le compteur D1 ; prévoir une réconciliation ou un support de suppression.
- Aucun déploiement, migration D1 prod, secret en production, OTA ou build natif effectué par cette PR.
- Tests : `node --test tests/strava-worker.test.mjs`, puis `npm run build` sur le site ; `npx tsc --noEmit` / tests de l'application mobile ; recette iPhone/Android et test réel du quota. La PR peut rester en draft tant que ces validations n'ont pas eu lieu.

## Références

- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/reference/#api-Activities-createActivity
- https://developers.strava.com/docs/rate-limits/
- https://www.strava.com/legal/api
