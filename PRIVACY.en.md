# Privacy Policy — BeatOnStep (English)

**Last updated:** October 6, 2026

*The French text is the binding version. This English translation is provided for convenience.*

## 1. Who we are

BeatOnStep is a mobile app (Android and iOS) that adapts music to your walking or running cadence. The app is available on **Google Play** (Android, **BeatOnStep**) and the **App Store** (iOS, **BeatOnSteps**).

**Publisher:** Rafael Orset — contact: [BeatOnStep forum](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Core principle: minimal data collection, no commercial tracking

BeatOnStep **does not create user accounts**, uses **no advertising**, and performs **no commercial tracking or profiling**. A very limited pseudonymous usage measurement may be sent to the BeatOnStep server solely to count how many personal playlists are imported per source (§ 3.9). No cadence (SPM), route data, playlist name or identifier, track, artist, or music-account identifier is included in this measurement.

Depending on the features **you** enable, the app may exchange data with services **you choose** (demo mix / music server, YouTube or Apple Music if connected, pasted Spotify or Deezer links, BPM analysis) or with technical infrastructure (updates). Details below.

## 3. Features and data flows

### 3.1 Local audio files (Phone music)

- Files you import stay **on your device**.
- Associated metadata (path, BPM, preferences) is stored **locally only**.
- No audio file is sent off-device for cadence detection or local playback, unless you trigger server-side BPM analysis (§ 3.3).

### 3.2 Cadence detection (SPM)

- The accelerometer is read **on-device** to estimate your step cadence.
- These readings stay **on-device by default** and are not sent automatically. They may only be included in a diagnostic report if you explicitly choose **Bug / feedback → Send** (§ 3.11).
- They are used solely for real-time app operation (selecting and playing music matched to your pace).

### 3.3 Demo mix and music server (optional)

The demo catalogue (278 royalty-free tracks) is hosted on a publisher server (`https://beatonstep.tail09d8d8.ts.net/music`).

- This server is **not a social network** or public service: it serves only the demo catalogue.
- No account creation, no advertising cookies, no marketing telemetry.
- If you send an audio file for **BPM analysis**, it transits through the server for processing; it is not retained permanently or resold.

### 3.4 YouTube (optional)

If you connect a Google account to use YouTube in BeatOnStep:

- Feature **initiated by you**; BeatOnStep **does not provide** a YouTube catalogue.
- Secure Google sign-in; the publisher does **not** receive your Google password.
- **Access tokens** are stored **locally** on the device and are **never transmitted** to the publisher or resold.
- The app queries **Google / YouTube APIs** to display **your** playlists and metadata.
- **Playback** happens in the **YouTube** or **YouTube Music** app (your choice in Settings) — not inside BeatOnStep.
- You can **disconnect** YouTube in the app at any time: local tokens are deleted.
- Your Google account remains governed by **Google's** policies.

### 3.5 Apple Music (optional)

If you connect an Apple account to use Apple Music in BeatOnStep:

- Feature **initiated by you**; BeatOnStep **does not provide** an Apple Music catalogue.
- Secure Apple sign-in; the publisher does **not** receive your Apple password.
- **Access tokens** are stored **locally** on the device and are **never transmitted** to the publisher or resold.
- The app queries **Apple** services to display **your** playlists and metadata (tracks, artists, BPM you enter or detect).
- No audio files are cached by BeatOnStep; **playback** happens in the **Apple Music** app — not inside BeatOnStep.
- An active **Apple Music subscription** is required to listen to the catalogue via Apple.
- You can **disconnect** Apple Music in the app at any time: local tokens are deleted.
- Your Apple account remains governed by **Apple's** policies.

**iPhone:** automatic playback in Apple Music; music can keep playing in the background while BeatOnStep runs.

**Android:** the Apple Music app ([Google Play](https://play.google.com/store/apps/details?id=com.apple.android.music)) must be installed; BeatOnStep opens the track in that app (no BeatOnStep built-in player).

### 3.6 Spotify (optional — Share links)

When you use Spotify in BeatOnStep:

- Feature **initiated by you**: you paste the **Share** link of a **track**, or of a **public playlist**. BeatOnStep **does not sign you into** Spotify.
- The app may query Spotify’s public catalogue to display the title. No Spotify password is requested or sent to the publisher.
- IDs and metadata stay **on the device**.
- **Playback** happens in the **Spotify** app — not inside BeatOnStep. A Spotify account (and, depending on the tracks, a subscription) may be required by Spotify.
- A **private** playlist cannot be read without an official sign-in, which is not offered to the public for now.
- BeatOnStep **does not provide** Spotify’s catalogue.

### 3.7 Deezer (optional — Share links)

When you use Deezer in BeatOnStep:

- Feature **initiated by you**: you paste the **Share** link of a **track**, or of a **public playlist**. BeatOnStep **does not sign you into** Deezer.
- The app may query Deezer’s public catalogue (title, duration, sometimes BPM). No Deezer password is requested or sent to the publisher.
- IDs and metadata stay **on the device**.
- **Playback** happens in the **Deezer** app — not inside BeatOnStep. A Deezer account (and, depending on the tracks, a subscription) may be required by Deezer.
- A **private** playlist cannot be read without an official sign-in, which is not offered to the public for now.
- BeatOnStep **does not provide** Deezer’s catalogue.

### 3.8 Updates (Expo OTA)

The app may contact **Expo** services to check for and download JavaScript updates linked to your installation. This is not an advertising SDK; no cadence or music library data is sent through this channel.

### 3.9 Pseudonymous measurement of imported playlist counts

To understand use of the import feature and improve the product, BeatOnStep may occasionally send the publisher's server a **minimal snapshot** containing:

- a random BeatOnStep installation identifier;
- platform (iOS / Android) and app version;
- the **number** of personal playlists still imported for Apple Music, YouTube, Spotify, and Deezer.

This is **product analytics** used to understand the import feature and guide improvements. It contains **no playlist name or identifier**, track, artist, OAuth token, music account, audio data, cadence (SPM), or route. The random installation identifier is not an Apple, Google, Android, or music-provider identifier and contains no name or email address.

Sending is limited to at most once per day after a change and, if unchanged, at most once every 7 days to measure active installations. The server keeps only the **latest known snapshot per installation** and does not keep a detailed history of each transmission. These data are not sold, used for advertising, or used for advertising tracking or cross-company profiling.

### 3.10 Garmin and route shape (optional)

If you use a compatible Garmin watch with BeatOnStep:

- the watch uses its GPS as part of the recorded Garmin activity and may temporarily send BeatOnStep the positions needed for the run recap;
- raw GPS coordinates remain **in memory only during the run**: BeatOnStep does not persist them or send them to the BeatOnStep server;
- at the end of the run, BeatOnStep may locally keep a **simplified relative route shape**, with no latitude or longitude, for the recap and share visuals;
- if you share a BeatOnStep story, only this non-geographic relative shape may be included; raw GPS coordinates are never included in the share URL.

### 3.11 Voluntary Bug / feedback diagnostic report

If you use the **Help** button in Settings, BeatOnStep shows a confirmation before anything is sent. If you choose **Send**, the app sends the BeatOnStep server the same technical report that you can manually share by tapping the app version.

The report may include app version/build/runtime, recent diagnostic events, the last few minutes of SPM diagnostics (including accelerometer samples and calculated cadence), technical Garmin / Apple Watch and music-integration states, plus the pseudonymous installation identifier, platform, and app version.

Sending is **strictly user-initiated**: no Help report is transmitted automatically. No password, OAuth token, or music file is included.

The report is used only for **technical support and incident diagnosis**. Small reports may be included directly in the support email body; larger reports may be attached as a text file. The private support recipient email address is configured only on the server and is not exposed in the app.

## 4. Permissions

### Android

| Permission | Purpose |
|------------|---------|
| `HIGH_SAMPLING_RATE_SENSORS` | Read the accelerometer at high frequency to detect step cadence (SPM). |
| `FOREGROUND_SERVICE` | Keep music playback and cadence detection running in the background (locked screen). |
| `WAKE_LOCK` | Prevent the sensor from sleeping during a session. |

### iOS (App Store)

BeatOnStep requests access only to **motion sensors** (accelerometer) for cadence detection. On iOS, this is handled by the native framework without an explicit user-facing permission prompt.

Access to the **media library** (Phone music) triggers a standard system permission request when you import music from your device.

The BeatOnStep mobile app requests **no phone GPS location permission**. If you use the BeatOnStep Garmin app, the watch may use its own positioning permission to record the activity and provide the relative route shape described in § 3.9. BeatOnStep does not access your contacts, camera, or microphone.

## 5. Locally stored data

On your device, in the app's private storage:

- Imported library (paths, BPM, enabled sources).
- Preferences (mode, target ranges, settings, language).
- YouTube and Apple Music connection tokens (if connected).
- Spotify tracks or public playlists whose links you pasted (ID, title, entered or detected BPM) — **no** Spotify account token.
- Deezer tracks or public playlists whose links you pasted (ID, metadata, BPM entered, detected, or provided by Deezer) — **no** Deezer account token.
- Random BeatOnStep installation identifier and latest local playlist-measurement state (§ 3.9).
- Simplified relative shape of the latest Garmin route used for the recap/story, when available (§ 3.10) — **without raw GPS coordinates**.

**Uninstalling** the app removes this data. Disconnecting a service (YouTube, Apple Music) deletes the corresponding tokens without uninstalling the app.

## 6. Third-party services

| Service | When | What transits |
|---------|------|---------------|
| **Google / YouTube** | If you connect YouTube | Google sign-in; playlist / metadata API requests |
| **Apple / Apple Music** | If you connect Apple Music | Apple sign-in; playlist metadata |
| **Apple (App Store)** | iOS distribution | Managed by Apple under their own terms |
| **Expo** | Automatic | OTA update verification / download |
| **BeatOnStep server** | Catalogue / BPM analysis, pseudonymous usage measurement and voluntary support | Track list; optional audio file for BPM analysis; playlist counts + random installation identifier (§ 3.9); Help technical report only after explicit confirmation (§ 3.11) |
| **Spotify** | If you paste a Share link | Public catalogue request (title); opening in the Spotify app. No account sign-in |
| **Deezer** | If you paste a Share link | Public catalogue request (title / duration / sometimes BPM); opening in the Deezer app. No account sign-in |
| **Garmin Connect IQ** | If you pair a Garmin watch and use BeatOnStep during a run | Cadence and run metrics; transient raw GPS positions watch → phone only to locally produce a relative route shape (§ 3.10) |

No advertising SDK, no marketing audience measurement, no integrated social network beyond the connection to services you choose.

## 7. Children

The app is not directed at children under 13 (16 in the EU) and does not knowingly collect data from them.

## 8. Your rights (GDPR / privacy)

- **Local data** (library, settings, tokens): you control it directly in the app or by uninstalling.
- **Google / YouTube account**: exercise your rights with Google under their procedures.
- **Apple / Apple Music account**: exercise your rights with Apple under their procedures.
- **Spotify**: no BeatOnStep account linked to Spotify; pasted links stay on the device. For your Spotify account, exercise your rights with Spotify.
- **Deezer**: no BeatOnStep account linked to Deezer; pasted links stay on the device. For your Deezer account, exercise your rights with Deezer.
- **BeatOnStep server**: no BeatOnStep user account. Pseudonymous measurement keeps only the latest state per installation; Help reports are sent only when you explicitly request support (§ 3.11). For any question, use the [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Changes

This policy may be updated. The date at the top reflects the latest revision. The current version is available at the address listed on **Google Play** and in the app (*Settings → About*):

**https://rafa-create.github.io/beatonstep-website/privacy.html**

## 10. Contact

- **Publisher:** Rafael Orset
- **Forum:** [github.com/rafa-create/beatonstep-website/discussions/1](https://github.com/rafa-create/beatonstep-website/discussions/1)

---

## 11. Music credits (demo mix catalogue)

The "Demo mix" catalogue consists exclusively of royalty-free tracks under **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))** (commercial use allowed **with attribution**).

**Artists (sources):**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)
- **Scott Buckley** — [scottbuckley.com.au](https://www.scottbuckley.com.au/library/)

BPM values are measured server-side (`librosa.beat.beat_track`, confidence threshold ≥ 0.77). They may differ slightly from author-published BPM values.

**Full track list (required for CC-BY attribution):**  
[Music credits — Demo mix](https://rafa-create.github.io/beatonstep-website/music-credits.html)
