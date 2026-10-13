import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSportWorldCollection} from '../worker/sport-world-collection.js';

const base='https://beatonstep.app';
const url=path=>new URL(base+path);
const compact=(db)=>({prepare(sql){db.sql=sql;return {bind(...args){
  db.params=args;return {async all(){return {results:db.rows||[]}}};
}}}});
test('world sport migration is ADDITIVE and never touches musical cards',()=>{
  const sql=readFileSync(new URL('../migrations/0008_sport_world_cards.sql',import.meta.url),'utf8');
  for(const table of ['sport_world_cards','sport_verified_runs',
    'sport_card_achievements','sport_card_ownership_events']){
    assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+table));
  }
  assert.match(sql,/UNIQUE\(distance_cm,time_unit,sub_value\)/);
  assert.match(sql,/PRIMARY KEY\(user_id,run_id\)/);
  assert.match(sql,/new_epoch=previous_epoch\+1/);
  assert.doesNotMatch(sql,/\b(?:DROP|ALTER|DELETE FROM|UPDATE)\s+(?:TABLE\s+)?(?:workout_cards|shared_items)/i);
});
test('sport deck ranks true possession, gift-after-personal validation and ghosts independently',async()=>{
  const started=1_790_000_000_000,lost=started+23*86400_000;
  const sample=(id,extra)=>({
    id,distance_cm:1_000_000,time_unit:'minute',sub_value:40,
    difficulty:'expert',owner_since:null,owner_epoch:2,owned:0,
    first_validated_at:null,successful_runs:0,last_received_at:null,
    last_received_reason:null,last_lost_at:null,first_gift_at:null,
    verified_after_gift_at:null,...extra,
  });
  const fake={rows:[
    sample(11,{owned:1,owner_since:started,owner_epoch:1,
      first_validated_at:started,successful_runs:1,
      last_received_at:started,last_received_reason:'sport_win'}),
    sample(12,{owned:1,owner_since:started,owner_epoch:1,
      first_gift_at:started,last_received_at:started,
      last_received_reason:'gift_claim',first_validated_at:started+10_000,
      successful_runs:1,verified_after_gift_at:started+10_000}),
    sample(13,{owned:0,last_received_at:started,last_lost_at:lost,
      first_gift_at:started,first_validated_at:started+12_000,
      verified_after_gift_at:started+12_000,successful_runs:1}),
    sample(14,{owned:0,first_validated_at:started,successful_runs:1}),
  ]};
  const response=await readSportWorldCollection(compact(fake),'runner-001',
    url('/api/account/device/sport/deck'));
  assert.equal(response.status,200);
  assert.deepEqual(fake.params.slice(0,8),Array(8).fill('runner-001'));
  assert.equal(fake.params[8],0);
  assert.deepEqual(fake.params.slice(9),Array(3).fill('runner-001'));
  const body=await response.json();
  assert.equal(body.items[0].currentlyOwned,true);
  assert.equal(body.items[0].personallyValidated,true);
  assert.equal(body.items[1].verifiedAfterGiftAt,started+10_000);
  assert.equal(body.items[2].ghost,true);
  assert.equal(body.items[2].heldDurationMs,23*86400_000);
  assert.equal(body.items[3].ghost,false,
    'a verified athletic achievement without ownership is NOT a ghost possession');
  assert.equal(JSON.stringify(body).includes('runner-001'),false,
    'private owner IDs must not be included in the response');
  assert.equal(body.nextCursor,null);
});
test('invalid cursors fail before any D1 query',async()=>{
  const db={prepare(){throw Error('must not query')}};
  for(const path of [
    '/api/account/device/sport/deck?after=%22x%22',
    '/api/account/device/sport/deck?after=-1',
    '/api/account/device/sport/history?beforeAt=1',
    '/api/account/device/sport/history?beforeAt=1&beforeKey=../owner'
  ]){
    const r=await readSportWorldCollection(db,'private-user',url(path));
    assert.equal(r.status,400,path);
  }
});
test('sport timeline merges only the current account ownership and verified runs',async()=>{
  const db={rows:[{happened_at:1790000000000,event_key:'run:run-1',
    card_id:42,event_type:'verified',run_id:'run-1',
    distance_cm:500000,time_unit:'minute',sub_value:19}]};
  const response=await readSportWorldCollection(compact(db),'test-member',
    url('/api/account/device/sport/history'));
  const value=await response.json();
  assert.equal(value.items[0].name,'5 km · SUB 19 min');
  assert.equal(value.items[0].eventType,'verified');
  assert.equal(value.items[0].runId,'run-1');
  assert.deepEqual(db.params.slice(0,4),Array(4).fill('test-member'));
  assert.match(db.sql,/FROM sport_verified_runs r WHERE r.user_id=\?/);
  assert.match(db.sql,/e.previous_owner_id=\? OR e.new_owner_id=\?/);
});

test('world sport API stays read-only, opt-in, and authenticated',()=>{
  const code=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  assert.match(code,/path\.startsWith\('\/api\/account\/device\/sport\/'\) && method==='GET'/);
  assert.match(code,/path\.startsWith\('\/api\/account\/sport\/'\) && method==='GET'/);
  assert.match(code,/SPORT_WORLD_CARDS_ENABLED!=='true'/);
  assert.match(code,/const member=await devicePublisher\(db,request\)/);
  assert.match(code,/const member=await webUser\(db,request\)/);
  assert.doesNotMatch(code,/method==='POST' && path\.startsWith\('\/api\/account\/device\/sport\//);
});
