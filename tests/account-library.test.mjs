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
test('workout creation is atomic, sanitised and never overwrites an existing row',async()=>{
  const calls=[];
  const db={prepare(sql){return {bind(...args){
    calls.push({sql,args});
    return {async first(){return null}};
  }}}};
  const workout={id:'workout-123',name:'Playlist course',source:'spotify',
    segments:[{id:'warm',name:'Échauffement',durationSec:300,targetPpm:130}],
    playlistIds:[],selectedTracks:[{segmentId:'warm',track:{
      title:'Song',id:123,artist:'Artist',source:'spotify',
      filePath:'/private/device/music/a.mp3',spotifyUri:'spotify:track:123',
      password:'not-a-track-field',
    }}]};
  const endpoint='/api/account/device/library/workouts';

  // Revision 0 = INSERT only. An existing or deleted ID cannot be overwritten
  // or resurrected, even if another device created it concurrently.
  const created=await accountLibraryRequest(request(endpoint,'PUT',
    {workout,expectedRevision:0}),db,url(endpoint),'u1');
  assert.equal(created.status,409);
  assert.equal(calls.length,1);
  assert.match(calls[0].sql,/INSERT INTO account_workouts/);
  assert.match(calls[0].sql,/ON CONFLICT\(user_id,workout_id\) DO NOTHING/);
  assert.doesNotMatch(calls[0].sql,/DO UPDATE/);
  assert.deepEqual(calls[0].args.slice(0,2),['u1','workout-123']);
  const safe=JSON.parse(calls[0].args[2]);
  assert.equal(safe.selectedTracks[0].track.spotifyUri,'spotify:track:123');
  assert.equal(safe.selectedTracks[0].track.filePath,undefined);
  assert.equal(safe.selectedTracks[0].track.password,undefined);

  // Revision > 0 = UPDATE with owner, exact revision and tombstone guard.
  const updated=await accountLibraryRequest(request(endpoint,'PUT',
    {workout,expectedRevision:7}),db,url(endpoint),'u1');
  assert.equal(updated.status,409);
  assert.equal(calls.length,2);
  assert.match(calls[1].sql,/UPDATE account_workouts/);
  assert.match(calls[1].sql,/user_id=\? AND workout_id=\? AND revision=\?/);
  assert.match(calls[1].sql,/deleted_at IS NULL/);
  assert.deepEqual(calls[1].args.slice(2),['u1','workout-123',7]);
  assert.equal(JSON.parse(calls[1].args[0]).selectedTracks[0].track.filePath,undefined);
});

test('a current server revision can be updated, but only by the owning account',async()=>{
  const calls=[];
  const db={prepare(sql){return {bind(...args){
    calls.push({sql,args});
    return {async first(){return {revision:8}}};
  }}}};
  const workout={id:'w-1',name:'Progression',source:'local',
    playlistIds:[],segments:[{id:'p1',name:'Départ',durationSec:300,targetPpm:140}]};
  const endpoint='/api/account/device/library/workouts';
  const response=await accountLibraryRequest(request(endpoint,'PUT',
    {workout,expectedRevision:7}),db,url(endpoint),'owner-account');
  assert.deepEqual(await response.json(),{saved:true,revision:8});
  assert.equal(calls[0].args[2],'owner-account');
  assert.equal(calls[0].args[4],7);
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

test('private workout listing counts only the account owner’s saved run records',async()=>{
  const statements=[];
  const db={prepare(sql){return {bind(...args){
    statements.push({sql,args});
    return {async all(){return {results:[{
      workout_id:'workout-local-1',snapshot_json:JSON.stringify({
        id:'workout-local-1',name:'Endurance',source:'local',segments:[],playlistIds:[]
      }),revision:2,updated_at:1790000000000,deleted_at:null,
      completed_count:4
    }]}}};
  }}}};
  const endpoint='/api/account/device/library/workouts';
  const response=await accountLibraryRequest(request(endpoint),db,url(endpoint),'private-runner');
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.items.length,1);
  assert.equal(data.items[0].completedCount,4);
  assert.equal(data.items[0].workoutId,'workout-local-1');
  assert.match(statements[0].sql,/COUNT\(\*\) FROM account_run_records/);
  assert.match(statements[0].sql,/r\.user_id=w\.user_id/);
  assert.match(statements[0].sql,/r\.source_workout_id=w\.workout_id/);
  assert.deepEqual(statements[0].args,['private-runner','']);
});

test('runner may delete only their own saved history entry',async()=>{
  const calls=[];
  const db={prepare(sql){return {bind(...args){
    calls.push({sql,args});return {async first(){return {run_id:args[1]};}};
  }}}};
  const p='/api/account/device/library/runs/run-1791900000000-1791901800000';
  const response=await accountLibraryRequest(request(p,'DELETE'),db,url(p),'owner-A');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{deleted:true});
  assert.match(calls[0].sql,/DELETE FROM account_run_records/);
  assert.match(calls[0].sql,/WHERE user_id=\? AND run_id=\?/);
  assert.doesNotMatch(calls[0].sql,/sport_|workout_cards|shared_items/);
  assert.deepEqual(calls[0].args,['owner-A','run-1791900000000-1791901800000']);
});
test('repeat deletion is idempotent and invalid identifiers are rejected',async()=>{
  const db={prepare(){return {bind(){return {async first(){return null;}};}};}};
  const p='/api/account/device/library/runs/run-1791900000000-1791901800000';
  const gone=await accountLibraryRequest(request(p,'DELETE'),db,url(p),'owner-A');
  assert.deepEqual(await gone.json(),{deleted:false});
  const invalid='/api/account/device/library/runs/invalid%20run';
  const rejected=await accountLibraryRequest(request(invalid,'DELETE'),db,url(invalid),'owner-A');
  assert.equal(rejected.status,404);
});
