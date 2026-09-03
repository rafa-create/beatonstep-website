# Politique de confidentialité — BeatOnStep

**Dernière mise à jour :** 3 septembre 2026

## 1. Qui sommes-nous

BeatOnStep est une application mobile (Android et iOS) qui adapte la musique au rythme de votre allure de marche ou de course. L'application est disponible sur **Google Play** (Android, **BeatOnStep**) et l'**App Store** (iOS, **BeatOnSteps**).

**Éditeur :** Rafael Orset — contact : [forum BeatOnStep](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Principe général : pas de collecte éditeur

BeatOnStep **ne crée pas de compte utilisateur**, n'utilise **pas de publicité** et n'intègre **pas d'analytique ou de tracking commercial**. Aucune donnée de cadence (PPM), de parcours, ni de bibliothèque musicale n'est envoyée à l'éditeur à des fins marketing ou de profilage.

Selon les fonctions que **vous** activez, l'application peut échanger des données avec des services que **vous choisissez** (Mix démo / serveur musique, YouTube ou Apple Music si connectés, liens de titres Spotify, analyse BPM) ou avec des infrastructures techniques (mises à jour). **Deezer n'est pas proposé.** Le détail figure ci-dessous.

## 3. Fonctionnalités et flux de données

### 3.1 Fichiers audio locaux (Musiques téléphone)

- Les fichiers que vous importez restent **sur votre appareil**.
- Les métadonnées associées (chemin, BPM, préférences) sont stockées **localement uniquement**.
- Aucun fichier audio n'est envoyé hors de l'appareil pour la détection de cadence ni la lecture locale, sauf si vous déclenchez l'analyse BPM serveur (§ 3.3).

### 3.2 Détection de cadence (PPM)

- L'accéléromètre est lu **sur l'appareil** pour estimer votre cadence de pas.
- Ces mesures **ne sont pas transmises** à l'éditeur ni à un serveur BeatOnStep.
- Elles servent uniquement au fonctionnement temps réel de l'app (sélection et lecture de musique adaptée à votre rythme).

### 3.3 Mix démo et serveur musique (optionnel)

Le catalogue de démo (181 morceaux libres de droits) est hébergé sur un serveur de l'éditeur (`https://beatonstep.tail09d8d8.ts.net/music`).

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

### 3.6 Spotify (optionnel — liens de titres)

Si vous importez des titres Spotify dans BeatOnStep :

- Fonction **initiée par vous** : vous collez des liens de **morceaux** (`open.spotify.com/track/…` ou `spotify:track:…`). BeatOnStep **n'importe pas vos playlists** Spotify et **ne se connecte pas** à votre compte Spotify dans cette version.
- L'app peut interroger le service **oEmbed** public de Spotify pour afficher le titre. Aucun mot de passe Spotify n'est demandé ni transmis à l'éditeur.
- Les identifiants de titres et métadonnées restent **sur l'appareil**.
- La **lecture** s'effectue dans l'app **Spotify** — pas dans BeatOnStep. Un compte Spotify (et, selon les titres, un abonnement) peut être requis par Spotify.
- BeatOnStep **ne fournit pas** le catalogue Spotify.

### 3.7 Deezer (pas encore proposé)

Deezer **n'est pas proposé** : la plateforme développeur Deezer n'accepte plus de nouvelles applications. Réactivation possible si Deezer rouvre l'accès.

### 3.8 Mises à jour (Expo OTA)

L'app peut contacter les services **Expo** pour vérifier et télécharger des mises à jour JavaScript liées à votre installation. Il ne s'agit pas d'un SDK publicitaire ; aucune donnée de cadence ni de bibliothèque musicale n'est envoyée via ce canal.

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

**Aucune permission** n'accède à votre position GPS, vos contacts, votre appareil photo ou votre microphone.

## 5. Données stockées localement

Sur votre appareil, dans l'espace privé de l'app :

- Bibliothèque importée (chemins, BPM, sources activées).
- Préférences (mode, plages cibles, réglages, langue).
- Jetons de connexion YouTube et Apple Music (si connectés).
- Titres Spotify dont vous avez collé le lien (identifiant, titre, BPM saisi ou détecté) — **pas** de jeton de compte Spotify dans cette version.

La **désinstallation** de l'application supprime ces données. La déconnexion d'un service (YouTube, Apple Music) efface les jetons correspondants sans désinstaller l'app.

## 6. Services tiers

| Service | Quand | Ce qui transite |
|---------|-------|-----------------|
| **Google / YouTube** | Si vous connectez YouTube | Connexion Google ; requêtes API playlists / métadonnées |
| **Apple / Apple Music** | Si vous connectez Apple Music | Connexion Apple ; métadonnées playlists |
| **Apple (App Store)** | Distribution iOS | Gestion par Apple selon ses propres règles |
| **Expo** | Automatique | Vérification / téléchargement de mises à jour OTA |
| **Serveur mix BeatOnStep** | Si vous utilisez le catalogue ou l'analyse BPM | Liste de titres ; éventuel fichier audio pour analyse BPM |
| **Spotify** | Si vous collez des liens de morceaux | Requête oEmbed (titre) ; ouverture du titre dans l'app Spotify. Pas de connexion compte dans cette version |
| **Deezer** | Pas encore proposé | — |

Pas de SDK publicitaire, pas de mesure d'audience marketing, pas de réseau social intégré autre que la connexion aux services que vous choisissez.

## 7. Enfants

L'application n'est pas destinée aux enfants de moins de 13 ans (16 ans dans l'UE) et ne collecte sciemment aucune donnée les concernant.

## 8. Vos droits (RGPD / vie privée)

- **Données locales** (bibliothèque, réglages, jetons) : vous les contrôlez directement dans l'app ou via la désinstallation.
- **Compte Google / YouTube** : exercez vos droits auprès de Google selon leurs procédures.
- **Compte Apple / Apple Music** : exercez vos droits auprès d'Apple selon leurs procédures.
- **Spotify** : pas de compte BeatOnStep lié à Spotify ; les liens collés restent sur l'appareil. Pour votre compte Spotify, exercez vos droits auprès de Spotify.
- **Serveur musique** : pas de compte utilisateur BeatOnStep ; pour toute question, utilisez le [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Modifications

Cette politique peut être mise à jour. La date en haut du document reflète la dernière révision. La version en vigueur est disponible à l'adresse communiquée sur la fiche **Google Play** et dans l'app (*Réglages → À propos*) :

**https://rafa-create.github.io/beatonstep-website/privacy.html**

## 10. Contact

- **Éditeur :** Rafael Orset
- **Forum :** [github.com/rafa-create/beatonstep-website/discussions/1](https://github.com/rafa-create/beatonstep-website/discussions/1)

---

## 11. Crédits musicaux (catalogue mix démo)

Le catalogue « Mix démo » est composé exclusivement de morceaux libres de droits sous licence **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))** (usage commercial autorisé **avec attribution**).

**Artiste (source) :**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)

Les BPM sont mesurés côté serveur (`librosa.beat.beat_track`, seuil de confiance ≥ 0,77). Ils peuvent différer légèrement des BPM publiés par les auteurs.

**Liste complète des titres (obligatoire pour l'attribution CC-BY) :**  
[Crédits musicaux — Mix démo](https://rafa-create.github.io/beatonstep-website/music-credits.html)
