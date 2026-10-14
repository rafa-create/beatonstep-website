import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{validate,publicRow} from '../worker/index.js';
import {publishUniqueWorkout} from '../worker/cards.js';
import {workoutCardType} from '../worker/pack.js';

const rule={v:2,goalMode:'distance',targetMeters:5000,deadlineSec:1800};
const ROOT='https://beatonstep.app';

test('v2 public card metadata is canonical and excludes personal provider, GPS and playlist data',()=>{
  const result=validate('workout',rule);
  assert.equal(result.name,'5 km · 30:00');
  assert.equal(result.source,'mixed');
  assert.equal(result.durationSec,1800);
  assert.equal(result.tracks,0);
  assert.deepEqual(result.canonicalPayload,rule);
  for(const injection of [
    {...rule,latitude:48.85}, {...rule,longitude:2.3},
    {...rule,t:[{n:'secret song'}]}, {...rule,privateToken:'token'},
    {...rule,goalMode:'time'}, {...rule,deadlineSec:1800.5},
  ]){
    assert.equal(validate('workout',injection),null);
  }
});

test('legacy v1 workout validation and source selection remain intact',()=>{
  const v1={v:1,s:'spotify',n:'Original',p:[['Start',300,160]],
    t:[{p:0,n:'Song A',a:'Artist'}]};
  const result=validate('workout',v1);
  assert.equal(result.name,'Original');
  assert.equal(result.source,'spotify');
  assert.equal(result.durationSec,300);
  assert.equal(Object.hasOwn(result,'canonicalPayload'),false);
});

test('distance publish remains disabled by default even with cards enabled',async()=>{
  const data={kind:'workout',payload:rule};
  const request=new Request(ROOT+'/api/shared',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(data),
  });
  const env={CATALOG_BACKEND:'d1',CARDS_ENABLED:'true',
    DB:{prepare(){throw Error('D1 must not be touched when v2 is disabled');}}};
  const response=await worker.fetch(request,env);
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'distance_challenges_not_ready');
});

test('enabled distance publication still requires a signed device grant',async()=>{
  const request=new Request(ROOT+'/api/shared',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({kind:'workout',payload:rule}),
  });
  const env={CATALOG_BACKEND:'d1',CARDS_ENABLED:'true',
    DISTANCE_CHALLENGES_ENABLED:'true',DB:{}};
  const response=await worker.fetch(request,env);
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,'login_required');
});

test('v2 card creation never grants ownership, pack eligibility or achievement to uploader',async()=>{
  let stored=false,statements=[];
  const db={
    prepare(sql){
      return {
        bind(...args){
          return {sql,args,first:async()=>{
            if(sql==='SELECT share_id FROM workout_cards WHERE fingerprint=?'){
              return stored?{share_id:71}:null;
            }
            throw Error('unexpected first SQL '+sql);
          }};
        },
      };
    },
    async batch(entries){
      statements=entries;
      stored=true;
      return [{meta:{last_row_id:71}}];
    },
  };
  const result=await publishUniqueWorkout(db,rule,{
    source:'mixed',name:'5 km · 30:00',durationSec:1800,
    bpm:null,tracks:0,phases:1,profile:null,
  },{id:'uploader-not-winner'});
  assert.deepEqual(result,{id:71,created:true});
  assert.equal(statements.length,4);
  const [shared,card,signed]=statements;
  assert.match(shared.sql,/INSERT INTO shared_items/);
  assert.deepEqual(JSON.parse(shared.args.at(-2)),rule,
    'D1 only stores canonical sporting rule, never a personal playlist');
  assert.match(card.sql,/INSERT OR IGNORE INTO workout_cards/);
  assert.equal(card.args[1],'uploader-not-winner');
  assert.equal(card.args[2],null,'creator does not own a card without a win');
  assert.equal(card.args[3],0,'v2 distance card can never be opened from a random pack');
  assert.equal(card.args[4],'challenge_created');
  assert.equal(card.args[6],null,'no acquired_at before sporting capture');
  assert.match(signed.sql,/signed_shares/);
});

