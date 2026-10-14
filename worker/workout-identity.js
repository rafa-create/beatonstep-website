import { distanceChallengeFingerprint } from './distance-challenge.js';

// Musical identity of a shared workout, independent of its training parameters
// and streaming platform. This module is deliberately pure and does not write D1.
// v1 is a conservative metadata match, NOT acoustic fingerprinting: a catalogue
// alias/recording-id table will be required to reconcile titles and artists that
// differ across music platforms.

function normalizeMusicLabel(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase()
    : '';
}

/**
 * The song sequence is played phase by phase. A song's phase placement and the
 * number/duration/BPM/PPM of phases must not affect the identity as long as the
 * musical order is identical. Preserve the order of songs inside each phase.
 *
 * Fail closed on unknown titles/artists: merging distinct recordings is worse
 * than temporarily allowing two manually reconcilable cards.
 */
export function workoutMusicSequence(payload) {
  if (!payload || !Array.isArray(payload.p) || !payload.p.length ||
      !Array.isArray(payload.t) || !payload.t.length) return null;

  const tracks = [];
  for (let index = 0; index < payload.t.length; index++) {
    const song = payload.t[index];
    if (!song || !Number.isInteger(song.p) || song.p < 0 || song.p >= payload.p.length) {
      return null;
    }
    const title = normalizeMusicLabel(song.n);
    const artist = normalizeMusicLabel(song.a);
    if (!title || !artist) return null;
    tracks.push({phase: song.p, index, identity: [artist, title]});
  }
  tracks.sort((a, b) => a.phase - b.phase || a.index - b.index);
  return tracks.map(song => song.identity);
}

export async function workoutMusicFingerprint(payload) {
  const tracks = workoutMusicSequence(payload);
  if (!tracks) return null;
  // Version the hash to leave room for a future canonical music registry.
  const bytes = new TextEncoder().encode(JSON.stringify(['workout-music-v1', tracks]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Legacy timed v1 shares stay song-based. A v1 distance *workout* is a
// different playable session even with identical songs, and a 5 km plan is
// not interchangeable with a 10 km plan. Keep both distinct from the v2
// music-free sporting challenge card namespace.
export async function workoutCardFingerprint(payload) {
  if (payload?.v===2) return distanceChallengeFingerprint(payload);
  if (payload?.v===1 && payload?.g==='distance') {
    const tracks=workoutMusicSequence(payload);
    if (!tracks || !Array.isArray(payload.m) ||
        payload.m.length!==payload.p.length ||
        payload.m.some(m=>!Number.isSafeInteger(m)||m<50||m>100000))
      return null;
    const bytes=new TextEncoder().encode(
      JSON.stringify(['workout-music-distance-v1',tracks,payload.m]));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)]
      .map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  if (payload?.v===1 || payload?.v===undefined)
    return workoutMusicFingerprint(payload);
  return null;
}
