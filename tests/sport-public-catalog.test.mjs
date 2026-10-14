import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicSportCards} from '../worker/sport-public-catalog.js';

const url=path=>new URL('https://beatonstep.app'+path);
const sport={id:17,distance_cm:500000,time_unit:'minute',sub_value:25,
  difficulty:'amateur',created_at:1000,owner_handle:'runner_b'};

function mockDb(overrides={}){
  const queries=[];
  const db={prepare(sql){
    return {bind(...args){
      const item={sql,args};queries.push(item);
      return {
        async first(){
          if(sql.startsWith('SELECT COUNT(*)'))return {total:1};
          if(sql.includes('WHERE c.id=?'))return {...sport,...overrides};
          if(sql.includes('next.changed_at AS ended_at'))
            return {handle:'runner_a',started_at:1000,ended_at:4000};
          if(sql.includes('WHERE e.card_id=? AND e.reason='))
            return {handle:'runner_a'};
          throw Error('Unexpected first query: '+sql);
        },
        async all(){
          if(sql.includes('ORDER BY c.distance_cm'))
            return {results:[{...sport,...overrides}]};
          if(sql.includes('FROM sport_card_ownership_events e'))
            return {results:[
              {reason:'gift_claim',changed_at:4000,
                from_handle:'runner_a',to_handle:'runner_b'},
              {reason:'sport_win',changed_at:1000,
                from_handle:null,to_handle:'runner_a'},
            ]};
          throw Error('Unexpected all query: '+sql);
        },
      };
    }};
  }};
  return {db,queries};
}

test('default view lists only verified world cards without personal identifiers',async()=>{
  const {db,queries}=mockDb();
  const r=await readPublicSportCards(db,url('/api/sport/cards'));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.deepEqual(body.items,[{kind:'challenge',id:17,distanceCm:500000,
    timeUnit:'minute',subValue:25,difficulty:'amateur',
    createdAt:1000,owner:'runner_b',performanceWarning:false}]);
  assert.equal(body.total,1);
  assert.equal(body.page,1);
  assert(queries.every(q=>q.sql.includes('sport_world_cards')),
    'old publishable v2 shared_items must not enter sport catalogue');
  assert.doesNotMatch(JSON.stringify(body),/user_id|owner_id|email|run_id|gps/i);
});

test('SUB 25 includes SUB 25 and faster tiers, descending within the distance',async()=>{
  const {db,queries}=mockDb();
  const r=await readPublicSportCards(db,url(
    '/api/sport/cards?distance=500000&difficulty=amateur&sub=25&page=1'));
  assert.equal(r.status,200);
  const q=queries.find(q=>q.sql.includes('ORDER BY c.distance_cm'));
  assert.match(q.sql,/c\.distance_cm=\?/);
  assert.match(q.sql,/c\.difficulty=\?/);
  assert.match(q.sql,/c\.sub_value<=\?/);
  assert.match(q.sql,/c\.sub_value DESC/);
  assert.deepEqual(q.args,[500000,'amateur',25,0]);
});

test('invalid and unscoped filters cannot enumerate arbitrary values',async()=>{
  const {db,queries}=mockDb();
  for(const query of ['?sub=25','?distance=456','?distance=500000&sub=0',
    '?difficulty=madeup','?page=-1','?distance=500000&sub=1.5']){
    const r=await readPublicSportCards(db,url('/api/sport/cards'+query));
    assert.equal(r.status,400,query);
  }
  assert.equal(queries.length,0);
});

test('holder timeline reveals only public pseudonyms, gift/win motives and dates',async()=>{
  const {db,queries}=mockDb();
  const r=await readPublicSportCards(db,url('/api/sport/cards/17'),{now:5000});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.owner,'runner_b');
  assert.equal(body.firstHolder,'runner_a');
  assert.equal(body.longestHolder,'runner_a');
  assert.equal(body.longestHeldMs,3000);
  assert.deepEqual(body.history,[{reason:'gift_claim',at:4000,
      from:'runner_a',to:'runner_b'},
    {reason:'sport_win',at:1000,from:null,to:'runner_a'}]);
  assert.equal(body.historyHasMore,false);
  assert(queries.some(q=>q.sql.includes('LIMIT 101')));
  assert.doesNotMatch(JSON.stringify(body),/user_id|current_owner_id|run_id|evidence|email/);
});

test('legacy share identifiers and missing sports cards remain distinct',async()=>{
  const {db}=mockDb();
  const r=await readPublicSportCards(db,url('/api/sport/cards/nope'));
  assert.equal(r.status,404);
});

test('owner epoch separates an old flagged performance from a clean gift',async()=>{
  const warned=mockDb({performance_warning:1});
  const r=await readPublicSportCards(warned.db,url('/api/sport/cards'),{
    telemetryEnabled:true,
  });
  assert.equal((await r.json()).items[0].performanceWarning,true);
  const q=warned.queries.find(x=>x.sql.includes('ORDER BY c.distance_cm'));
  assert.match(q.sql,/tr.owner_epoch=c.owner_epoch/);
  const gifted=mockDb({performance_warning:0,owner_handle:'recipient'});
  const clean=await readPublicSportCards(gifted.db,url('/api/sport/cards/17'),{
    telemetryEnabled:true,
  });
  const newHolder=await clean.json();
  assert.equal(newHolder.owner,'recipient');
  assert.equal(newHolder.performanceWarning,false);
});
