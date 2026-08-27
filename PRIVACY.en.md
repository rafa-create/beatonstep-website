# Privacy Policy — BeatOnStep (English)

**Last updated:** August 27, 2026

*The French text is the binding version. This English translation is provided for convenience.*

## 1. Who we are

BeatOnStep is a mobile app (Android and iOS) that adapts music to your walking or running cadence. The app is available in early access on **Google Play** (internal test) and **Apple TestFlight**.

**Publisher:** Rafael Orset — contact: [BeatOnStep forum](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Core principle: no publisher-side data collection

BeatOnStep **does not create user accounts**, uses **no advertising**, and includes **no commercial analytics or tracking**. No cadence data (SPM), route data, or music library data is sent to the publisher for marketing or profiling purposes.

Depending on the features **you** enable, the app may exchange data with services **you choose** (demo mix / music server, BPM analysis) or with technical infrastructure (updates). YouTube, Spotify and Deezer are **not yet available** in the first store version. Details below.

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

### 3.4 YouTube Music (not yet available)

YouTube Music is **not offered** in the first store version. A later reactivation is planned after platform validation (Apple, Google).

When the feature is active:

- The app will use **OAuth 2.0 (PKCE)**; **no client secret** embedded.
- **Tokens** will be stored **locally** and never sent to the publisher.
- Playback will go through the YouTube app; BeatOnStep will not receive your Google password.
- Your Google account will remain governed by **Google's** policies.

### 3.5 Spotify (not yet available)

Spotify is **not offered** in the first store version. A later reactivation is planned (invite-only beta), subject to platform validation and sufficient Spotify developer access.

When the feature is active: OAuth authentication, local token storage, playback in the Spotify app — with no transmission to the publisher.

### 3.6 Deezer (not yet available)

Deezer is **not offered**: Deezer's developer platform no longer accepts new applications. Reactivation is possible if Deezer reopens access.

### 3.7 Updates (Expo OTA)

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
- YouTube / Spotify OAuth tokens (when those features return and you connect).

**Uninstalling** the app removes this data. Disconnecting a service (YouTube, Spotify) deletes the corresponding tokens without uninstalling the app.

## 6. Third-party services

| Service | When | What transits |
|---------|------|---------------|
| **Google / YouTube** | Not in store v1 yet (later, if you connect) | OAuth authentication; playlist / metadata API requests |
| **Apple (TestFlight)** | iOS early-access distribution | Beta version management by Apple under their own terms |
| **Expo** | Automatic | OTA update verification / download |
| **BeatOnStep mix server** | If you use the catalogue or BPM analysis | Track list; optional audio file for BPM analysis |
| **Spotify** | Not in store v1 yet (later, invite beta) | OAuth authentication; playlist metadata |
| **Deezer** | Not available (developer access closed) | — |

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

## 11. Music credits (demo mix catalogue)

The « Demo mix » catalogue consists exclusively of royalty-free tracks licensed under **Creative Commons Attribution 4.0 International ([CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/))** (commercial use allowed **with attribution**).

**Artist (source):**

- **Kevin MacLeod** — [incompetech.com](https://incompetech.com)

BPM values are measured on the server (`librosa.beat.beat_track`, confidence ≥ 0.77).

**Full track list (required for CC-BY attribution):**  
[Music credits — Demo mix](https://rafa-create.github.io/beatonstep-website/music-credits.html)
