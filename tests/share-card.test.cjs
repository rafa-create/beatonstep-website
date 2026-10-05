const assert = require('node:assert/strict');
const card = require('../share-card.js');

const playedTracks = [
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
];
const run = {
  v: 1,
  lang: 'fr',
  shareContext: 'live',
  ppm: 88,
  cadence: 'measured',
  steps: 8,
  title: 'Unrelated playback track',
  artist: 'Not in run',
  trackBpm: 199,
  avgPpm: 164,
  avgMusicBpm: 162,
  sessionSec: 1920,
  runSteps: 4832,
  runDistanceMeters: 12345.6,
  runAveragePaceSecPerKm: 331,
  runAverageHeartRateBpm: 154,
  runMaxHeartRateBpm: 183,
  runDistanceSource: 'garmin_watch_saved',
  trackCount: 2,
  runCadence: 'measured',
  runTracks: playedTracks,
};

assert.equal(card.variants.length, 4);
const ids = ['live-rhythm', 'live-music', 'recap-rhythm', 'recap-track'];
assert.deepEqual(card.variantsFor(run).map(v => v.id), ids);
assert.deepEqual(card.variantsFor({ ...run, shareContext: 'recap' }).map(v => v.id), ids);
assert.deepEqual(card.variants.map(v => v.fr), [
  'Ma cadence',
  'Dans mes oreilles',
  'Ma course',
  'Mon morceau',
]);
assert(card.variants.every(v => v.width === 1080 && v.height === 1350));

const unselected = card.normalize(run);
assert.equal(unselected.selectedTrackIndex, null);
for (const id of ids) {
  const svg = card.render(run, id);
  assert(!svg.includes('Unrelated playback track'), id + ': playback cannot override selection');
  assert(!svg.includes('James Brown'), id + ': no track before selection');
}

for (const context of ['live', 'recap']) {
  for (const index of [0, 1]) {
    const data = { ...run, shareContext: context, selectedTrackIndex: index };
    for (const id of ids) {
      const svg = card.render(data, id);
      assert(svg.includes('MON RYTHME'), id);
      assert(svg.includes(playedTracks[index].artist), id);
      assert(svg.includes(String(playedTracks[index].bpm)), id);
      assert(!svg.includes(playedTracks[1 - index].artist), id + ': other track leaked');
      assert(!svg.includes('Unrelated playback track'), id + ': live playback leaked');
      assert(svg.includes('viewBox="0 0 1080 1350"'));
      assert(svg.includes('#fcea07'));
    }
  }
}

const first = { ...run, selectedTrackIndex: 0 };
const cadence = card.render(first, 'live-rhythm');
assert(cadence.includes('MA CADENCE'));
assert(cadence.includes('88'));
assert(cadence.includes('8 PAS'));
assert(cadence.includes('MORCEAU CHOISI'));
assert(cadence.includes('151 BPM · MORCEAU'));

const music = card.render(first, 'live-music');
assert(music.includes('DANS MES OREILLES'));
assert(music.includes('88 PPM · MA CADENCE'));
assert(music.includes('151'));
assert(music.includes('8 PAS'));

const summary = card.render(first, 'recap-rhythm');
assert(summary.includes('MA COURSE'));
assert(summary.includes('EN MOYENNE'));
assert(summary.includes('164 PPM · 162 BPM'));
assert(summary.includes('32 MIN · 12,35 KM · 5:31 /KM'));
assert(summary.includes('4 832 PAS · 2 MUSIQUES'));
assert(summary.includes('154 BPM FC MOY · 183 BPM FC MAX'));
assert(summary.includes('James Brown'));

const song = card.render(first, 'recap-track');
assert(song.includes('MON MORCEAU'));
assert(song.includes('EN MOYENNE'));
assert(song.includes('164 PPM · 162 BPM'));
assert(song.includes('32 MIN · 12,35 KM · 5:31 /KM'));
assert(song.includes('4 832 PAS · 2 MUSIQUES'));
assert(song.includes('154 BPM FC MOY · 183 BPM FC MAX'));

