import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeRule,distanceChallengeFingerprint,assessDistanceEvidence} from '../worker/distance-challenge.js';
import {workoutMusicFingerprint,workoutCardFingerprint} from '../worker/workout-identity.js';
const challenge=(meters=5000,deadline=1200)=>({
  v:2,goalMode:'distance',targetMeters:meters,deadlineSec:deadline,
  s:'spotify',p:[['Échauffement',300,150]],t:[{p:0,n:'Song A',a:'Artist A'}],
});
const samples=(perStepMeters,stepSec=30,length=45)=>Array.from({length},(_,i)=>({
  elapsedSec:i*stepSec,distanceMeters:i*perStepMeters,quality:'good',
}));
test('v2 distance identity uses only integer target meters and deadline seconds',async()=>{
  const a=challenge(),b={...challenge(),s:'youtube',n:'Other',
    t:[{p:0,n:'Totally Different Music',a:'New Artist'}],
    p:[['Long',1800,195]]};
  assert.deepEqual(challengeRule(a),{goalMode:'distance',targetMeters:5000,deadlineSec:1200});
  assert.equal(await distanceChallengeFingerprint(a),await distanceChallengeFingerprint(b));
  assert.notEqual(await distanceChallengeFingerprint(a),await distanceChallengeFingerprint(challenge(5000,1500)));
  assert.notEqual(await distanceChallengeFingerprint(a),await distanceChallengeFingerprint(challenge(10000,1200)));
  assert.notEqual(await distanceChallengeFingerprint(a),await workoutMusicFingerprint(a));
  assert.equal(await workoutCardFingerprint(a),await distanceChallengeFingerprint(a));
});
test('v2 invalid or fractional rule is rejected, not rounded or merged',async()=>{
  for(const input of [challenge(5000.1,1200),challenge(5000,1200.5),
    challenge(-1,1200),challenge(5000,0),challenge(5000,90000),
    {...challenge(),v:1},{...challenge(),goalMode:'time'},null]){
    assert.equal(challengeRule(input),null);
    assert.equal(await distanceChallengeFingerprint(input),null);
  }
});
test('v1 music identity stays unchanged after v2 dispatch',async()=>{
  const payload={v:1,s:'spotify',p:[['Start',300,170]],
    t:[{p:0,n:'Old Song',a:'Old Artist'}]};
  assert.equal(await workoutCardFingerprint(payload),await workoutMusicFingerprint(payload));
  const changed={...payload,p:[['Longer',600,140]],s:'youtube'};
  assert.equal(await workoutCardFingerprint(changed),await workoutCardFingerprint(payload));
});
test('completed plausible GPS evidence does not confer an authenticated victory',()=>{
  const result=assessDistanceEvidence(challenge(),{locationSource:'phone_gps',
    samples:samples(150,30,45)});
  assert.equal(result.status,'plausible_win');
  assert.equal(result.elapsedSec,1020);
  assert.equal(Object.hasOwn(result,'winner'),false);
});
test('deadline, gaps, jumps, forged starting distance and missing GPS are fail-closed',()=>{
  const valid={locationSource:'phone_gps',samples:samples(100,30,45)};
  assert.equal(assessDistanceEvidence(challenge(),valid).status,'lost');
  assert.equal(assessDistanceEvidence(challenge(),{...valid,gpsGapSeen:true}).status,'unverified');
  assert.equal(assessDistanceEvidence(challenge(),{...valid,locationSource:'unknown'}).status,'unverified');
  assert.equal(assessDistanceEvidence(challenge(),{...valid,samples:[...valid.samples.slice(0,2),{elapsedSec:60,distanceMeters:20000,quality:'good'}]}).status,'unverified');
  assert.equal(assessDistanceEvidence(challenge(),{...valid,samples:[{elapsedSec:0,distanceMeters:10,quality:'good'},...valid.samples.slice(1)]}).status,'unverified');
  assert.equal(assessDistanceEvidence(challenge(),{...valid,samples:[valid.samples[0],{elapsedSec:150,distanceMeters:400,quality:'good'},...valid.samples.slice(5)]}).status,'unverified');
  assert.equal(assessDistanceEvidence(challenge(),{...valid,samples:valid.samples.map((s,i)=>i===2?{...s,quality:'uncertain'}:s)}).status,'unverified');
  assert.equal(assessDistanceEvidence(challenge(),{...valid,samples:valid.samples.slice(0,3)}).status,'unverified');
});
test('arrival at the deadline counts, later arrival does not',()=>{
  const start={elapsedSec:0,distanceMeters:0,quality:'good'};
  const build=(last)=>Array.from({length:41},(_,i)=>({
    elapsedSec:i*30,distanceMeters:Math.round(i*5000/40),quality:'good',
  })).concat(last?[last]:[]);
  assert.equal(assessDistanceEvidence(challenge(),{locationSource:'phone_gps',samples:build()}).status,'plausible_win');
  assert.equal(assessDistanceEvidence(challenge(),{locationSource:'phone_gps',
    samples:[start,{elapsedSec:30,distanceMeters:110,quality:'good'},{elapsedSec:1230,distanceMeters:5000,quality:'good'}]}).status,'unverified');
});
