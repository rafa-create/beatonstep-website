import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSportRecords} from '../worker/sport-records.js';
import {sportCardRulesManifest} from '../worker/sport-card-rules.js';

const canonical=JSON.parse(readFileSync(new URL('../sport-card-rules.json',import.meta.url),'utf8'));
const caps=canonical.capsByDistance['500000'];
const rangeFor=tier=>{
  const i=canonical.tierOrder.indexOf(tier);
  return {min:i===0?1:caps[canonical.tierOrder[i-1]]+1,max:caps[tier]};
};
const now=100000;
const url=query=>new URL('https://beatonstep.app/api/sport/records'+query);
const epoch=(extra={})=>({
  card_id:5,epoch:1,distance_cm:500000,time_unit:'minute',
  sub_value:25,started_at:1000,ended_at:4000,ongoing:0,
  holder_handle:'runner_a',...extra,
});
function mockDb(byTier={},allRows=[],collections=[],mostHeld=[]){
  const queries=[];
  const db={prepare(sql){
    const record={sql,args:[]};queries.push(record);
    return {
      bind(...args){record.args=args;return this;},
      async all(){
        if(sql.includes('COUNT(*) AS cards'))return {results:collections};
        if(sql.includes('COUNT(DISTINCT e.new_owner_id) AS holder_count'))
          return {results:mostHeld};
        if(sql.includes('FROM sport_card_ownership_events e')){
          for(const tier of canonical.tierOrder){
            const {min,max}=rangeFor(tier);
            if(sql.includes(`c.sub_value BETWEEN ${min} AND ${max}`))
              return {results:byTier[tier]||[]};
          }
          return {results:allRows};
        }
        throw Error('Unexpected records SQL: '+sql);
      },
    };
  }};
  return {db,queries};
}

test('longest ownership uses existing epochs, still-running periods and immutable history',async()=>{
  const {db,queries}=mockDb({},[
    epoch({card_id:7,started_at:2000,ended_at:null,ongoing:1,holder_handle:null}),
    epoch({card_id:5,started_at:1000,ended_at:4000,ongoing:0}),
  ],[{holder_handle:'runner_a',cards:2}]);
  const r=await readSportRecords(db,url('?sort=duration'),{now});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.tierRevision,sportCardRulesManifest().revision);
  assert.equal(body.holdings[0].durationMs,98000);
  assert.equal(body.holdings[0].holder,null,'private/deleted owners stay anonymous');
  assert.equal(body.holdings[0].ongoing,true);
  assert.equal(body.holdings[1].durationMs,3000);
  assert.equal(body.holdings[1].difficulty,'expert',
    'the persisted D1 difficulty cannot override official JSON thresholds');
  assert.deepEqual(body.collections,[{holder:'runner_a',cards:2}]);
  assert.equal(queries.length,3);
  assert(queries.every(q=>/^\s*SELECT/i.test(q.sql)));
  assert(!queries.some(q=>/\b(?:DELETE|UPDATE|INSERT|ALTER|DROP|CREATE)\b/i.test(q.sql)),
    'podiums must never modify D1');
  const ownership=queries.find(q=>q.sql.includes('FROM sport_card_ownership_events e'));
  assert.match(ownership.sql,/next.previous_epoch=e.new_epoch/);
  assert.match(ownership.sql,/next.changed_at>=e.changed_at/);
  assert.match(ownership.sql,/c.owner_epoch=e.new_epoch/);
  assert.match(ownership.sql,/p.show_challenges/);
  assert.match(ownership.sql,/ORDER BY \(COALESCE\(next.changed_at,\?\)-e.changed_at\) DESC/);
  assert.deepEqual(ownership.args,[now,now]);
  const publicCollections=queries.find(q=>q.sql.includes('COUNT(*) AS cards'));
  assert.match(publicCollections.sql,/COALESCE\(p\.show_challenges,1\)=1/);
  assert.match(publicCollections.sql,/COUNT\(\*\) AS cards/);
});

