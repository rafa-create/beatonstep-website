# Privacy Policy — BeatOnStep (English)

**Last updated:** October 14, 2026

*The French text is the binding version. This English translation is provided for convenience.*

## 1. Who we are

BeatOnStep is a mobile app (Android and iOS) that adapts music to your walking or running cadence. The app is available on **Google Play** (Android, **BeatOnStep**) and the **App Store** (iOS, **BeatOnSteps**).

**Publisher:** Rafael Orset — contact: [BeatOnStep forum](https://github.com/rafa-create/beatonstep-website/discussions/1)

## 2. Core principle: minimal collection, no commercial tracking

BeatOnStep **works without an account** and offers an **optional catalogue account solely for signing public shares**. It uses **no advertising**, and performs **no commercial tracking or profiling**. A very limited pseudonymous usage measurement may be sent to the BeatOnStep server solely to count personal playlists imported per source (§ 3.9). That measurement contains no cadence (SPM), route data, playlist name or ID, track, artist, or music-account information.

Depending on the features **you** enable, the app may exchange data with services **you choose** (demo mix / music server, YouTube or Apple Music if connected, pasted Spotify or Deezer links, BPM analysis) or with technical infrastructure (updates). Details below.

### Optional catalogue accounts

An account is **optional**: creating workouts, running, importing music, and sharing anonymously never require registration. If you create a catalogue account on the website, BeatOnStep stores your non-public email address, public handle, password salt and password hash, and registration date in Cloudflare D1. The site uses a secure `HttpOnly` session cookie; the app can store a publish-only grant (maximum 30 days), revocable by signing out.

Your handle and any workouts or Run Mix published while connected are public. Older anonymous posts are never automatically attributed. Music-provider credentials are not shared with the catalogue. You can sign out and delete your account via “My profile”: deletion removes attribution from your posts, which stay publicly available as anonymous posts unless moderated, and revokes associated sessions and device grants. Email is used solely for sign-in, never publicly displayed or used for marketing. At this stage, accounts do not yet have email verification or password recovery. Use an address you control and keep your password safely. These protections should be completed before a large-scale rollout.

## 3. Features and data flows

### 3.1 Local audio files (Phone music)

- Files you import stay **on your device**.
- Associated metadata (path, BPM, preferences) is stored **locally only**.
- No audio file is sent off-device for cadence detection or local playback, unless you trigger server-side BPM analysis (§ 3.3).

### 3.2 Cadence detection (SPM)

- The accelerometer is read **on-device** to estimate your step cadence.
- These readings stay **on the device by default** and are not sent automatically. They may only be included in a diagnostic report if you explicitly choose **Bug / feedback → Send** (§ 3.11).
- They are used solely for real-time app operation (selecting and playing music matched to your pace).

### 3.3 Demo mix and music server (optional)

The demo catalogue (278 royalty-free tracks) is hosted on a publisher server (`https://beatonstep.tail09d8d8.ts.net/music`).

- This server is **not a social network** or public service: it serves only the demo catalogue.
- No account creation, no advertising cookies, no marketing telemetry.
- If you send an audio file for **BPM analysis**, it transits through the server for processing; it is not retained permanently or resold.

### 3.4 YouTube (optional)

Connecting Google/YouTube is optional and separate from an optional BeatOnStep catalogue account. Without Google sign-in, BeatOnStep does not access your YouTube account data.

- **Data accessed and purpose:** with your OAuth consent, BeatOnStep reads your YouTube channel, personal playlists (including private ones when the API makes them available), their tracks and available metadata (IDs, titles, artists, durations, thumbnails). It uses them to display and import your music library, calculate or edit BPM values locally, prepare a workout, and open music in YouTube or YouTube Music. BeatOnStep does not download YouTube audio files.
- **Permissions:** `youtube.readonly` is used to read and import playlists. `userinfo.email` is used only to display the connected Google account address. If you expressly choose “Allow creating playlists” in the library, a separate YouTube write permission may be requested to manually export a workout to a new private playlist. BeatOnStep does not automatically add to or alter playlists in your YouTube account during workouts.
- **Data protection:** Google OAuth uses PKCE, and requests to Google's APIs use HTTPS. BeatOnStep neither requests nor stores your Google password. Access and refresh tokens are stored in the app's private on-device storage (AsyncStorage application storage, not represented as a dedicated hardware security vault). Normal Google API requests go directly from the app to Google; tokens are not sent to the BeatOnStep server for importing or playback.
- **Limited sharing:** imported playlist names, identifiers, and BPM values are not published to the BeatOnStep catalogue, sold, or used for advertising. The server may receive only a pseudonymous count of imported playlists, without Google account identifiers or track details (§ 3.9). A voluntary technical support report may contain track identifiers but never OAuth tokens (§ 3.11).
- **Retention:** tokens remain locally stored while YouTube stays connected (and may be refreshed as needed), and are deleted when you disconnect; uninstalling removes the app's local data. Previously imported track metadata and BPM values remain in your local library until you delete them in the app or uninstall; disconnecting does not automatically delete previously imported tracks. BeatOnStep does not retain a permanent server-side copy of your Google music library.
- **Deletion and withdrawal:** you can disconnect YouTube in BeatOnStep, delete imported playlists/tracks from your library, and revoke BeatOnStep's access from [your Google Account](https://myaccount.google.com/connections). Revocation stops future access but does not itself erase locally imported data. Google's own policies and controls apply to information Google holds in your YouTube account.

**Google/YouTube data protection (additional details):** permissions are requested only when you connect YouTube or voluntarily enable playlist creation. The read-only grant does not let BeatOnStep create a playlist; that action requires a separate additional consent. OAuth uses PKCE (S256), and Google API communications use HTTPS. The app never receives your Google password. Tokens are kept in the app's private on-device application storage (AsyncStorage): **this is not a dedicated hardware vault or a claim of dedicated encryption**. They are not sent to the BeatOnStep server for the YouTube library, are excluded from diagnostic reports, and are removed from the local session when you disconnect. Imported playlist names and identifiers remain local unless you expressly trigger a permitted sharing action (§ 3.4, § 3.11). You can also revoke access from your Google Account. Google user data is not used for advertising or AI model training.

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

To evaluate import usage and improve the product, BeatOnStep may occasionally send the publisher's server a **minimal snapshot** containing:

- a random BeatOnStep installation identifier;
- the platform (iOS / Android) and app version;
- the **number** of personal playlists still imported for Apple Music, YouTube, Spotify and Deezer.

This is **product analytics** used to understand import usage and guide improvements.

This measurement contains **no playlist name or ID**, track title, artist, OAuth token, music account, audio data, cadence (SPM), or route information. Manually imported tracks and curated BeatOnStep playlists/albums are excluded from the count.

The installation identifier is generated randomly by BeatOnStep. It is not an Apple, Google, Android or music-provider identifier and contains no name, email address, or account identifier. It is used only to associate successive snapshots with the **same BeatOnStep installation**, not to identify the person using the app.

Deletions are reflected in the next snapshot. Sending is limited to at most once per day after a change and, if nothing changes, at most once every 7 days to measure active installations.

The server keeps only the **latest known snapshot per installation** to produce aggregate statistics; it does not keep a detailed history of every submission. The IP address may be processed technically during the HTTPS connection but is not stored in the measurement file.

These data are **not sold, not used for advertising, not used for advertising tracking, and not combined with data from other companies for profiling**.

### 3.10 GPS tracking for runs on iOS, Android and Garmin (optional)

**Phone GPS (when you enable this feature).** When you voluntarily start a run or a distance-based workout with GPS, BeatOnStep may request location access to measure **distance travelled**, calculate pace when available, and advance the workout phases. GPS tracking does not start when the app opens. You can refuse permission; features requiring reliable GPS distance will then be unavailable or limited. Pausing suspends tracking; finishing the workout stops it.

- **On iPhone**, iOS may request location access while the app is in use and the permission needed to continue an active workout while the phone is locked or the app is in the background.
- **On Android**, tracking requires location permission and may use a foreground service with a visible notification during an active workout to continue while the screen is locked. BeatOnStep does not request the separate Android `ACCESS_BACKGROUND_LOCATION` permission.
- **Raw coordinates:** the phone's raw GPS positions are processed temporarily in native memory. They are not saved as a location history or sent to BeatOnStep servers or music services. The module produces aggregate measurements (including distance and elapsed time) and, on iPhone, may generate a **relative, non-geolocated route silhouette** for a recap. Raw positions are cleared from the session once tracking stops.

**Compatible Garmin watches.** If you enable a Garmin watch, it may temporarily transmit run metrics and positions needed for the recap. Raw coordinates received remain in memory during the run; only a relative shape, without latitude or longitude, may be retained locally for a recap or shared graphic.

**Optional sharing.** At your request, a recap, performance card or Strava activity may use **workout results** (for example distance, duration, start time and measurement source). Strava exports send those results through the BeatOnStep API to Strava with your permission; **no raw GPS coordinate sequence is sent**. A shared image may include the relative route silhouette when available. The product analytics in § 3.9 include neither GPS locations nor route data.

### 3.11 Voluntary Bug / feedback diagnostic report

If you use the **Bug / feedback** button in Settings, BeatOnStep asks for confirmation before any transmission. If you choose **Send**, the app sends the same technical report that you can manually share by tapping the app version, together with the message you typed.

This report may include:

- app version, build, runtime and technical delivery information;
- recent diagnostic events related to BeatOnStep operation;
- recent SPM diagnostics, which may contain accelerometer samples and calculated cadence;
- technical states for Garmin / Apple Watch and music integrations (for example availability, playback states, errors, and technical track or device identifiers when already present in the diagnostic);
- the pseudonymous BeatOnStep installation identifier, platform and app version.

Sending is **strictly user-initiated**: no Bug / feedback diagnostic report is transmitted automatically. No password, OAuth token, or music file is included.

The server uses the report only for **technical support and incident diagnosis**. Small reports may be included directly in the support email; larger reports may be attached as a text file. The private support recipient email address is configured only on the server and is not exposed in the app.

## 4. Permissions

### Android

| Permission | Purpose |
|------------|---------|
| `HIGH_SAMPLING_RATE_SENSORS` | Read the accelerometer at high frequency to detect step cadence (SPM). |
| `FOREGROUND_SERVICE` | Run foreground services needed during an active workout. |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Request location access to measure distance for a voluntarily started GPS workout. |
| `FOREGROUND_SERVICE_LOCATION` | Continue GPS tracking during an active workout with a visible notification, including when locked. |
| `FOREGROUND_SERVICE_HEALTH` | Maintain workout and physical-activity measurements during a session. |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Continue audio playback during a session. |
| `WAKE_LOCK` | Prevent the sensor from sleeping during a session. |

### iOS (App Store)

On iOS, **cadence detection** uses the motion sensors (accelerometer) through the native framework, without a dedicated user-facing permission prompt for this sensor access.

Access to the **media library** (Phone music) triggers a standard system permission request when you import music.

For GPS-enabled workouts, iOS may request location access **while using the app** and permission to continue during an active workout with the screen locked. Android uses location permission and a foreground service during the workout (§ 3.10). Tracking never starts merely by opening the app. Garmin watch permissions are separate. BeatOnStep does not access your contacts, camera, or microphone.

## 5. Locally stored data

On your device, in the app's private storage:

- Imported library (paths, BPM, enabled sources).
- Preferences (mode, target ranges, settings, language).
- YouTube access and refresh tokens (when connected; see § 3.4) and Apple Music connection tokens (if connected).
- Spotify tracks or public playlists whose links you pasted (ID, title, entered or detected BPM) — **no** Spotify account token.
- Deezer tracks or public playlists whose links you pasted (ID, metadata, BPM entered, detected, or provided by Deezer) — **no** Deezer account token.
- Random BeatOnStep installation identifier and local state of the playlist-usage measurement (§ 3.9).
- Workout measurements and an optional simplified relative shape from phone/Garmin GPS, when locally retained for a recap (§ 3.10) — **without any raw GPS coordinate history**.

**Uninstalling** the app removes this data. Disconnecting a service (YouTube, Apple Music) deletes the corresponding tokens without uninstalling the app.

## 6. Third-party services

| Service | When | What transits |
|---------|------|---------------|
| **Google / YouTube** | If you connect YouTube or explicitly authorize a playlist export | OAuth, direct playlist/metadata API requests; optional creation of a private playlist on your request (§ 3.4) |
| **Apple / Apple Music** | If you connect Apple Music | Apple sign-in; playlist metadata |
| **Apple (App Store)** | iOS distribution | Managed by Apple under their own terms |
| **Expo** | Automatic | OTA update verification / download |
| **BeatOnStep server** | Catalogue / BPM analysis, pseudonymous usage measurement, and voluntary support | Track list; optional audio file for BPM analysis; playlist counts per source + random installation identifier (§ 3.9); technical Bug / feedback report only after explicit confirmation (§ 3.11) |
| **Spotify** | If you paste a Share link | Public catalogue request (title); opening in the Spotify app. No account sign-in |
| **Deezer** | If you paste a Share link | Public catalogue request (title / duration / sometimes BPM); opening in the Deezer app. No account sign-in |
| **Garmin Connect IQ** | If you pair a Garmin watch and use BeatOnStep during a run | Cadence and run metrics; transient raw GPS positions watch → phone only to locally produce a relative route shape (§ 3.10) |

No advertising SDK, no marketing audience measurement, no integrated social network beyond the connection to services you choose.

## 7. Children

The app is not directed at children under 13 (16 in the EU) and does not knowingly collect data from them.

## 8. Your rights (GDPR / privacy)

- **Local data** (library, settings, tokens): you control it directly in the app or by uninstalling.
- **Google / YouTube account**: disconnect YouTube to delete local connection tokens, delete imported tracks separately or uninstall, and revoke access in [Google Account](https://myaccount.google.com/connections) (see § 3.4).
- **Apple / Apple Music account**: exercise your rights with Apple under their procedures.
- **Spotify**: no BeatOnStep account linked to Spotify; pasted links stay on the device. For your Spotify account, exercise your rights with Spotify.
- **Deezer**: no BeatOnStep account linked to Deezer; pasted links stay on the device. For your Deezer account, exercise your rights with Deezer.
- **BeatOnStep server**: a catalogue account is optional (§ 2). Playlist analytics retain only the latest state per installation, without detailed submission history (§ 3.9). Technical reports are sent only at your request (§ 3.11). For data enquiries, please use the [forum](https://github.com/rafa-create/beatonstep-website/discussions/1).

## 9. Changes

This policy may be updated. The date at the top reflects the latest revision. The current version is available at the address listed on **Google Play** and in the app (*Settings → About*):

**https://beatonstep.app/privacy.html**

**Summary of key changes**

- **October 14, 2026 — version 1.7.2:** clarified iOS/Android workout GPS, related permissions and optional sharing of workout results. Earlier revisions remain available in the [public repository history](https://github.com/rafa-create/beatonstep-website/commits/main/PRIVACY.en.md).

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
[Music credits — Demo mix](https://beatonstep.app/music-credits.html)
