# Privacy Policy — BeatOnStep (English)

**Last updated:** September 3, 2026

*The French text is the binding version. This English translation is provided for convenience.*

## 1. Who we are

BeatOnStep is a mobile app (Android and iOS) that adapts music to your walking or running cadence. The app is available on **Google Play** (Android, **BeatOnStep**) and the **App Store** (iOS, **BeatOnSteps**).

**Publisher:** Rafael Orset — contact: [BeatOnStep forum](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Core principle: no publisher-side data collection

BeatOnStep **does not create user accounts**, uses **no advertising**, and includes **no commercial analytics or tracking**. No cadence data (SPM), route data, or music library data is sent to the publisher for marketing or profiling purposes.

Depending on the features **you** enable, the app may exchange data with services **you choose** (demo mix / music server, YouTube or Apple Music if connected, pasted Spotify or Deezer links, BPM analysis) or with technical infrastructure (updates). Details below.

## 3. Features and data flows

### 3.1 Local audio files (Phone music)

- Files you import stay **on your device**.
- Associated metadata (path, BPM, preferences) is stored **locally only**.
- No audio file is sent off-device for cadence detection or local playback, unless you trigger server-side BPM analysis (§ 3.3).

### 3.2 Cadence detection (SPM)

- The accelerometer is read **on-device** to estimate your step cadence.
- These readings are **not transmitted** to the publisher or any BeatOnStep server.
- They are used solely for real-time app operation (selecting and playing music matched to your pace).

### 3.3 Demo mix and music server (optional)

The demo catalogue (181 royalty-free tracks) is hosted on a publisher server (`https://beatonstep.tail09d8d8.ts.net/music`).

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

### 3.6 Spotify (optional — track links)

If you import Spotify tracks into BeatOnStep:

- Feature **initiated by you**: you paste **track** links (`open.spotify.com/track/…` or `spotify:track:…`). BeatOnStep **does not import your Spotify playlists** and **does not sign you into** Spotify.
- The app may query Spotify’s public catalogue to display the title. No Spotify password is requested or sent to the publisher.
- Track IDs and metadata stay **on the device**.
- **Playback** happens in the **Spotify** app — not inside BeatOnStep. A Spotify account (and, depending on the tracks, a subscription) may be required by Spotify.
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

**No permission** accesses your GPS location, contacts, camera, or microphone.

## 5. Locally stored data

On your device, in the app's private storage:

- Imported library (paths, BPM, enabled sources).
- Preferences (mode, target ranges, settings, language).
- YouTube and Apple Music connection tokens (if connected).
- Spotify tracks whose links you pasted (ID, title, entered or detected BPM) — **no** Spotify account token.
- Deezer tracks or public playlists whose links you pasted (ID, metadata, BPM entered, detected, or provided by Deezer) — **no** Deezer account token.

**Uninstalling** the app removes this data. Disconnecting a service (YouTube, Apple Music) deletes the corresponding tokens without uninstalling the app.

## 6. Third-party services

| Service | When | What transits |
|---------|------|---------------|
| **Google / YouTube** | If you connect YouTube | Google sign-in; playlist / metadata API requests |
| **Apple / Apple Music** | If you connect Apple Music | Apple sign-in; playlist metadata |
| **Apple (App Store)** | iOS distribution | Managed by Apple under their own terms |
| **Expo** | Automatic | OTA update verification / download |
| **BeatOnStep mix server** | If you use the catalogue or BPM analysis | Track list; optional audio file for BPM analysis |
| **Spotify** | If you paste track links | Public catalogue request (title); opening the track in the Spotify app. No account sign-in |
| **Deezer** | If you paste a Share link | Public catalogue request (title / duration / sometimes BPM); opening in the Deezer app. No account sign-in |

No advertising SDK, no marketing audience measurement, no integrated social network beyond the connection to services you choose.

## 7. Children

The app is not directed at children under 13 (16 in the EU) and does not knowingly collect data from them.

## 8. Your rights (GDPR / privacy)

- **Local data** (library, settings, tokens): you control it directly in the app or by uninstalling.
- **Google / YouTube account**: exercise your rights with Google under their procedures.
- **Apple / Apple Music account**: exercise your rights with Apple under their procedures.
- **Spotify**: no BeatOnStep account linked to Spotify; pasted links stay on the device. For your Spotify account, exercise your rights with Spotify.
- **Deezer**: no BeatOnStep account linked to Deezer; pasted links stay on the device. For your Deezer account, exercise your rights with Deezer.
- **Music server**: no BeatOnStep user account; for any question, use the [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Changes

This policy may be updated. The date at the top reflects the latest revision. The current version is available at the address listed on **Google Play** and in the app (*Settings → About*):

**https://rafa-create.github.io/beatonstep-website/privacy.html**

## 10. Contact

- **Publisher:** Rafael Orset
- **Forum:** [github.com/rafa-create/beatonstep-website/discussions/1](https://github.com/rafa-create/beatonstep-website/discussions/1)

---

## 11. Music credits (demo mix catalogue)

The "Demo mix" catalogue consists exclusively of royalty-free tracks under **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))** (commercial use allowed **with attribution**).

**Artist (source):**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)

BPM values are measured server-side (`librosa.beat.beat_track`, confidence threshold ≥ 0.77). They may differ slightly from author-published BPM values.

**Full track list (required for CC-BY attribution):**  
[Music credits — Demo mix](https://rafa-create.github.io/beatonstep-website/music-credits.html)