test('v1 uploader still owns a newly published time card',async()=>{
  const payload={v:1,p:[['Start',300,160]],t:[{p:0,n:'Song',a:'Artist'}]};
  let created=false,card=null;
  const db={
    prepare(sql){return {bind(...args){return {sql,args,first:async()=>{
      if(sql==='SELECT share_id FROM workout_cards WHERE fingerprint=?')
        return created?{share_id:44}:null;
      throw Error('unexpected select');
    }};}}},
    async batch(entries){card=entries[1];created=true;return [{meta:{last_row_id:44}}];},
  };
  const result=await publishUniqueWorkout(db,payload,{
    source:'spotify',name:'Time',durationSec:300,bpm:null,
    tracks:1,phases:1,profile:[[300,160]],
  },{id:'creator'});
  assert.deepEqual(result,{id:44,created:true});
  assert.equal(card.args[1],'creator');
  assert.equal(card.args[2],'creator');
  assert.equal(card.args[3],0);
  assert.equal(card.args[4],'created');
});

test('v2 public listing exposes distance and deadline, never a private GPS trace',()=>{
  const row={id:18,kind:'workout',source:'mixed',name:'5 km · 30:00',
    duration_sec:1800,bpm:null,tracks:0,phases:1,
    created_at:12345,views:0,imports:1,payload_v:2,goal_mode:'distance',
    target_meters:5000,deadline_sec:1800};
  const item=publicRow(row);
  assert.equal(item.id,1_000_000_000_018);
  assert.equal(item.goalMode,'distance');
  assert.equal(item.targetMeters,5000);
  assert.equal(item.deadlineSec,1800);
  assert.equal(Object.hasOwn(item,'latitude'),false);
  assert.equal(Object.hasOwn(item,'longitude'),false);
  assert.equal(Object.hasOwn(item,'owner_user_id'),false);
  const time=publicRow({...row,payload_v:1,goal_mode:null});
  assert.equal(time.goalMode,'time');
});

test('published musical 5 km creates an owned session card without a sporting reward',async()=>{
  const music5k={v:1,n:'Endurance 5 km',s:'spotify',g:'distance',
    m:[1000,4000],p:[['Échauffement',300,140,140],['Endurance',900,165,160]],
    t:[{p:0,n:'Song one',a:'Artist one'},
      {p:1,n:'Song two',a:'Artist two'}]};
  const meta=validate('workout',music5k);
  assert.ok(meta);
  assert.equal(meta.goalMode,'distance');
  assert.equal(meta.distanceMeters,5000);
  assert.equal(meta.durationSec,1200);
  assert.equal(meta.tracks,2);
  assert.equal(validate('workout',{...music5k,g:'time'}),null);
  let created=false,storedCard=null,storedShare=null;
  const db={
    prepare(sql){return {bind(...args){return {sql,args,first:async()=>{
      if(sql==='SELECT share_id FROM workout_cards WHERE fingerprint=?')
        return created?{share_id:85}:null;
      throw Error('unexpected SQL '+sql);
    }};}}},
    async batch(entries){
      [storedShare,storedCard]=entries;created=true;
      return [{meta:{last_row_id:85}}];
    },
  };
  const result=await publishUniqueWorkout(db,music5k,meta,{id:'musical-creator'});
  assert.deepEqual(result,{id:85,created:true});
  assert.equal(storedCard.args[1],'musical-creator');
  assert.equal(storedCard.args[2],'musical-creator',
    'the musician owns the card created by their signed publication');
  assert.equal(storedCard.args[4],'created',
    'normal musical card, never a SUB-based sporting challenge');
  assert.deepEqual(JSON.parse(storedShare.args.at(-2)).m,[1000,4000],
    'real GPS phase distances are preserved in the catalogue');
  assert.deepEqual(workoutCardType({workout_goal:'distance',workout_distance_meters:5000}),
    {goalMode:'distance',distanceMeters:5000});
  assert.deepEqual(workoutCardType({workout_goal:null}),{goalMode:'time'});
});
