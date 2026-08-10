# Politique de confidentialité — BeatOnStep

**Dernière mise à jour :** 10 août 2026

## 1. Qui sommes-nous

BeatOnStep est une application Android de course/marche rythmée qui adapte la musique au rythme de vos foulées. Cette politique décrit quelles données l'application traite et comment.

**Éditeur :** Rafael Orset — contact : orsetrafael@gmail.com

## 2. Données collectées (principe)

**L’éditeur BeatOnStep ne collecte pas de compte utilisateur BeatOnStep, n’utilise pas de publicité, ni d’analytique / tracking commercial.** Aucune donnée de cadence (PPM), de parcours GPS ou de bibliothèque locale n’est envoyée à l’éditeur à des fins marketing.

Selon les fonctions que **vous** activez, l’application peut toutefois échanger des données avec **des services que vous choisissez** (Google / YouTube, serveur musique optionnel) ou avec l’infrastructure de mises à jour (Expo). Détail ci-dessous.

## 3. Fonctionnalités et flux de données

### 3.1 Bibliothèque locale (fichiers audio sur l’appareil)

- Les fichiers que vous importez restent **sur votre appareil**.
- Métadonnées associées (chemin, BPM saisi ou détecté, préférences) : stockage **local uniquement**.
- Aucune obligation d’envoyer ces fichiers hors de l’appareil pour utiliser la détection de cadence et la lecture locale.

### 3.2 Détection de cadence (PPM)

- L’accéléromètre / capteurs de mouvement sont lus **sur l’appareil** pour estimer votre cadence.
- Ces mesures **ne sont pas transmises** à l’éditeur ni à un serveur BeatOnStep à des fins de profilage.
- Elles servent uniquement au fonctionnement temps réel de l’app (proposition / lancement de musique adaptée).

### 3.3 YouTube Music (optionnel, connexion Google)

Si vous connectez un compte Google pour utiliser YouTube Music dans BeatOnStep :

- L’app utilise **OAuth 2.0 (PKCE)** avec un Client ID Android public ; **aucun client secret** n’est embarqué dans l’application.
- Des **jetons d’accès / rafraîchissement** sont stockés **localement** sur l’appareil (espace privé de l’app).
- L’app interroge les **API Google / YouTube Data** (ex. listes de lecture, métadonnées de vidéos / titres) **au nom de votre compte**, uniquement pour afficher et proposer de la musique.
- La **lecture** s’effectue en ouvrant / s’appuyant sur l’écosystème YouTube (ex. application YouTube) ; BeatOnStep ne reçoit pas votre mot de passe Google.
- Vous pouvez **déconnecter** YouTube dans l’app : les jetons locaux sont alors effacés.
- Le traitement de votre compte Google / YouTube est aussi régi par les politiques de **Google** ; BeatOnStep n’est pas l’éditeur de YouTube.

Spotify et Deezer peuvent exister dans le code pour des tests, mais **ne sont pas proposés** dans la configuration Play Store actuelle (désactivés côté build).

### 3.4 Serveur musique personnel (optionnel)

- L’app peut se connecter à un serveur privé de l’éditeur (`https://beatonstep.tail09d8d8.ts.net/music`) pour lister des morceaux de démonstration et, le cas échéant, **analyser le tempo (BPM)** d’un fichier audio que vous envoyez pour analyse.
- Ce serveur **n’est pas un réseau social** ni un service public d’analytique : usage éditeur / catalogue de démo.
- Pas de création de compte utilisateur BeatOnStep, pas de cookie publicitaire, pas de télémétrie marketing sur ce serveur.
- Les fichiers envoyés pour analyse BPM ne sont pas destinés à un stockage permanent ni à une revente.

### 3.5 Mises à jour de l’application (Expo)

- L’app peut contacter les services **Expo** pour vérifier / télécharger des mises à jour JavaScript (OTA) liées à votre installation.
- Cela ne constitue pas un SDK publicitaire ; aucune donnée de cadence ni de bibliothèque musicale n’est envoyée à l’éditeur via ce canal à des fins commerciales.

## 4. Permissions Android demandées

| Permission | Raison |
|------------|--------|
| `HIGH_SAMPLING_RATE_SENSORS` | Lecture de l’accéléromètre à haute fréquence pour détecter votre cadence de pas (PPM). |
| `FOREGROUND_SERVICE` | Maintenir la lecture musicale et la détection de cadence en arrière-plan (téléphone verrouillé). |
| `WAKE_LOCK` | Limiter la mise en veille du capteur pendant une session. |

