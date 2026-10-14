import test from 'node:test';
import assert from 'node:assert/strict';
import { workoutMusicSequence, workoutMusicFingerprint, workoutCardFingerprint } from '../worker/workout-identity.js';

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

test('time and distance workouts sharing songs do not merge their public cards',async()=>{
  const timed=await workoutCardFingerprint(original);
  const fiveKm={...original,g:'distance',m:[1000,4000]};
  const tenKm={...original,g:'distance',m:[2000,8000]};
  const a=await workoutCardFingerprint(fiveKm);
  const b=await workoutCardFingerprint(tenKm);
  assert.ok(a&&b);
  assert.notEqual(a,timed,'a time plan is not a GPS-distance session');
  assert.notEqual(b,timed);
  assert.notEqual(a,b,'5 km and 10 km plans retain distinct identities');
  assert.equal(await workoutCardFingerprint({...fiveKm,m:[1000]}),null);
});
