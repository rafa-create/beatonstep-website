import test from 'node:test';
import assert from 'node:assert/strict';
import { runMixBpmProfile, legacyRunMixBpmProfile } from '../worker/runmix-profile.js';

const song = (bpm,duration=180) => ['track-id','Title','Artist','Album',bpm,duration];
test('Run Mix BPM graph reflects the musical sequence, never the runner cadence', () => {
  assert.deepEqual(runMixBpmProfile([song(125,200),song(160,300),song(140,210)]), [
    [200,125],[300,160],[210,140]
  ]);
});

test('one-track Run Mix is a flat known BPM segment', () => {
  assert.deepEqual(runMixBpmProfile([song(145,90)]),[[90,145]]);
});

test('unknown track BPMs are visibly unmeasured, not guessed', () => {
  assert.deepEqual(runMixBpmProfile([song(130),song(null),song(155)]),[
    [180,130],[180,null],[180,155],
  ]);
  assert.equal(runMixBpmProfile([song(null),song(null)]),null);
  assert.equal(runMixBpmProfile([song(0)]),null);
  assert.equal(runMixBpmProfile([song(1000)]),null);
});

test('downsampled long lists do not hide an unknown song behind a measured group', () => {
  const tracks=Array.from({length:160},()=>song(140,200));
  tracks[2]=song(null,200);
  const profile=runMixBpmProfile(tracks);
  assert.deepEqual(profile[0],[1000,null]);
  assert.deepEqual(profile[1],[1000,140]);
});

test('unusable duration is a visual width fallback, not a fabricated BPM', () => {
  assert.deepEqual(runMixBpmProfile([song(130,null)]),[[180,130]]);
  assert.deepEqual(runMixBpmProfile([song(130,10000)]),[[180,130]]);
});

test('a long playlist stays within 32 ordered mobile-friendly segments', () => {
  const tracks=Array.from({length:160},(_,index)=>song(100+Math.floor(index/5),200));
  const profile=runMixBpmProfile(tracks);
  assert.equal(profile.length,32);
  assert.deepEqual(profile[0],[1000,100]);
  assert.deepEqual(profile[31],[1000,131]);
});

test('legacy D1 payloads get the same profile without changing their DB rows', () => {
  const payload=JSON.stringify({v:1,t:[song(118,150),song(null,220),song(144,200)]});
  assert.deepEqual(legacyRunMixBpmProfile(payload),[
    [150,118],[220,null],[200,144],
  ]);
  assert.equal(legacyRunMixBpmProfile('{invalid'),null);
  assert.equal(legacyRunMixBpmProfile(null),null);
});

test('invalid or overly long arrays do not render', () => {
  assert.equal(runMixBpmProfile([]),null);
  assert.equal(runMixBpmProfile(new Array(251).fill(song(140))),null);
  assert.equal(runMixBpmProfile([{}]),null);
});