Aucune permission n’accède à votre position GPS, vos contacts, vos photos, votre microphone ou votre caméra pour le fonctionnement décrit ci-dessus. L’accès à des fichiers audio locaux se fait via les mécanismes système de sélection / bibliothèque lorsque vous importez de la musique.

## 5. Stockage local

Sur votre appareil, dans l’espace privé de l’app, peuvent figurer notamment :

- Bibliothèque importée (chemins, BPM, sources).
- Préférences (mode marche/course, plages cibles, réglages YouTube, etc.).
- Jetons OAuth YouTube (si vous êtes connecté).

La **désinstallation** de l’application supprime en principe ces données locales. La déconnexion YouTube efface les jetons sans désinstaller l’app.

## 6. Services tiers

| Service | Quand | Données concernées (résumé) |
|---------|--------|-----------------------------|
| **Google / YouTube** | Si vous connectez YouTube Music | Authentification OAuth ; requêtes API playlists / métadonnées ; lecture via YouTube |
| **Serveur musique BeatOnStep** | Si vous utilisez le catalogue / l’analyse BPM serveur | Liste de titres ; éventuel envoi audio pour BPM |
| **Expo (mises à jour)** | Automatique selon config de l’app | Vérification / téléchargement de mises à jour OTA |

**Pas de** SDK de publicité, de mesure d’audience marketing, ni de réseau social intégré hors le parcours YouTube que vous déclenchez.

## 7. Enfants

L’application n’est pas spécifiquement destinée aux enfants de moins de 13 ans et ne collecte sciemment aucune donnée les concernant.

## 8. Vos droits (RGPD)

- Données **uniquement locales** (bibliothèque, réglages, jetons) : vous les contrôlez via l’app (ex. déconnexion YouTube) ou la désinstallation.
- Compte **Google / YouTube** : exercez vos droits auprès de Google selon leurs procédures.
- Serveur musique de l’éditeur : pas de compte utilisateur BeatOnStep ; pour toute question, contactez l’éditeur (e-mail ci-dessous).

## 9. Modifications

Cette politique peut être mise à jour. La date en haut du document reflète la dernière révision. La version courante est disponible à l’URL publique communiquée sur la fiche Google Play (Gist) et dans l’app (*Réglages → À propos*).

## 10. Crédits musicaux (catalogue serveur)

Le catalogue de démonstration servi par le mode serveur (cf. § 3.4) est composé exclusivement de morceaux libres de droits sous licence **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))**.

### Attribution générale

