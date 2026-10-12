/**
 * Compact, ordered BPM profile for community Run Mix cards.
 *
 * Each Run Mix track tuple is [providerId, title, artist, album, bpm, durationSec, ...].
 * The height is the music track's known BPM, NOT the runner's cadence or effort.
 * Unknown BPMs remain null (rendered as neutral gaps); never invent a BPM.
 * At most 32 visual buckets to keep long playlists readable on small screens.
 */
export function runMixBpmProfile(tracks) {
  if (!Array.isArray(tracks) || tracks.length < 1 || tracks.length > 250) return null;

  const count = Math.min(32, tracks.length);
  const groups = Array.from({ length: count }, () => ({
    seconds: 0, knownSeconds: 0, bpmWeighted: 0, hasUnknown: false,
  }));
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (!Array.isArray(track)) return null;
    const seconds = typeof track[5] === 'number' && Number.isFinite(track[5]) &&
      track[5] >= 10 && track[5] <= 7200 ? Math.round(track[5]) : 180;
    const bpm = typeof track[4] === 'number' && Number.isFinite(track[4]) &&
      track[4] >= 30 && track[4] <= 320 ? track[4] : null;
    const group = groups[Math.floor(i * count / tracks.length)];
    group.seconds += seconds;
    if (bpm !== null) {
      group.knownSeconds += seconds;
      group.bpmWeighted += bpm * seconds;
    } else {
      group.hasUnknown = true;
    }
  }
  if (groups.every(group => group.knownSeconds === 0)) return null;
  return groups.map(group => [
    group.seconds,
    group.knownSeconds > 0 && !group.hasUnknown
      ? Math.round(group.bpmWeighted / group.knownSeconds) : null,
  ]);
}

/** Existing unsigned Run Mix items have no stored profile_json yet. */
export function legacyRunMixBpmProfile(payloadJson) {
  if (typeof payloadJson !== 'string') return null;
  try {
    const payload = JSON.parse(payloadJson);
    return runMixBpmProfile(payload?.t);
  } catch {
    return null;
  }
}
