import test from 'node:test';
import assert from 'node:assert/strict';
import {publicRunSummary} from '../worker/public-run-summary.js';

test('public saved session excludes private songs and route',()=>{
  const saved={endedAtMs:1792100000000,durationSeconds:3603,
    distanceMeters:10600,averagePaceSecPerKm:341,workoutName:'SECRET',
    runRoute:[[50,75]],tracks:[{title:'Private song'}]};
  const data=publicRunSummary(JSON.stringify(saved));
  assert.deepEqual(data,{at:1792100000000,durationSeconds:3603,
    distanceMeters:10600,averagePaceSecPerKm:341});
  assert.doesNotMatch(JSON.stringify(data),/SECRET|runRoute|tracks|song/);
});
test('missing distance or pace is not estimated',()=>{
  assert.deepEqual(publicRunSummary({endedAtMs:1792100000000,durationSeconds:1300}),{
    at:1792100000000,durationSeconds:1300,
    distanceMeters:null,averagePaceSecPerKm:null,
  });
});
test('invalid snapshots are never made public',()=>{
  for(const x of ['{',null,[],{}, {endedAtMs:0,durationSeconds:600},
    {endedAtMs:1792100000000,durationSeconds:-1},
    {endedAtMs:1792100000000,durationSeconds:'600'}])
    assert.equal(publicRunSummary(x),null);
});
