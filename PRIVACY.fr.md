# Politique de confidentialité — BeatOnStep

**Dernière mise à jour :** 6 octobre 2026

## 1. Qui sommes-nous

BeatOnStep est une application mobile (Android et iOS) qui adapte la musique au rythme de votre allure de marche ou de course. L'application est disponible sur **Google Play** (Android, **BeatOnStep**) et l'**App Store** (iOS, **BeatOnSteps**).

**Éditeur :** Rafael Orset — contact : [forum BeatOnStep](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Principe général : collecte minimale, sans tracking commercial

BeatOnStep **ne crée pas de compte utilisateur**, n'utilise **pas de publicité** et n'effectue **aucun tracking commercial ni profilage**. Une mesure d'usage pseudonyme très limitée peut être envoyée au serveur BeatOnStep pour connaître uniquement le nombre de playlists personnelles importées par source (§ 3.9). Aucune cadence (PPM), donnée de parcours, nom ou identifiant de playlist, titre, artiste ou compte musical n'est inclus dans cette mesure.

Selon les fonctions que **vous** activez, l'application peut échanger des données avec des services que **vous choisissez** (Mix démo / serveur musique, YouTube ou Apple Music si connectés, liens de titres Spotify, liens Partager Deezer, analyse BPM) ou avec des infrastructures techniques (mises à jour). Le détail figure ci-dessous.

## 3. Fonctionnalités et flux de données

### 3.1 Fichiers audio locaux (Musiques téléphone)

- Les fichiers que vous importez restent **sur votre appareil**.
- Les métadonnées associées (chemin, BPM, préférences) sont stockées **localement uniquement**.
- Aucun fichier audio n'est envoyé hors de l'appareil pour la détection de cadence ni la lecture locale, sauf si vous déclenchez l'analyse BPM serveur (§ 3.3).

### 3.2 Détection de cadence (PPM)

- L'accéléromètre est lu **sur l'appareil** pour estimer votre cadence de pas.
- Ces mesures restent **sur l’appareil par défaut** et ne sont pas envoyées automatiquement. Elles peuvent uniquement être incluses dans un rapport de diagnostic si vous choisissez explicitement **Bug / remarque → Envoyer** (§ 3.11).
- Elles servent uniquement au fonctionnement temps réel de l'app (sélection et lecture de musique adaptée à votre rythme).

### 3.3 Mix démo et serveur musique (optionnel)

Le catalogue de démo (278 morceaux libres de droits) est hébergé sur un serveur de l'éditeur (`https://beatonstep.tail09d8d8.ts.net/music`).

- Ce serveur **n'est pas un réseau social** ni un service public : il sert uniquement le catalogue de démo.
- Pas de création de compte, pas de cookie publicitaire, pas de télémétrie marketing.
- Si vous envoyez un fichier audio pour **analyse BPM**, ce fichier transite par le serveur pour traitement ; il n'est pas conservé à des fins de stockage permanent ni revendu.

### 3.4 YouTube (optionnel)

Si vous connectez un compte Google pour utiliser YouTube dans BeatOnStep :

- Fonction **initiée par vous** ; BeatOnStep **ne fournit pas** de catalogue YouTube.
- Connexion Google sécurisée ; l'éditeur ne reçoit **pas** votre mot de passe Google.
- Les **jetons d'accès** sont stockés **localement** sur l'appareil et ne sont **jamais transmis** à l'éditeur ni revendus.
- L'app interroge les **API Google / YouTube** pour afficher **vos** playlists et métadonnées.
- La **lecture** s'effectue dans l'app **YouTube** ou **YouTube Music** (au choix dans Réglages) — pas dans BeatOnStep.
- Vous pouvez **déconnecter** YouTube dans l'app à tout moment : les jetons locaux sont effacés.
- Le traitement de votre compte Google reste régi par les politiques de **Google**.

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

Cette mesure ne contient **aucun nom ni identifiant de playlist**, aucun titre, artiste, token OAuth, compte musical, donnée audio, cadence (PPM) ou parcours. Les imports manuels de morceaux et les playlists/albums curatés fournis par BeatOnStep sont exclus du compteur.

L'identifiant est généré aléatoirement par BeatOnStep. Il n'est pas l'identifiant Apple, Google, Android ou d'un fournisseur musical et ne contient ni nom, ni adresse e-mail, ni identifiant de compte. Il permet uniquement de rattacher les snapshots successifs à une **même installation de BeatOnStep** et n'est pas utilisé pour identifier la personne qui utilise l'app.

Les suppressions sont prises en compte : le snapshot suivant reflète le nombre de playlists encore présentes dans l'app. L'envoi est limité à au plus une fois par jour après un changement et, si rien ne change, à un rappel au plus une fois tous les 7 jours pour mesurer les installations actives.

Le serveur conserve seulement le **dernier snapshot connu par installation** afin de produire des statistiques cumulées depuis le début de cette mesure ; il ne conserve pas l'historique détaillé de chaque envoi. L'adresse IP peut être traitée techniquement pendant la connexion HTTPS mais n'est pas enregistrée dans le fichier de mesure.

Ces données ne sont **ni vendues, ni utilisées pour la publicité, ni utilisées pour le suivi publicitaire (« tracking »), ni croisées avec des données provenant d'autres entreprises à des fins de profilage**.

### 3.10 Garmin et forme du parcours (optionnel)

Si vous utilisez une montre Garmin compatible avec BeatOnStep :

- la montre utilise son GPS dans le cadre de l'activité Garmin enregistrée et peut transmettre temporairement à l'app BeatOnStep les positions nécessaires au récapitulatif ;
- les coordonnées GPS brutes restent **uniquement en mémoire pendant la course** : BeatOnStep ne les persiste pas dans son stockage local et ne les envoie pas au serveur BeatOnStep ;
- à la fin de la course, BeatOnStep peut conserver localement une **forme relative simplifiée** du parcours (un petit tracé sans latitude, longitude ni fond de carte) pour le récapitulatif et les visuels de partage ;
- si vous partagez une story BeatOnStep, seule cette forme relative non géographique peut être incluse dans le visuel ou son brouillon ; les coordonnées GPS brutes ne sont jamais incluses dans l'URL de partage.

### 3.11 Rapport Bug / remarque / diagnostic volontaire

Si vous utilisez le bouton **Bug / remarque** dans Réglages, BeatOnStep affiche un champ de message et demande une action explicite avant tout envoi. Si vous choisissez **Envoyer**, l'app transmet au serveur BeatOnStep le même rapport technique que celui que vous pouvez partager manuellement en touchant la version de l'application, avec le message que vous avez saisi.

Ce rapport peut inclure :

- version, build, runtime et informations techniques de l'application ;
- événements de diagnostic récents liés au fonctionnement de BeatOnStep ;
- diagnostic PPM des dernières minutes, pouvant contenir des échantillons d'accéléromètre et la cadence calculée ;
- états techniques Garmin / Apple Watch et des intégrations musicales (par exemple disponibilité, états de lecture, erreurs et identifiants techniques de titres ou d'appareils lorsqu'ils figurent déjà dans le diagnostic) ;
- l'identifiant d'installation pseudonyme BeatOnStep, la plateforme et la version de l'app.

L'envoi est **strictement déclenché par l'utilisateur** : aucun rapport Bug / remarque n'est transmis automatiquement. Aucun mot de passe, token OAuth ni fichier musical n'est inclus.

Le serveur utilise ce rapport uniquement pour le **support technique et le diagnostic d'incidents**. Les petits rapports peuvent être inclus directement dans l'e-mail de support ; les rapports plus volumineux peuvent être joints sous forme de fichier texte. L'adresse e-mail privée du destinataire du support reste configurée côté serveur et n'est pas exposée dans l'app.

## 4. Permissions demandées

### Android

| Permission | Raison |
|------------|--------|
| `HIGH_SAMPLING_RATE_SENSORS` | Lecture de l'accéléromètre à haute fréquence pour détecter la cadence de pas (PPM). |
| `FOREGROUND_SERVICE` | Maintenir la lecture musicale et la détection de cadence en arrière-plan (téléphone verrouillé). |
| `WAKE_LOCK` | Limiter la mise en veille du capteur pendant une session. |

### iOS (App Store)

BeatOnStep demande uniquement l'accès aux **capteurs de mouvement** (accéléromètre) pour la détection de cadence. Sur iOS, cet accès est géré par le framework natif sans permission explicite demandée à l'utilisateur.

L'accès à la **médiathèque** (Musiques téléphone) déclenche une demande de permission système standard lorsque vous importez de la musique depuis votre appareil.

L'app mobile BeatOnStep ne demande **aucune permission de localisation GPS du téléphone**. Si vous utilisez l'app Garmin BeatOnStep, la montre peut utiliser sa propre permission de positionnement pour enregistrer l'activité et fournir le tracé relatif décrit au § 3.10. BeatOnStep n'accède pas à vos contacts, votre appareil photo ou votre microphone.

## 5. Données stockées localement

Sur votre appareil, dans l'espace privé de l'app :

- Bibliothèque importée (chemins, BPM, sources activées).
- Préférences (mode, plages cibles, réglages, langue).
- Jetons de connexion YouTube et Apple Music (si connectés).
- Titres Spotify dont vous avez collé le lien (identifiant, titre, BPM saisi ou détecté) — **pas** de jeton de compte Spotify dans cette version.
- Titres Deezer dont vous avez collé le lien Partager (identifiant, titre, BPM saisi ou détecté) — **pas** de jeton de compte Deezer dans cette version.
- Identifiant d'installation aléatoire BeatOnStep et dernier état local de la mesure de playlists (§ 3.9).
- Forme relative simplifiée du dernier parcours Garmin utilisée pour le récapitulatif/story, lorsqu'elle est disponible (§ 3.10) — **sans coordonnées GPS brutes**.

La **désinstallation** de l'application supprime ces données. La déconnexion d'un service (YouTube, Apple Music) efface les jetons correspondants sans désinstaller l'app.

## 6. Services tiers

| Service | Quand | Ce qui transite |
|---------|-------|-----------------|
| **Google / YouTube** | Si vous connectez YouTube | Connexion Google ; requêtes API playlists / métadonnées |
| **Apple / Apple Music** | Si vous connectez Apple Music | Connexion Apple ; métadonnées playlists |
| **Apple (App Store)** | Distribution iOS | Gestion par Apple selon ses propres règles |
| **Expo** | Automatique | Vérification / téléchargement de mises à jour OTA |
| **Serveur BeatOnStep** | Catalogue / analyse BPM, mesure pseudonyme d'usage et support volontaire | Liste de titres ; éventuel fichier audio pour analyse BPM ; compteurs de playlists par source + identifiant d'installation aléatoire (§ 3.9) ; rapport technique Help uniquement après confirmation explicite (§ 3.11) |
| **Spotify** | Si vous collez des liens de morceaux | Requête oEmbed (titre) ; ouverture du titre dans l'app Spotify. Pas de connexion compte dans cette version |
| **Deezer** | Si vous collez un lien Partager (morceau ou playlist publique) | Requête catalogue public (titre, durée, parfois BPM) ; ouverture du titre dans l'app Deezer. Pas de connexion compte dans cette version |
| **Garmin Connect IQ** | Si vous associez une montre Garmin et utilisez BeatOnStep pendant une course | Cadence et métriques de course ; positions GPS brutes transitoires montre → téléphone uniquement pour produire localement une forme relative du parcours (§ 3.10) |

Pas de SDK publicitaire, pas de mesure d'audience marketing, pas de réseau social intégré autre que la connexion aux services que vous choisissez.

## 7. Enfants

L'application n'est pas destinée aux enfants de moins de 13 ans (16 ans dans l'UE) et ne collecte sciemment aucune donnée les concernant.

## 8. Vos choix et droits (RGPD / vie privée)

BeatOnStep n'utilise aucun suivi publicitaire et ne propose donc aucun réglage de consentement publicitaire. Vous pouvez gérer les données locales directement dans l'app, déconnecter les services musicaux concernés ou désinstaller l'app, ce qui arrête les futurs envois de la mesure pseudonyme décrite au § 3.9.

La mesure serveur ne contient ni nom, ni e-mail, ni compte BeatOnStep permettant à l'éditeur de rattacher spontanément un snapshot à votre identité. Pour toute question relative à cette mesure ou à vos droits, utilisez le forum BeatOnStep indiqué ci-dessous.

- **Données locales** (bibliothèque, réglages, jetons) : vous les contrôlez directement dans l'app ou via la désinstallation.
- **Compte Google / YouTube** : exercez vos droits auprès de Google selon leurs procédures.
- **Compte Apple / Apple Music** : exercez vos droits auprès d'Apple selon leurs procédures.
- **Spotify** : pas de compte BeatOnStep lié à Spotify ; les liens collés restent sur l'appareil. Pour votre compte Spotify, exercez vos droits auprès de Spotify.
- **Deezer** : pas de compte BeatOnStep lié à Deezer ; les liens collés restent sur l'appareil. Pour votre compte Deezer, exercez vos droits auprès de Deezer.
- **Serveur BeatOnStep** : pas de compte utilisateur. La mesure pseudonyme conserve uniquement le dernier état connu par installation, sans historique détaillé des envois. Les rapports Bug / remarque sont envoyés uniquement à votre demande pour le support technique (§ 3.11) ; pour toute question relative à ces données, utilisez le [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Modifications

Cette politique peut être mise à jour. La date en haut du document reflète la dernière révision. La version en vigueur est disponible à l'adresse communiquée sur la fiche **Google Play** et dans l'app (*Réglages → À propos*) :

**https://rafa-create.github.io/beatonstep-website/privacy.html**

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
