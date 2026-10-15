# Politique de confidentialité — BeatOnStep

**Dernière mise à jour :** 13 octobre 2026

## 1. Qui sommes-nous

BeatOnStep est une application mobile (Android et iOS) qui adapte la musique au rythme de votre allure de marche ou de course. L'application est disponible sur **Google Play** (Android, **BeatOnStep**) et l'**App Store** (iOS, **BeatOnSteps**).

**Éditeur :** Rafael Orset — contact : [forum BeatOnStep](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Principe général : collecte minimale, sans tracking commercial

BeatOnStep est **utilisable sans compte**. Il propose uniquement un **compte facultatif pour signer les partages du catalogue**. Il n'utilise **pas de publicité** et n'effectue **aucun tracking commercial ni profilage**. Une mesure d'usage pseudonyme très limitée peut être envoyée au serveur BeatOnStep pour connaître uniquement le nombre de playlists personnelles importées par source (§ 3.9). Aucune cadence (pas/min), donnée de parcours, nom ou identifiant de playlist, titre, artiste ou compte musical n'est inclus dans cette mesure.

Selon les fonctions que **vous** activez, l'application peut échanger des données avec des services que **vous choisissez** (Mix démo / serveur musique, YouTube ou Apple Music si connectés, liens de titres Spotify, liens Partager Deezer, analyse BPM) ou avec des infrastructures techniques (mises à jour). Le détail figure ci-dessous.

### Comptes facultatifs du catalogue public

Un compte est **facultatif** : créer des séances, courir, importer de la musique et publier anonymement ne demande aucune inscription. Lorsqu'un compte est créé sur le site, BeatOnStep conserve dans Cloudflare D1 l'adresse e-mail (non publique), un pseudo public, un sel et une empreinte de mot de passe, ainsi que la date d'inscription. Le site utilise un cookie de session sécurisé `HttpOnly`; l'app peut garder une autorisation limitée à la publication sous votre pseudo (durée maximale de 30 jours), révocable à la déconnexion.

Votre pseudo et les séances ou Run Mix publiés en étant connecté sont publics. Les anciennes publications anonymes ne sont pas automatiquement attribuées. Il n'y a pas de transmission de vos identifiants de connexion aux services musicaux. Vous pouvez vous déconnecter et supprimer le compte dans « Mon profil » ; la suppression retire les signatures de vos publications qui restent accessibles anonymement, sauf modération. Les sessions et autorisations liées au compte sont révoquées. L'adresse e-mail sert exclusivement à la connexion ; elle n'est pas publiée ni utilisée pour de la prospection. À ce stade, il n'existe pas encore de récupération de mot de passe ni de vérification de l'adresse e-mail : utilisez une adresse que vous contrôlez et conservez votre mot de passe. Ces protections doivent être complétées avant un déploiement à grande échelle.

## 3. Fonctionnalités et flux de données

### 3.1 Fichiers audio locaux (Musiques téléphone)

- Les fichiers que vous importez restent **sur votre appareil**.
- Les métadonnées associées (chemin, BPM, préférences) sont stockées **localement uniquement**.
- Aucun fichier audio n'est envoyé hors de l'appareil pour la détection de cadence ni la lecture locale, sauf si vous déclenchez l'analyse BPM serveur (§ 3.3).

### 3.2 Détection de cadence (pas/min)

- L'accéléromètre est lu **sur l'appareil** pour estimer votre cadence de pas.
- Ces mesures restent **sur l’appareil par défaut** et ne sont pas envoyées automatiquement. Elles peuvent uniquement être incluses dans un rapport de diagnostic si vous choisissez explicitement **Help → Envoyer** (§ 3.11).
- Elles servent uniquement au fonctionnement temps réel de l'app (sélection et lecture de musique adaptée à votre rythme).

### 3.3 Mix démo et serveur musique (optionnel)

Le catalogue de démo (278 morceaux libres de droits) est hébergé sur un serveur de l'éditeur (`https://beatonstep.tail09d8d8.ts.net/music`).

- Ce serveur **n'est pas un réseau social** ni un service public : il sert uniquement le catalogue de démo.
- Pas de création de compte, pas de cookie publicitaire, pas de télémétrie marketing.
- Si vous envoyez un fichier audio pour **analyse BPM**, ce fichier transite par le serveur pour traitement ; il n'est pas conservé à des fins de stockage permanent ni revendu.

### 3.4 YouTube (optionnel)

La connexion à Google/YouTube est facultative et distincte du compte facultatif du catalogue BeatOnStep. Sans connexion Google, BeatOnStep n'accède pas aux données de votre compte YouTube.

- **Données consultées et finalité :** avec votre consentement OAuth, BeatOnStep lit votre chaîne YouTube, vos playlists personnelles (y compris privées si l'API les expose), les morceaux qui les composent et leurs métadonnées disponibles (identifiants, titres, artistes, durées, vignettes). Elles servent à afficher et importer votre bibliothèque, calculer ou modifier localement les BPM, préparer une séance et ouvrir la musique dans YouTube ou YouTube Music. BeatOnStep ne télécharge pas les fichiers audio YouTube.
- **Autorisations :** `youtube.readonly` est utilisé pour la lecture et l'import. `userinfo.email` sert uniquement à afficher l'adresse du compte Google connecté. Si vous choisissez expressément « Autoriser la création de playlists » dans la bibliothèque, une autorisation d'écriture YouTube distincte peut être demandée pour exporter manuellement une séance vers une nouvelle playlist privée. Aucun ajout ou changement de playlist sur votre compte YouTube n'est effectué automatiquement lors d'une course.
- **Mesures de protection :** la connexion OAuth utilise PKCE et les échanges avec les API Google se font via HTTPS. BeatOnStep ne demande ni ne conserve votre mot de passe Google. Les jetons d'accès et de renouvellement sont enregistrés dans l'espace de stockage privé de l'application sur l'appareil (stockage applicatif AsyncStorage, sans prétendre à un coffre-fort matériel dédié). Les appels Google du parcours normal partent directement de l'application ; les jetons ne sont pas envoyés au serveur BeatOnStep pour l'import ou la lecture.
- **Partage limité :** les playlists, leurs noms, leurs identifiants et les BPM importés ne sont pas publiés dans le catalogue BeatOnStep et ne sont ni vendus ni utilisés pour la publicité. Le serveur peut recevoir uniquement un compteur pseudonyme du nombre de playlists importées, sans identifiant Google ni détail de morceaux (§ 3.9). Un rapport technique volontaire peut inclure des identifiants de titres, jamais des jetons OAuth (§ 3.11).
- **Conservation :** les jetons sont conservés localement tant que YouTube reste connecté (et renouvelés si nécessaire), puis effacés lors de la déconnexion ; la désinstallation efface les données locales de l'app. Les métadonnées et BPM déjà importés restent dans la bibliothèque locale jusqu'à leur suppression dans l'app ou sa désinstallation ; se déconnecter ne supprime pas automatiquement les morceaux importés. Aucune copie permanente de cette bibliothèque Google n'est conservée sur le serveur BeatOnStep.
- **Suppression et retrait du consentement :** vous pouvez déconnecter YouTube dans BeatOnStep, supprimer les playlists/morceaux importés de votre bibliothèque et révoquer l'autorisation accordée à BeatOnStep depuis [votre compte Google](https://myaccount.google.com/connections). La révocation empêche les accès futurs mais ne supprime pas à elle seule les imports locaux. Pour les données de votre compte YouTube conservées par Google, les règles et contrôles Google s'appliquent.

**Protection des données Google/YouTube (précisions) :** les permissions sont demandées uniquement lorsque vous connectez YouTube ou choisissez volontairement la création de playlists. L'autorisation de lecture ne permet pas à BeatOnStep de créer une playlist ; cette action nécessite un consentement supplémentaire distinct. Le flux OAuth utilise PKCE (méthode S256) et les échanges Google utilisent HTTPS. L'app ne reçoit jamais votre mot de passe Google. Les jetons sont conservés dans le stockage applicatif privé de l'appareil (AsyncStorage) : **il ne s'agit pas d'un coffre-fort matériel ni d'une promesse de chiffrement dédié**. Ils ne sont pas transmis au serveur BeatOnStep pour la bibliothèque YouTube, ne sont pas ajoutés aux rapports de diagnostic et sont supprimés de la session locale lors de la déconnexion. Les noms/identifiants des playlists importées restent locaux, sauf action explicite de partage autorisée par l'utilisateur (§ 3.4, § 3.11). Vous pouvez aussi révoquer l'accès depuis votre compte Google. Les données Google ne sont utilisées ni pour la publicité ni pour l'entraînement de modèles IA.

### 3.5 Apple Music (optionnel)

Si vous connectez un compte Apple pour utiliser Apple Music dans BeatOnStep :

- Fonction **initiée par vous** ; BeatOnStep **ne fournit pas** de catalogue Apple Music.
- Connexion Apple sécurisée ; l'éditeur ne reçoit **pas** votre mot de passe Apple.
- Les **jetons d'accès** sont stockés **localement** sur l'appareil et ne sont **jamais transmis** à l'éditeur ni revendus.
- L'app interroge les services **Apple** pour afficher **vos** playlists et métadonnées (titres, artistes, BPM saisis ou détectés).
- Aucun fichier audio n'est mis en cache par BeatOnStep ; la **lecture** s'effectue dans l'app **Apple Music** — pas dans BeatOnStep.
- Un **abonnement Apple Music** actif est requis pour écouter le catalogue via Apple.
- Vous pouvez **déconnecter** Apple Music dans l'app à tout moment : les jetons locaux sont effacés.
- Le traitement de votre compte Apple reste régi par les politiques d'**Apple**.

**iPhone :** lecture automatique dans Apple Music ; la musique peut continuer en arrière-plan pendant BeatOnStep.

**Android :** l'app Apple Music ([Google Play](https://play.google.com/store/apps/details?id=com.apple.android.music)) doit être installée ; BeatOnStep ouvre le morceau dans cette app (pas de lecteur intégré BeatOnStep).

### 3.6 Spotify (optionnel — liens de titres / playlists publiques)

Si vous importez des titres Spotify dans BeatOnStep :

- Fonction **initiée par vous** : vous collez des liens de **morceaux** (`open.spotify.com/track/…` ou `spotify:track:…`) et/ou une URL de **playlist publique** (`open.spotify.com/playlist/…`). BeatOnStep **ne se connecte pas** à votre compte Spotify dans cette version (pas d’OAuth).
- Pour une playlist publique, l’app peut lire la liste des titres exposée par la **page embed publique** Spotify (identifiants de morceaux, titre, artiste, durée). Aucun mot de passe Spotify n’est demandé ni transmis à l’éditeur.
- Une playlist **privée** ne peut pas être lue. BeatOnStep **n’importe pas** vos playlists privées.
- Pour un morceau seul, l’app peut interroger le service **oEmbed** public de Spotify pour afficher le titre.
- Les identifiants de titres et métadonnées restent **sur l’appareil**.
- La **lecture** s’effectue dans l’app **Spotify** — pas dans BeatOnStep. Un compte Spotify (et, selon les titres, un abonnement) peut être requis par Spotify.
- BeatOnStep **ne fournit pas** le catalogue Spotify.

### 3.7 Deezer (optionnel — liens Partager)

Si vous importez des titres Deezer dans BeatOnStep :

- Fonction **initiée par vous** : vous collez le lien **Partager** Deezer (`link.deezer.com`, un morceau `deezer.com/track/…`, ou une playlist **publique**). BeatOnStep **ne se connecte pas** à votre compte Deezer dans cette version.
- L'app peut interroger le **catalogue public** Deezer (titre, durée, parfois BPM). Aucun mot de passe Deezer n'est demandé ni transmis à l'éditeur.
- Une playlist **privée** ne peut pas être lue. BeatOnStep **n'importe pas** vos playlists privées.
- Les identifiants de titres et métadonnées restent **sur l'appareil**.
- La **lecture** s'effectue dans l'app **Deezer** — pas dans BeatOnStep. Un compte Deezer (et, selon les titres, un abonnement) peut être requis par Deezer.
- BeatOnStep **ne fournit pas** le catalogue Deezer.

### 3.8 Mises à jour (Expo OTA)

L'app peut contacter les services **Expo** pour vérifier et télécharger des mises à jour JavaScript liées à votre installation. Il ne s'agit pas d'un SDK publicitaire ; aucune donnée de cadence ni de bibliothèque musicale n'est envoyée via ce canal.

### 3.9 Mesure pseudonyme du nombre de playlists importées

Pour évaluer l'usage de la fonction d'import et améliorer le produit, BeatOnStep peut envoyer occasionnellement au serveur de l'éditeur un **snapshot minimal** comprenant :

- un identifiant d'installation aléatoire propre à BeatOnStep ;
- la plateforme (iOS / Android) et la version de l'app ;
- le **nombre** de playlists personnelles encore importées pour Apple Music, YouTube, Spotify et Deezer.

Cette mesure correspond à de l'**analytics produit** : elle sert à comprendre l'utilisation de la fonction d'import et à orienter les améliorations de BeatOnStep.

Cette mesure ne contient **aucun nom ni identifiant de playlist**, aucun titre, artiste, token OAuth, compte musical, donnée audio, cadence (pas/min) ou parcours. Les imports manuels de morceaux et les playlists/albums curatés fournis par BeatOnStep sont exclus du compteur.

L'identifiant est généré aléatoirement par BeatOnStep. Il n'est pas l'identifiant Apple, Google, Android ou d'un fournisseur musical et ne contient ni nom, ni adresse e-mail, ni identifiant de compte. Il permet uniquement de rattacher les snapshots successifs à une **même installation de BeatOnStep** et n'est pas utilisé pour identifier la personne qui utilise l'app.

Les suppressions sont prises en compte : le snapshot suivant reflète le nombre de playlists encore présentes dans l'app. L'envoi est limité à au plus une fois par jour après un changement et, si rien ne change, à un rappel au plus une fois tous les 7 jours pour mesurer les installations actives.

Le serveur conserve seulement le **dernier snapshot connu par installation** afin de produire des statistiques cumulées depuis le début de cette mesure ; il ne conserve pas l'historique détaillé de chaque envoi. L'adresse IP peut être traitée techniquement pendant la connexion HTTPS mais n'est pas enregistrée dans le fichier de mesure.

Ces données ne sont **ni vendues, ni utilisées pour la publicité, ni utilisées pour le suivi publicitaire (« tracking »), ni croisées avec des données provenant d'autres entreprises à des fins de profilage**.

### 3.10 GPS Garmin et mesure de distance sur iPhone (optionnels)

**Montre Garmin.** Si vous utilisez une montre Garmin compatible avec BeatOnStep :

- la montre utilise son GPS dans le cadre de l'activité Garmin enregistrée et peut transmettre temporairement à l'app BeatOnStep les positions nécessaires au récapitulatif ;
- les coordonnées GPS brutes restent **uniquement en mémoire pendant la course** : BeatOnStep ne les persiste pas dans son stockage local et ne les envoie pas au serveur BeatOnStep ;
- à la fin de la course, BeatOnStep peut conserver localement une **forme relative simplifiée** du parcours (sans latitude, longitude ni fond de carte) pour le récapitulatif et les visuels de partage ;
- si vous partagez une story BeatOnStep, seule cette forme relative non géographique peut être incluse ; aucune coordonnée GPS brute ne figure dans l'URL de partage.

**GPS du téléphone sur iPhone (fonction expérimentale, disponible uniquement dans certains builds).** Dans le panneau de test de distance, si celui-ci est activé dans votre version, vous choisissez explicitement de démarrer le GPS et pouvez l'arrêter ou mettre la mesure en pause. L'app peut alors demander l'autorisation iOS de localisation (pendant l'utilisation et, si vous le choisissez, en arrière-plan pour continuer à mesurer quand l'iPhone est verrouillé). La mesure sert à calculer les mètres et le temps écoulé ; elle ne démarre pas automatiquement à l'ouverture de BeatOnStep. Le parcours kilométrique avec musique n'est pas encore activé dans la course normale.

Le module iOS traite les positions GPS brutes **uniquement en mémoire volatile sur l'iPhone** pendant cette mesure : pas de stockage d'historique de coordonnées, pas d'envoi de ces positions au serveur BeatOnStep ni aux services musicaux. Il calcule localement un cumul de distance et peut fournir une **silhouette relative du parcours**, sans latitude ni longitude, pour un récapitulatif local si la mesure est exploitable. Le suivi s'arrête à la fin du test ou lorsque vous quittez ce panneau ; les positions brutes sont effacées de la session. La désinstallation efface les éventuels récapitulatifs locaux. Sur les versions Android actuelles, ce pilote GPS du téléphone n'est pas disponible.

**Connexion Strava facultative (import et export de courses).** Quand l'intégration est activée par BeatOnStep et que vous connectez volontairement votre compte Strava, le serveur BeatOnStep conserve des jetons OAuth chiffrés associés à une clé d'installation pseudonyme, afin d'accéder aux activités autorisées. Les autorisations demandées sont `activity:write` (export) et `activity:read` (lecture de vos courses visibles par vous selon les autorisations Strava). Un utilisateur disposant d'une ancienne autorisation limitée à l'export devra autoriser explicitement la lecture avant un import ; aucune élévation de droits automatique.

- **Export :** uniquement sur action volontaire ou après enregistrement réussi si le partage automatique a été activé (OFF par défaut). Les mesures disponibles peuvent être envoyées à Strava, **sans coordonnées GPS brutes** dans la version OTA actuelle.
- **Import :** lorsque vous appuyez sur « Importer ma dernière course », BeatOnStep consulte au maximum les 30 dernières activités du compte Strava connecté pour sélectionner une course. Le serveur ne transmet à l'application que son nom, son identifiant d'activité, sa date/heure, son temps, sa distance, son allure et ses fréquences cardiaques si disponibles. **Ni trace GPS, ni coordonnées, ni carte géographique, ni autres activités sociales** ne sont téléchargées ou archivées dans cet import.
- La course choisie est enregistrée uniquement dans votre **historique personnel privé** sur l'appareil, puis peut être synchronisée dans votre compte BeatOnStep si vous êtes connecté. Les autres coureurs ne peuvent pas la consulter ; elle n'attribue pas de carte Défi mondiale.
- Vous pouvez supprimer la course importée depuis votre historique et révoquer l'accès Strava. La déconnexion arrête les accès futurs, mais n'efface pas automatiquement les courses déjà importées ; celles-ci peuvent être supprimées séparément. Tant que l'intégration est désactivée par BeatOnStep, les options Strava sont masquées et aucun import/export n'est possible.

### 3.11 Rapport Help / diagnostic volontaire

Si vous utilisez le bouton **Help** dans Réglages, BeatOnStep affiche une confirmation avant tout envoi. Si vous choisissez **Envoyer**, l'app transmet au serveur BeatOnStep le même rapport technique que celui que vous pouvez partager manuellement en touchant la version de l'application.

Ce rapport peut inclure :

- version, build, runtime et informations techniques de l'application ;
- événements de diagnostic récents liés au fonctionnement de BeatOnStep ;
- diagnostic pas/min des dernières minutes, pouvant contenir des échantillons d'accéléromètre et la cadence calculée ;
- états techniques Garmin / Apple Watch et des intégrations musicales (par exemple disponibilité, états de lecture, erreurs et identifiants techniques de titres ou d'appareils lorsqu'ils figurent déjà dans le diagnostic) ;
- l'identifiant d'installation pseudonyme BeatOnStep, la plateforme et la version de l'app.

L'envoi est **strictement déclenché par l'utilisateur** : aucun rapport Help n'est transmis automatiquement. Aucun mot de passe, token OAuth ni fichier musical n'est inclus.

Le serveur utilise ce rapport uniquement pour le **support technique et le diagnostic d'incidents**. Les petits rapports peuvent être inclus directement dans l'e-mail de support ; les rapports plus volumineux peuvent être joints sous forme de fichier texte. L'adresse e-mail privée du destinataire du support reste configurée côté serveur et n'est pas exposée dans l'app.

## 4. Permissions demandées

### Android

| Permission | Raison |
|------------|--------|
| `HIGH_SAMPLING_RATE_SENSORS` | Lecture de l'accéléromètre à haute fréquence pour détecter la cadence de pas (pas/min). |
| `FOREGROUND_SERVICE` | Maintenir la lecture musicale et la détection de cadence en arrière-plan (téléphone verrouillé). |
| `WAKE_LOCK` | Limiter la mise en veille du capteur pendant une session. |

### iOS (App Store)

Sur iOS, la **détection de cadence** utilise les capteurs de mouvement (accéléromètre), via le framework natif sans demande de permission explicite pour cette lecture.

L'accès à la **médiathèque** (Musiques téléphone) déclenche une demande de permission système standard lorsque vous importez de la musique depuis votre appareil.

Dans les builds iPhone qui incluent le **pilote GPS expérimental**, iOS peut demander l'autorisation de localisation **pendant l'utilisation** et, pour le suivi pendant le verrouillage, une autorisation **Toujours / en arrière-plan** si vous la choisissez. La localisation n'est consultée qu'après démarrage volontaire du test (§ 3.10). Le pilote n'est pas actif au lancement de l'app. Sur Android, ce pilote de GPS du téléphone n'est pas disponible dans les versions actuelles. Le GPS d'une montre Garmin relève de ses propres autorisations (§ 3.10). BeatOnStep n'accède pas à vos contacts, votre appareil photo ou votre microphone.

## 5. Données stockées localement

Sur votre appareil, dans l'espace privé de l'app :

- Bibliothèque importée (chemins, BPM, sources activées).
- Préférences (mode, plages cibles, réglages, langue).
- Jetons d'accès et de renouvellement YouTube (si connecté, voir § 3.4) et jetons de connexion Apple Music (si connecté).
- Titres Spotify dont vous avez collé le lien (identifiant, titre, BPM saisi ou détecté) — **pas** de jeton de compte Spotify dans cette version.
- Titres Deezer dont vous avez collé le lien Partager (identifiant, titre, BPM saisi ou détecté) — **pas** de jeton de compte Deezer dans cette version.
- Identifiant d'installation aléatoire BeatOnStep et dernier état local de la mesure de playlists (§ 3.9).
- Forme relative simplifiée d'un parcours Garmin ou du pilote GPS iPhone, lorsqu'elle est disponible pour un récapitulatif local (§ 3.10) — **sans coordonnées GPS brutes**.

La **désinstallation** de l'application supprime ces données. La déconnexion d'un service (YouTube, Apple Music) efface les jetons correspondants sans désinstaller l'app.

## 6. Services tiers

| Service | Quand | Ce qui transite |
|---------|-------|-----------------|
| **Google / YouTube** | Si vous connectez YouTube ou autorisez explicitement l'export | OAuth, requêtes directes playlists / métadonnées ; création facultative d'une playlist privée à votre demande (§ 3.4) |
| **Apple / Apple Music** | Si vous connectez Apple Music | Connexion Apple ; métadonnées playlists |
| **Apple (App Store)** | Distribution iOS | Gestion par Apple selon ses propres règles |
| **Expo** | Automatique | Vérification / téléchargement de mises à jour OTA |
| **Serveur BeatOnStep** | Catalogue / analyse BPM, mesure pseudonyme d'usage et support volontaire | Liste de titres ; éventuel fichier audio pour analyse BPM ; compteurs de playlists par source + identifiant d'installation aléatoire (§ 3.9) ; rapport technique Help uniquement après confirmation explicite (§ 3.11) |
| **Spotify** | Si vous collez des liens de morceaux | Requête oEmbed (titre) ; ouverture du titre dans l'app Spotify. Pas de connexion compte dans cette version |
| **Deezer** | Si vous collez un lien Partager (morceau ou playlist publique) | Requête catalogue public (titre, durée, parfois BPM) ; ouverture du titre dans l'app Deezer. Pas de connexion compte dans cette version |
| **Strava (facultatif)** | Si vous connectez votre Strava et choisissez d'importer ou d'exporter une course | Autorisation OAuth, mesures de course ; import dans votre historique privé sans GPS brut, export des mesures sans GPS brut dans cette version (§ 3.10) |
| **Garmin Connect IQ** | Si vous associez une montre Garmin et utilisez BeatOnStep pendant une course | Cadence et métriques de course ; positions GPS brutes transitoires montre → téléphone uniquement pour produire localement une forme relative du parcours (§ 3.10) |

Pas de SDK publicitaire, pas de mesure d'audience marketing, pas de réseau social intégré autre que la connexion aux services que vous choisissez.

## 7. Enfants

L'application n'est pas destinée aux enfants de moins de 13 ans (16 ans dans l'UE) et ne collecte sciemment aucune donnée les concernant.

## 8. Vos choix et droits (RGPD / vie privée)

BeatOnStep n'utilise aucun suivi publicitaire et ne propose donc aucun réglage de consentement publicitaire. Vous pouvez gérer les données locales directement dans l'app, déconnecter les services musicaux concernés ou désinstaller l'app, ce qui arrête les futurs envois de la mesure pseudonyme décrite au § 3.9.

La mesure serveur ne contient ni nom, ni e-mail, ni compte BeatOnStep permettant à l'éditeur de rattacher spontanément un snapshot à votre identité. Pour toute question relative à cette mesure ou à vos droits, utilisez le forum BeatOnStep indiqué ci-dessous.

- **Données locales** (bibliothèque, réglages, jetons) : vous les contrôlez directement dans l'app ou via la désinstallation.
- **Compte Google / YouTube** : déconnectez YouTube pour effacer les jetons locaux, supprimez séparément les titres importés ou désinstallez l'app, et révoquez l'accès dans [votre compte Google](https://myaccount.google.com/connections) (voir § 3.4).
- **Compte Apple / Apple Music** : exercez vos droits auprès d'Apple selon leurs procédures.
- **Spotify** : pas de compte BeatOnStep lié à Spotify ; les liens collés restent sur l'appareil. Pour votre compte Spotify, exercez vos droits auprès de Spotify.
- **Deezer** : pas de compte BeatOnStep lié à Deezer ; les liens collés restent sur l'appareil. Pour votre compte Deezer, exercez vos droits auprès de Deezer.
- **Strava** : déconnectez Strava dans BeatOnStep ou retirez l'autorisation dans Strava → Mes applications ; supprimez séparément les courses importées de votre historique (§ 3.10).
- **Serveur BeatOnStep** : pas de compte utilisateur. La mesure pseudonyme conserve uniquement le dernier état connu par installation, sans historique détaillé des envois. Les rapports Help sont envoyés uniquement à votre demande pour le support technique (§ 3.11) ; pour toute question relative à ces données, utilisez le [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Modifications

Cette politique peut être mise à jour. La date en haut du document reflète la dernière révision. La version en vigueur est disponible à l'adresse communiquée sur la fiche **Google Play** et dans l'app (*Réglages → À propos*) :

**https://beatonstep.app/privacy.html**

## 10. Contact

- **Éditeur :** Rafael Orset
- **Forum :** [github.com/rafa-create/beatonstep-website/discussions/1](https://github.com/rafa-create/beatonstep-website/discussions/1)

---

## 11. Crédits musicaux (catalogue mix démo)

Le catalogue « Mix démo » est composé exclusivement de morceaux libres de droits sous licence **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))** (usage commercial autorisé **avec attribution**).

**Artistes (sources) :**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)
- **Scott Buckley** — [scottbuckley.com.au](https://www.scottbuckley.com.au/library/)

Les BPM sont mesurés côté serveur (`librosa.beat.beat_track`, seuil de confiance ≥ 0,77). Ils peuvent différer légèrement des BPM publiés par les auteurs.

**Liste complète des titres (obligatoire pour l'attribution CC-BY) :**  
[Crédits musicaux — Mix démo](https://rafa-create.github.io/beatonstep-website/music-credits.html)