> *Music : tracks by **Kevin MacLeod** ([incompetech.com](https://incompetech.com)) — licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).*

Les fichiers audio sont servis sans modification du contenu original (l’analyse BPM est purement informationnelle et ne modifie pas les fichiers).

### Détail des 77 morceaux du catalogue

Tous par **Kevin MacLeod**, tous sous **CC-BY 4.0**, hébergés à l’origine sur [incompetech.com/music/royalty-free/](https://incompetech.com/music/royalty-free/). Les BPM listés sont ceux mesurés par l’algorithme `librosa.beat.beat_track` du serveur BeatOnStep (seuil de confidence ≥ 0,77, mesures du 2026-05-22 et 2026-05-24).

| Titre | BPM mesuré | Source |
|-------|-----------:|--------|
| Backbay Lounge | 117 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Backbay%20Lounge.mp3) |
| Big Mojo | 105 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Big%20Mojo.mp3) |
| Black Vortex | 161 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Black%20Vortex.mp3) |
| Blippy Trance | 199 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Blippy%20Trance.mp3) |
| Brittle Rille | 74 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Brittle%20Rille.mp3) |
| Bumbly March | 93 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bumbly%20March.mp3) |
| Cambodian Odyssey | 110 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cambodian%20Odyssey.mp3) |
| Carefree | 185 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3) |
| Carpe Diem | 185 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carpe%20Diem.mp3) |
| Cipher2 | 152 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher2.mp3) |
| Cold Funk | 110 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cold%20Funk.mp3) |
| Comfortable Mystery | 136 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Comfortable%20Mystery.mp3) |
| Comparsa | 87 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Comparsa.mp3) |
| Cool Vibes | 83 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Vibes.mp3) |
| Crinoline Dreams | 117 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Crinoline%20Dreams.mp3) |
| Deliberate Thought | 114 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deliberate%20Thought.mp3) |
| Disco con Tutti | 117 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Disco%20con%20Tutti.mp3) |
| District Four | 123 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/District%20Four.mp3) |
| Dreams Become Real | 114 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dreams%20Become%20Real.mp3) |
| Dreamy Flashback | 108 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dreamy%20Flashback.mp3) |
| Easy Jam | 161 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Easy%20Jam.mp3) |
| Easy Lemon | 82 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Easy%20Lemon.mp3) |
| EDM Detection Mode | 129 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/EDM%20Detection%20Mode.mp3) |
| Electrodoodle | 161 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Electrodoodle.mp3) |
| Fast Talkin | 136 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fast%20Talkin.mp3) |
| Fearless First | 102 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fearless%20First.mp3) |
| Floating Cities | 123 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Floating%20Cities.mp3) |
| Fluffing a Duck | 82 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3) |
| Folk Round | 114 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Folk%20Round.mp3) |
| Funkorama | 133 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funkorama.mp3) |
| Funky Chunk | 117 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funky%20Chunk.mp3) |
| Furious Freak | 75 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Furious%20Freak.mp3) |
| Hep Cats | 116 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hep%20Cats.mp3) |
| Hidden Agenda | 129 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hidden%20Agenda.mp3) |
| Hyperfun | 199 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hyperfun.mp3) |
| Industrial Cinematic | 99 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Industrial%20Cinematic.mp3) |
| Industrial Music Box | 70 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Industrial%20Music%20Box.mp3) |
| Intrepid | 75 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Intrepid.mp3) |
| Investigations | 98 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Investigations.mp3) |
| Jaunty Gumption | 144 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Jaunty%20Gumption.mp3) |
| Local Forecast | 98 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Local%20Forecast.mp3) |
| Local Forecast - Elevator | 108 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Local%20Forecast%20-%20Elevator.mp3) |
| Long Stroll | 99 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Long%20Stroll.mp3) |
| Marty Gots a Plan | 136 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Marty%20Gots%20a%20Plan.mp3) |
| Mining by Moonlight | 105 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Mining%20by%20Moonlight.mp3) |
| Modern Jazz Samba | 115 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Modern%20Jazz%20Samba.mp3) |
| Monkeys Spinning Monkeys | 116 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3) |
| Moonlight Hall | 136 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Moonlight%20Hall.mp3) |
| Mountain Emperor | 102 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Mountain%20Emperor.mp3) |
| Movement Proposition | 106 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Movement%20Proposition.mp3) |
| Off to Osaka | 117 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Off%20to%20Osaka.mp3) |
| Olde Timey | 90 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Olde%20Timey.mp3) |
| One-eyed Maestro | 116 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/One-eyed%20Maestro.mp3) |
| Onion Capers | 89 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Onion%20Capers.mp3) |
| Pamgaea | 185 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pamgaea.mp3) |
| Pixelland | 108 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pixelland.mp3) |
| Plain Loafer | 116 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Plain%20Loafer.mp3) |
| Plans in Motion | 129 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Plans%20in%20Motion.mp3) |
| Pop Goes the Weasel | 65 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pop%20Goes%20the%20Weasel.mp3) |
| Rite of Passage | 129 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Rite%20of%20Passage.mp3) |
| Rocket Power | 127 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Rocket%20Power.mp3) |
| Run Amok | 144 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Run%20Amok.mp3) |
| Salty Ditty | 120 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Salty%20Ditty.mp3) |
| Severe Tire Damage | 144 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Severe%20Tire%20Damage.mp3) |
| Slow Burn | 161 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Slow%20Burn.mp3) |
| Sneaky Adventure | 108 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Adventure.mp3) |
| Sneaky Snitch | 88 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3) |
| Spy Glass | 68 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Spy%20Glass.mp3) |
| Tabuk | 108 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Tabuk.mp3) |
| The Builder | 123 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Builder.mp3) |
| The Cannery | 172 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Cannery.mp3) |
| The Lift | 136 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Lift.mp3) |
| The Show Must Be Go | 127 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Show%20Must%20Be%20Go.mp3) |
| Volatile Reaction | 144 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3) |
| Voltaic | 123 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Voltaic.mp3) |
| Wallpaper | 185 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Wallpaper.mp3) |
| Welcome to the Show | 123 | [incompetech.com](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Welcome%20to%20the%20Show.mp3) |

## 11. Contact

Pour toute question concernant cette politique de confidentialité :

- **Éditeur :** Rafael Orset
- **Email :** orsetrafael@gmail.com
- **Dépôt source :** https://github.com/rafa-create/BeatOnStep
- **Version publique (Play / app) :** https://gist.github.com/rafa-create/64aec3d741830bc11fb4d6e1f2aa8fbc  
  (BeatOnStep est un **repo privé** : `rafa-create.github.io/BeatOnStep` reste 404 tant que Pages n’est pas sur un **repo/gist public**. `docs/index.html` = maquette prête si un jour un site public est activé.)
