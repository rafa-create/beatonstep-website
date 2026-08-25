# Privacy Policy — BeatOnStep (English)

**Last updated:** August 25, 2026

*The French text is the binding version. This English translation is provided for convenience.*

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

The demo catalogue (181 royalty-free tracks) is hosted on a publisher server (`https://beatonstep.tail09d8d8.ts.net/music`).

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

**Artist (source):**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)

BPM values are measured on the server (`librosa.beat.beat_track`, confidence ≥ 0.77).

**Full track list (required for CC-BY attribution):**  
[Music credits — Included mix](https://rafa-create.github.io/beatonstep-website/music-credits.html)
