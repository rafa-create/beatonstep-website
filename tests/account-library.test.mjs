import test from 'node:test';
import assert from 'node:assert/strict';
import {accountLibraryRequest} from '../worker/account-library.js';

const url=path=>new URL('https://beatonstep.app'+path);
const request=(path,method='GET',payload)=>new Request('https://beatonstep.app'+path,{
  method,headers:payload?{'Content-Type':'application/json'}:{},
  ...(payload?{body:JSON.stringify(payload)}:{})
});
const validSummary=()=>({
  cadence:'measured',startedAtMs:Date.UTC(2026,9,13,14),
  endedAtMs:Date.UTC(2026,9,13,14,30),durationSeconds:1800,
  stepCount:4500,distanceMeters:5000,runRoute:[[0,500],[1000,500]],
  tracks:[{title:'Example',artist:'Demo',listenedSeconds:120,bpm:160}],
  spotifyAccessToken:'THIS_MUST_NEVER_BE_SAVED',
});
test('run archive is private, additive and never a sporting achievement',async()=>{
  let query='',params=[];
  const db={prepare(sql){
    query=sql;
    return {bind(...args){params=args;return {async run(){return {meta:{changes:1}};}}}};
  }};
  const res=await accountLibraryRequest(request('/api/account/device/library/runs','POST',
    {run:{runId:'run-1791900000000-1791901800000',sourceWorkoutId:null,
      summary:validSummary()}}),db,url('/api/account/device/library/runs'),'user-A');
  assert.equal(res.status,201);
  assert.match(query,/INSERT INTO account_run_records/);
  assert.doesNotMatch(query,/workout_cards|challenge_win|workout_card_history/);
  assert.equal(params[0],'user-A');
  assert.equal(params[1],'run-1791900000000-1791901800000');
  const safe=JSON.parse(params[2]);
  assert.equal(safe.distanceMeters,5000);
  assert.deepEqual(safe.runRoute,[[0,500],[1000,500]]);
  assert.equal('spotifyAccessToken' in safe,false);
});
test('client cannot claim a card by uploading won=true',async()=>{
  const db={prepare(){throw Error('Database must never be called')}};
  const invalid=await accountLibraryRequest(request('/api/account/device/library/runs','POST',
    {run:{runId:'a',summary:{cadence:'measured',won:true}}}),
    db,url('/api/account/device/library/runs'),'account');
  assert.equal(invalid.status,400);
});
test('workout creation is optimistic and refuses silently overwriting another revision',async()=>{
  let lastStatement='',lastParams=[];
  const db={prepare(sql){lastStatement=sql;return {bind(...args){
    lastParams=args;return {async first(){return null}}}}}};
  const workout={id:'workout-123',name:'Playlist course',source:'spotify',
    segments:[{id:'warm',name:'Échauffement',durationSec:300,targetPpm:130}],
    playlistIds:[],selectedTracks:[{segmentId:'warm',track:{
      title:'Song',id:123,artist:'Artist',source:'spotify',
      filePath:'/private/device/music/a.mp3',spotifyUri:'spotify:track:123',
      password:'not-a-track-field',
    }}]};
  const r=await accountLibraryRequest(request('/api/account/device/library/workouts','PUT',
    {workout,expectedRevision:0}),db,url('/api/account/device/library/workouts'),'u1');
  assert.equal(r.status,409);
  assert.match(lastStatement,/ON CONFLICT/);
  assert.match(lastStatement,/WHERE account_workouts\.revision=\?/);
  const stored=JSON.parse(lastParams[2]);
  assert.equal(stored.selectedTracks[0].track.filePath,undefined);
  assert.equal(stored.selectedTracks[0].track.password,undefined);
});
test('reading one account uses a user_id parameter not a user-supplied query',async()=>{
  let params;
  const db={prepare(){return {bind(...args){params=args;
    return {async all(){return {results:[]}}}}}}};
  const r=await accountLibraryRequest(request('/api/account/device/library/workouts?after=aa'),
    db,url('/api/account/device/library/workouts?after=aa'),'private-user');
  assert.equal(r.status,200);
  assert.deepEqual(params,['private-user','aa']);
  assert.deepEqual((await r.json()).items,[]);
});
