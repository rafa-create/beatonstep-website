# Politique de confidentialité — BeatOnStep

**Dernière mise à jour :** 25 août 2026

---

*[English version below — Privacy Policy in English](#privacy-policy--beatonstep-english)*

---

## 1. Qui sommes-nous

BeatOnStep est une application mobile (Android et iOS) qui adapte la musique au rythme de votre allure de marche ou de course. L'application est disponible en accès anticipé sur **Google Play** (test interne) et sur **Apple TestFlight**.

**Éditeur :** Rafael Orset — contact : [forum BeatOnStep](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Principe général : pas de collecte éditeur

BeatOnStep **ne crée pas de compte utilisateur**, n'utilise **pas de publicité** et n'intègre **pas d'analytique ou de tracking commercial**. Aucune donnée de cadence (PPM), de parcours, ni de bibliothèque musicale n'est envoyée à l'éditeur à des fins marketing ou de profilage.

Selon les fonctions que **vous** activez, l'application peut échanger des données avec des services tiers que **vous choisissez** (Google / YouTube, Spotify) ou avec des infrastructures techniques nécessaires à son fonctionnement (serveur mix, mises à jour). Le détail figure ci-dessous.

## 3. Fonctionnalités et flux de données

### 3.1 Fichiers audio locaux (Musiques téléphone)

- Les fichiers que vous importez restent **sur votre appareil**.
- Les métadonnées associées (chemin, BPM, préférences) sont stockées **localement uniquement**.
- Aucun fichier audio n'est envoyé hors de l'appareil pour la détection de cadence ni la lecture locale, sauf si vous déclenchez l'analyse BPM serveur (§ 3.3).

### 3.2 Détection de cadence (PPM)

- L'accéléromètre est lu **sur l'appareil** pour estimer votre cadence de pas.
- Ces mesures **ne sont pas transmises** à l'éditeur ni à un serveur BeatOnStep.
- Elles servent uniquement au fonctionnement temps réel de l'app (sélection et lecture de musique adaptée à votre rythme).

### 3.3 Mix inclus et serveur musique (optionnel)

Le catalogue de démo (77 morceaux libres de droits) est hébergé sur un serveur de l'éditeur (`https://beatonstep.tail09d8d8.ts.net/music`).

- Ce serveur **n'est pas un réseau social** ni un service public : il sert uniquement le catalogue de démo.
- Pas de création de compte, pas de cookie publicitaire, pas de télémétrie marketing.
- Si vous envoyez un fichier audio pour **analyse BPM**, ce fichier transite par le serveur pour traitement ; il n'est pas conservé à des fins de stockage permanent ni revendu.

### 3.4 YouTube Music (optionnel)

Si vous connectez un compte Google pour utiliser YouTube Music dans BeatOnStep :

- L'app utilise **OAuth 2.0 (PKCE)** avec un Client ID Android public ; **aucun secret client** n'est embarqué dans l'application.
- Les **jetons d'accès / rafraîchissement** sont stockés **localement** sur l'appareil (espace privé de l'app) et ne sont jamais envoyés à l'éditeur.
- L'app interroge les **API Google / YouTube Data** (playlists, métadonnées) uniquement pour afficher et proposer de la musique.
- La lecture s'effectue via l'écosystème YouTube ; BeatOnStep ne reçoit pas votre mot de passe Google.
- Vous pouvez **déconnecter** YouTube dans l'app à tout moment : les jetons locaux sont alors effacés.
- Le traitement de votre compte Google est aussi régi par les politiques de **Google** ; BeatOnStep n'est pas l'éditeur de YouTube.

### 3.5 Spotify (bêta limitée, optionnel)

Spotify peut être proposé en accès très limité (quelques comptes ajoutés manuellement par l'éditeur, via OAuth Spotify). Le fonctionnement est analogue à YouTube Music : authentification OAuth, stockage local des jetons, pas de transmission à l'éditeur.

### 3.6 Mises à jour (Expo OTA)

L'app peut contacter les services **Expo** pour vérifier et télécharger des mises à jour JavaScript liées à votre installation. Il ne s'agit pas d'un SDK publicitaire ; aucune donnée de cadence ni de bibliothèque musicale n'est envoyée via ce canal.

## 4. Permissions demandées

### Android

| Permission | Raison |
|------------|--------|
| `HIGH_SAMPLING_RATE_SENSORS` | Lecture de l'accéléromètre à haute fréquence pour détecter la cadence de pas (PPM). |
| `FOREGROUND_SERVICE` | Maintenir la lecture musicale et la détection de cadence en arrière-plan (téléphone verrouillé). |
| `WAKE_LOCK` | Limiter la mise en veille du capteur pendant une session. |

### iOS (TestFlight)

BeatOnStep demande uniquement l'accès aux **capteurs de mouvement** (accéléromètre) pour la détection de cadence. Sur iOS, cet accès est géré par le framework natif sans permission explicite demandée à l'utilisateur.

L'accès à la **médiathèque** (Musiques téléphone) déclenche une demande de permission système standard lorsque vous importez de la musique depuis votre appareil.

**Aucune permission** n'accède à votre position GPS, vos contacts, votre appareil photo ou votre microphone.

## 5. Données stockées localement

Sur votre appareil, dans l'espace privé de l'app :

- Bibliothèque importée (chemins, BPM, sources activées).
- Préférences (mode, plages cibles, réglages, langue).
- Jetons OAuth YouTube / Spotify (si connecté).

La **désinstallation** de l'application supprime ces données. La déconnexion d'un service (YouTube, Spotify) efface les jetons correspondants sans désinstaller l'app.

## 6. Services tiers

| Service | Quand | Ce qui transite |
|---------|-------|-----------------|
| **Google / YouTube** | Si vous connectez YouTube Music | Authentification OAuth ; requêtes API playlists / métadonnées |
| **Apple (TestFlight)** | Distribution iOS en accès anticipé | Gestion de la version bêta par Apple selon ses propres règles |
| **Expo** | Automatique | Vérification / téléchargement de mises à jour OTA |
| **Serveur mix BeatOnStep** | Si vous utilisez le catalogue ou l'analyse BPM | Liste de titres ; éventuel fichier audio pour analyse BPM |
| **Spotify** | Si activé en bêta | Authentification OAuth ; métadonnées playlists |

Pas de SDK publicitaire, pas de mesure d'audience marketing, pas de réseau social intégré autre que le parcours OAuth que vous déclenchez.

## 7. Enfants

L'application n'est pas destinée aux enfants de moins de 13 ans (16 ans dans l'UE) et ne collecte sciemment aucune donnée les concernant.

## 8. Vos droits (RGPD / vie privée)

- **Données locales** (bibliothèque, réglages, jetons) : vous les contrôlez directement dans l'app ou via la désinstallation.
- **Compte Google / YouTube** : exercez vos droits auprès de Google selon leurs procédures.
- **Compte Spotify** : exercez vos droits auprès de Spotify.
- **Serveur musique** : pas de compte utilisateur BeatOnStep ; pour toute question, utilisez le [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Modifications

Cette politique peut être mise à jour. La date en haut du document reflète la dernière révision. La version en vigueur est disponible à l'adresse communiquée sur la fiche **Google Play** et dans l'app (*Réglages → À propos*) :

**https://rafa-create.github.io/beatonstep-website/privacy.html**

## 10. Contact

- **Éditeur :** Rafael Orset
- **Forum :** [github.com/rafa-create/beatonstep-website/discussions/1](https://github.com/rafa-create/beatonstep-website/discussions/1)

---

## 11. Crédits musicaux (catalogue mix inclus)

Le catalogue « Mix inclus » est composé exclusivement de morceaux libres de droits sous licence **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))** (usage commercial autorisé **avec attribution**).

**Artistes (sources) :**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)
- **Scott Buckley** — [scottbuckley.com.au](https://www.scottbuckley.com.au/library/)
- **Alexander Nakarada** — [creatorchords.com](https://creatorchords.com/)

Les BPM sont mesurés côté serveur (`librosa.beat.beat_track`, seuil de confiance ≥ 0,77). Ils peuvent différer légèrement des BPM publiés par les auteurs.

**Liste complète des titres (obligatoire pour l’attribution CC-BY) :**  
[Crédits musicaux — Mix inclus](https://rafa-create.github.io/beatonstep-website/music-credits.html)

---
---

# Privacy Policy — BeatOnStep (English)

**Last updated:** August 25, 2026

*The official binding version of this policy is in French (above). This English translation is provided for convenience.*

## 1. Who we are

BeatOnStep is a mobile app (Android and iOS) that adapts music to your walking or running cadence. The app is available in early access on **Google Play** (internal test) and **Apple TestFlight**.

**Publisher:** Rafael Orset — contact: [BeatOnStep forum](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Core principle: no publisher-side data collection

BeatOnStep **does not create user accounts**, uses **no advertising**, and includes **no commercial analytics or tracking**. No cadence data (SPM), route data, or music library data is sent to the publisher for marketing or profiling purposes.

Depending on the features **you** enable, the app may exchange data with third-party services **you choose** (Google / YouTube, Spotify) or with technical infrastructure required for its operation (mix server, updates). Details below.

## 3. Features and data flows

### 3.1 Local audio files (Phone music)

- Files you import stay **on your device**.
- Associated metadata (path, BPM, preferences) is stored **locally only**.
- No audio file is sent off-device for cadence detection or local playback, unless you trigger server-side BPM analysis (§ 3.3).

### 3.2 Cadence detection (SPM)

- The accelerometer is read **on-device** to estimate your step cadence.
- These readings are **not transmitted** to the publisher or any BeatOnStep server.
- They are used solely for real-time app operation (selecting and playing music matched to your pace).

### 3.3 Included mix and music server (optional)

The demo catalogue (77 royalty-free tracks) is hosted on a publisher server (`https://beatonstep.tail09d8d8.ts.net/music`).

- This server is **not a social network** or public service: it serves only the demo catalogue.
- No account creation, no advertising cookies, no marketing telemetry.
- If you send an audio file for **BPM analysis**, it transits through the server for processing; it is not retained permanently or resold.

### 3.4 YouTube Music (optional)

If you connect a Google account to use YouTube Music in BeatOnStep:

- The app uses **OAuth 2.0 (PKCE)** with a public Android Client ID; **no client secret** is embedded in the app.
- **Access / refresh tokens** are stored **locally** on your device (app private storage) and are never sent to the publisher.
- The app queries **Google / YouTube Data APIs** (playlists, metadata) solely to display and suggest music.
- Playback is handled via the YouTube ecosystem; BeatOnStep does not receive your Google password.
- You can **disconnect** YouTube in the app at any time: local tokens are then deleted.
- Your Google account is also governed by **Google's** own policies; BeatOnStep is not the publisher of YouTube.

### 3.5 Spotify (limited beta, optional)

Spotify may be offered in very limited access (a small number of accounts added manually by the publisher, via Spotify OAuth). The mechanism is the same as YouTube Music: OAuth authentication, local token storage, no transmission to the publisher.

### 3.6 Updates (Expo OTA)

The app may contact **Expo** services to check for and download JavaScript updates linked to your installation. This is not an advertising SDK; no cadence or music library data is sent through this channel.

## 4. Permissions

### Android

| Permission | Purpose |
|------------|---------|
| `HIGH_SAMPLING_RATE_SENSORS` | Read the accelerometer at high frequency to detect step cadence (SPM). |
| `FOREGROUND_SERVICE` | Keep music playback and cadence detection running in the background (locked screen). |
| `WAKE_LOCK` | Prevent the sensor from sleeping during a session. |

### iOS (TestFlight)

BeatOnStep requests access only to **motion sensors** (accelerometer) for cadence detection. On iOS, this is handled by the native framework without an explicit user-facing permission prompt.

Access to the **media library** (Phone music) triggers a standard system permission request when you import music from your device.

**No permission** accesses your GPS location, contacts, camera, or microphone.

## 5. Locally stored data

On your device, in the app's private storage:

- Imported library (paths, BPM, enabled sources).
- Preferences (mode, target ranges, settings, language).
- YouTube / Spotify OAuth tokens (if connected).

**Uninstalling** the app removes this data. Disconnecting a service (YouTube, Spotify) deletes the corresponding tokens without uninstalling the app.

## 6. Third-party services

| Service | When | What transits |
|---------|------|---------------|
| **Google / YouTube** | If you connect YouTube Music | OAuth authentication; playlist / metadata API requests |
| **Apple (TestFlight)** | iOS early-access distribution | Beta version management by Apple under their own terms |
| **Expo** | Automatic | OTA update verification / download |
| **BeatOnStep mix server** | If you use the catalogue or BPM analysis | Track list; optional audio file for BPM analysis |
| **Spotify** | If enabled in beta | OAuth authentication; playlist metadata |

No advertising SDK, no marketing audience measurement, no integrated social network beyond the OAuth flow you initiate.

## 7. Children

The app is not directed at children under 13 (16 in the EU) and does not knowingly collect data from them.

## 8. Your rights (GDPR / privacy)

- **Local data** (library, settings, tokens): you control it directly in the app or by uninstalling.
- **Google / YouTube account**: exercise your rights with Google under their procedures.
- **Spotify account**: exercise your rights with Spotify.
- **Music server**: no BeatOnStep user account; for any question, use the [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Changes

This policy may be updated. The date at the top reflects the latest revision. The current version is available at the address listed on **Google Play** and in the app (*Settings → About*):

**https://rafa-create.github.io/beatonstep-website/privacy.html**

## 10. Contact

- **Publisher:** Rafael Orset
- **Forum:** [github.com/rafa-create/beatonstep-website/discussions/1](https://github.com/rafa-create/beatonstep-website/discussions/1)

---

## 11. Music credits (included mix catalogue)

The « Included mix » catalogue consists exclusively of royalty-free tracks licensed under **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))** (commercial use allowed **with attribution**).

**Artists (sources):**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)
- **Scott Buckley** — [scottbuckley.com.au](https://www.scottbuckley.com.au/library/)
- **Alexander Nakarada** — [creatorchords.com](https://creatorchords.com/)

BPM values are measured on the server (`librosa.beat.beat_track`, confidence ≥ 0.77).

**Full track list (required for CC-BY attribution):**  
[Music credits — Included mix](https://rafa-create.github.io/beatonstep-website/music-credits.html)
