import test from 'node:test';
import assert from 'node:assert/strict';
import { workoutMusicSequence, workoutMusicFingerprint,
  workoutCardFingerprint } from '../worker/workout-identity.js';

const original = {
  v: 1, n: 'Premier titre', s: 'spotify',
  p: [['Départ', 300, 150, 140], ['Fin', 600, 170, 160]],
  t: [
    {p: 0, n: 'First Song', a: 'Artist A', b: 140, i: 'spotify-one'},
    {p: 1, n: 'Second Song', a: 'Artist B', b: 170, i: 'spotify-two'},
  ],
};
const clone = x => structuredClone(x);

test('different title, platform, recording IDs, BPM and phase parameters reuse a card', async () => {
  const changed = clone(original);
  changed.n = 'Titre différent';
  changed.s = 'youtube';
  changed.t[0].i = 'youtube-one';
  changed.t[1].i = 'youtube-two';
  changed.p[0][1] = 420;
  changed.p[0][2] = 151;
  changed.t[0].b = 125;
  changed.t[1].b = 193;
  changed.t[0].n = '  FIRST   song  ';
  changed.t[0].a = 'ARTIST A';
  assert.equal(await workoutMusicFingerprint(original), await workoutMusicFingerprint(changed));
});

test('moving a phase boundary without changing playback order does not create a new card', async () => {
  const changed = clone(original);
  changed.t[1].p = 0;
  assert.deepEqual(workoutMusicSequence(original), workoutMusicSequence(changed));
  assert.equal(await workoutMusicFingerprint(original), await workoutMusicFingerprint(changed));
});

test('a replacement, reorder, addition or removal creates a different card', async () => {
  const hash = await workoutMusicFingerprint(original);
  const replacement = clone(original);
  replacement.t[1].n = 'Third Song';
  const reordered = clone(original);
  reordered.t[0].p = 1;
  reordered.t[1].p = 0;
  const added = clone(original);
  added.t.push({p: 1, n: 'Third Song', a: 'Artist C'});
  const removed = clone(original);
  removed.t.pop();
  for (const candidate of [replacement, reordered, added, removed]) {
    assert.notEqual(await workoutMusicFingerprint(candidate), hash);
  }
});

test('refuses to merge cards with missing or incomplete song metadata', async () => {
  for (const payload of [
    {...original, t: []},
    {...original, t: [{p: 0, n: 'Song with no artist', a: ''}]},
    {...original, t: [{p: 99, n: 'Song', a: 'Artist'}]},
  ]) {
    assert.equal(workoutMusicSequence(payload), null);
    assert.equal(await workoutMusicFingerprint(payload), null);
  }
});

test('a GPS musical distance card differs from timed cards and retired V2 challenges', async () => {
  const distance={
    v:3,n:'Endurance 5 km',s:'spotify',goalMode:'distance',targetMeters:5000,
    p:[['Start',1000,145,140,600],['Finish',4000,160,160,1200]],
    t:clone(original.t),
  };
  const hash=await workoutCardFingerprint(distance);
  assert.ok(hash);
  assert.notEqual(hash,await workoutCardFingerprint(original));
  const same=clone(distance);
  same.n='Other name';same.s='youtube';same.p[0][4]=700;
  same.p[1][4]=1100;
  assert.equal(await workoutCardFingerprint(same),hash,
    'estimated music times and title do not change the real goal or the card');
  const tenKm=clone(distance);
  tenKm.p[1][1]=9000;tenKm.targetMeters=10000;
  assert.notEqual(await workoutCardFingerprint(tenKm),hash);
  const changedSong=clone(distance);changedSong.t[0].n='Another track';
  assert.notEqual(await workoutCardFingerprint(changedSong),hash);
  const noArtist=clone(distance);noArtist.t[0].a='';
  assert.equal(await workoutCardFingerprint(noArtist),null);
});