const target = card.render({
  ...run,
  shareContext: 'recap',
  runCadence: 'target',
  selectedTrackIndex: 1,
}, 'recap-track');
assert(target.includes('164 PPM · 162 BPM'));

const escaped = card.render({
  ...run,
  selectedTrackIndex: 0,
  runTracks: [{
    title: 'A & B <live> 🎵',
    artist: 'Élodie',
    bpm: 145,
    listenedSeconds: 60,
    avgRunnerPpm: 160,
    stepCount: 250,
  }],
}, 'live-rhythm');
assert(escaped.includes('&amp;'));
assert(!escaped.includes('<live>'));
assert(!escaped.includes('<script>'));

const english = card.render({ ...first, lang: 'en' }, 'live-music');
assert(english.includes('MY RHYTHM'));
assert(english.includes('NOW PLAYING'));
assert(english.includes('88 SPM · MY CADENCE'));

const compact = card.render({
  ...first,
  shareContext: 'recap',
  sessionSec: 53,
  visible: {
    music: false,
    duration: true,
    distance: false,
    pace: false,
    steps: false,
    trackCount: true,
    avgPpm: true,
    avgMusicBpm: true,
    averageHeartRate: false,
    maxHeartRate: false,
  },
}, 'recap-rhythm');
assert(compact.includes('53 S'));
assert(compact.includes('2 MUSIQUES'));
assert(compact.includes('164 PPM · 162 BPM'));
assert(!compact.includes('12,35 KM'));
assert(!compact.includes('5:31 /KM'));
assert(!compact.includes('4 832 PAS'));
assert(!compact.includes('James Brown'));

const routed = card.render({
  ...first,
  shareContext: 'recap',
  runRoute: [[0, 700], [250, 200], [600, 500], [1000, 100]],
}, 'recap-rhythm');
assert(routed.includes('data-route="run"'));
assert(routed.includes('stroke="#fcea07"'));
assert.deepEqual(card.normalize({
  ...run,
  runRoute: [[0, 700], [1000, 100]],
}).runRoute, [[0, 700], [1000, 100]]);
assert.equal(card.normalize({
  ...run,
  runRoute: [[43.6, 3.8], [43.7, 3.9]],
}).runRoute, null, 'raw decimal GPS coordinates are rejected');

assert(card.render(first, 'live-rhythm', 'dark').includes('#11140f'));
assert(card.render(first, 'live-rhythm').includes('clip-path="url(#brandLogoClip)"'));

const legacy = card.normalize({
  v: 1,
  shareContext: 'recap',
  avgPpm: 150,
  runSteps: 100,
  trackOfRunTitle: 'Legacy Track',
  trackOfRunArtist: 'Legacy Artist',
  trackOfRunBpm: 149,
});
assert.equal(legacy.runTracks.length, 1);
assert.equal(legacy.runTracks[0].title, 'Legacy Track');
assert.equal(legacy.runTracks[0].avgRunnerPpm, null);
assert.equal(legacy.runTracks[0].stepCount, null);
assert.equal(legacy.runTracks[0].listenedSeconds, null);
assert.equal(legacy.runDistanceMeters, null);
assert.equal(legacy.runAveragePaceSecPerKm, null);
assert.equal(legacy.runAverageHeartRateBpm, null);
assert.equal(legacy.runMaxHeartRateBpm, null);
assert.equal(card.normalize({
  ...run,
  runDistanceMeters: 999999,
  runDistanceSource: 'untrusted',
}).runDistanceMeters, null);
assert.equal(card.normalize({ ...run, runAverageHeartRateBpm: 10 }).runAverageHeartRateBpm, null);
assert.equal(card.normalize({ ...run, runMaxHeartRateBpm: 350 }).runMaxHeartRateBpm, null);

console.log('Four shared story templates, selectable recap fields, Garmin session stats, heart rate and escaping: passed');