test('difficulty-first ranks highest official tier before holding length',async()=>{
  const {db,queries}=mockDb({
    world_elite:[epoch({card_id:9,sub_value:19,started_at:999,ended_at:2999})],
    legend:[epoch({card_id:8,sub_value:21,started_at:900,ended_at:8000})],
    expert:[epoch({card_id:7,sub_value:25,started_at:100,ended_at:80000})],
  },[epoch({card_id:7,sub_value:25,started_at:100,ended_at:80000})]);
  const r=await readSportRecords(db,url('?sort=difficulty'),{now});
  const body=await r.json();
  assert.deepEqual(body.holdings.map(x=>x.difficulty),
    ['world_elite','legend','expert']);
  assert.deepEqual(body.holdings.map(x=>x.cardId),[9,8,7]);
  const sql=queries.filter(q=>q.sql.includes('FROM sport_card_ownership_events e'));
  assert.equal(sql.length,3,'stop after collecting three winners');
  assert(sql.every(q=>!q.sql.includes('c.difficulty')),
    'historical difficulty stored in D1 must never decide the podium');
  assert(sql.every(q=>q.sql.includes('c.sub_value BETWEEN')),
    'every tier filter is built from canonical JSON');
});

test('specific difficulty filters durations using shared JSON predicate',async()=>{
  const {db,queries}=mockDb({
    expert:[epoch({card_id:5,sub_value:25})],
  });
  const response=await readSportRecords(db,url('?sort=duration&level=expert'),{now});
  assert.equal(response.status,200);
  assert.equal((await response.json()).holdings[0].difficulty,'expert');
  assert.equal(queries.filter(q=>q.sql.includes('FROM sport_card_ownership_events e')).length,1);
  assert.match(queries[0].sql,/c.distance_cm=500000/);
  assert.match(queries[0].sql,new RegExp(
    String.raw`c\.sub_value BETWEEN ${rangeFor('expert').min} AND ${rangeFor('expert').max}`));
});

test('invalid filters stop before querying D1, empty podium is supported',async()=>{
  const {db,queries}=mockDb();
  for(const query of ['?sort=wrong','?level=mythical','?level=expert%3BDROP',
    '?sort=difficulty&untrusted=1']){
    const r=await readSportRecords(db,url(query),{now});
    assert.equal(r.status,400,query);
  }
  assert.equal(queries.length,0);
  const response=await readSportRecords(db,url('?sort=duration'),{now});
  assert.deepEqual((await response.json()).holdings,[]);
});

test('privacy-masked collections and anonymized epoch are response-safe',async()=>{
  const {db}=mockDb({},[epoch({holder_handle:'invalid@name'})],
    [{holder_handle:'visible_runner',cards:3},
      {holder_handle:null,cards:40},
      {holder_handle:'private@id',cards:10}]);
  const data=await (await readSportRecords(db,url(''),{now})).json();
  assert.deepEqual(data.collections,[{holder:'visible_runner',cards:3}]);
  assert.equal(data.holdings[0].holder,null);
  assert.doesNotMatch(JSON.stringify(data),
    /email|password|evidence_digest|run_id|current_owner_id|latitude/i);
});


test('holder popularity podium ranks unique historical recipients without D1 writes',async()=>{
  const ranked=[{card_id:5,distance_cm:500000,time_unit:'minute',
    sub_value:25,holder_count:3},{card_id:9,distance_cm:1000000,
      time_unit:'minute',sub_value:60,holder_count:2}];
  const {db,queries}=mockDb({},[],[],ranked);
  const result=await (await readSportRecords(db,url(''),{now})).json();
  assert.deepEqual(result.mostHeldCards,[
    {cardId:5,distanceCm:500000,timeUnit:'minute',subValue:25,holderCount:3},
    {cardId:9,distanceCm:1000000,timeUnit:'minute',subValue:60,holderCount:2},
  ]);
  const sql=queries.find(q=>q.sql.includes('COUNT(DISTINCT e.new_owner_id)'));
  assert.match(sql.sql,/GROUP BY c\.id/);
  assert.match(sql.sql,/ORDER BY holder_count DESC,c\.id ASC LIMIT 3/);
  assert.ok(queries.every(q=>/^\s*SELECT/i.test(q.sql)));
});
