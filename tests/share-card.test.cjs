const assert = require('node:assert/strict');
const card = require('../share-card.js');

const live = {
  v: 1,
  lang: 'fr',
  shareContext: 'live',
  ppm: 88,
  cadence: 'measured',
  trackBpm: 151,
  steps: 8,
  title: "It's A Man's Man's Man's World",
  artist: 'James Brown',
};

const recap = {
  v: 1,
  lang: 'fr',
  shareContext: 'recap',
  ppm: 164,
  cadence: 'measured',
  avgPpm: 164,
  avgMusicBpm: 162,
  sessionSec: 1920,
  runSteps: 4832,
  trackCount: 9,
  runCadence: 'measured',
  runTracks: [
    {
      title: "It's A Man's Man's Man's World",
      artist: 'James Brown',
      bpm: 151,
      listenedSeconds: 181,
      avgRunnerPpm: 166,
      stepCount: 498,
    },
    {
      title: 'Second Track',
      artist: 'Another Artist',
      bpm: 160,
      listenedSeconds: 120,
      avgRunnerPpm: 162,
      stepCount: 322,
    },
  ],
};

assert.equal(card.variants.length, 4);
assert.deepEqual(card.variantsFor(live).map(v => v.id), ['live-rhythm', 'live-music']);
assert.deepEqual(card.variantsFor(recap).map(v => v.id), ['recap-rhythm', 'recap-track']);
assert(card.variants.every(v => v.width === 1080 && v.height === 1350));

const normalizedLive = card.normalize({
  ...live,
  artist: 'Unknown Artist',
  trackBpm: Infinity,
});
assert.equal(normalizedLive.artist, '');
assert.equal(normalizedLive.trackBpm, null);

const liveRhythm = card.render(live, 'live-rhythm');
assert(liveRhythm.includes('EN COURSE'));
assert(liveRhythm.includes('MA CADENCE'));
assert(liveRhythm.includes('88'));
assert(liveRhythm.includes('8 PAS'));
assert(liveRhythm.includes('MORCEAU EN COURS'));
assert(liveRhythm.includes('151 BPM · MORCEAU'));
assert(!liveRhythm.includes('pas détectés'));
assert(!liveRhythm.includes('RYTHME DU MORCEAU'));
assert(!liveRhythm.includes('RÉCAP DE COURSE'));

const liveMusic = card.render(live, 'live-music');
assert(liveMusic.includes('EN COURSE'));
assert(liveMusic.includes('DANS MES OREILLES'));
assert(liveMusic.includes('151'));
assert(liveMusic.includes('MORCEAU'));
assert(liveMusic.includes('88 PPM · MA CADENCE'));
assert(liveMusic.includes('8 PAS'));
assert(!liveMusic.includes('CADENCE ACTUELLE'));

const recapRhythm = card.render(recap, 'recap-rhythm');
assert(recapRhythm.includes('RÉCAP DE COURSE'));
assert(recapRhythm.includes('MA CADENCE'));
assert(recapRhythm.includes('164'));
assert(recapRhythm.includes('MOYENNE'));
assert(recapRhythm.includes('32 MIN · 9 MORCEAUX · 4 832 PAS'));
assert(recapRhythm.includes('162 BPM · MUSIQUE'));
assert(!recapRhythm.includes('EN COURSE'));

const recapTrackEmpty = card.render(recap, 'recap-track');
assert(recapTrackEmpty.includes('RÉCAP DE COURSE'));
assert(recapTrackEmpty.includes('MORCEAU'));
assert(recapTrackEmpty.includes('CHOISIS UN MORCEAU'));

const recapTrack = card.render({ ...recap, selectedTrackIndex: 0 }, 'recap-track');
assert(recapTrack.includes('James Brown'));
assert(recapTrack.includes('151'));
assert(recapTrack.includes('166 PPM · MA MOYENNE'));
assert(recapTrack.includes('3 MIN · 498 PAS'));
assert(!recapTrack.includes('CHOISIS UN MORCEAU'));

const fixedRecapTrack = card.render({
  ...recap,
  runCadence: 'target',
  selectedTrackIndex: 1,
}, 'recap-track');
assert(fixedRecapTrack.includes('162 PPM · CIBLE'));

const escaped = card.render({
  ...live,
  title: 'A & B <live> 🎵',
  artist: 'Élodie',
}, 'live-rhythm');
assert(escaped.includes('&amp;'));
assert(!escaped.includes('<live>'));
assert(!escaped.includes('<script>'));

const english = card.render({ ...live, lang: 'en' }, 'live-music');
assert(english.includes('IN RUN'));
assert(english.includes('NOW PLAYING'));
assert(english.includes('88 SPM · MY CADENCE'));

assert(card.render(live, 'live-rhythm', 'dark').includes('#11140f'));
assert(card.render(live, 'live-rhythm').includes('clip-path="url(#brandLogoClip)"'));

const legacyRecap = card.normalize({
  v: 1,
  lang: 'fr',
  avgPpm: 150,
  sessionSec: 60,
  runSteps: 100,
  trackCount: 1,
  trackOfRunTitle: 'Legacy Track',
  trackOfRunArtist: 'Legacy Artist',
  trackOfRunBpm: 149,
});
assert.equal(legacyRecap.shareContext, 'recap');
assert.equal(legacyRecap.runTracks.length, 1);
assert.equal(legacyRecap.runTracks[0].title, 'Legacy Track');

console.log('4 total variants, 2 per context, recap track picker payload, shortened labels: passed');
