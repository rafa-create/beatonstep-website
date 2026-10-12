import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cardsEnabled, canonicalShareId, publishUniqueWorkout, backfillWorkoutCards,
} from '../worker/cards.js';
import { packState, openPack, claimGift, validGiftToken } from '../worker/pack.js';

test('collection requires explicit activation after manual migration', () => {
  assert.equal(cardsEnabled({}),false);
  assert.equal(cardsEnabled({CARDS_ENABLED:'false'}),false);
  assert.equal(cardsEnabled({CARDS_ENABLED:'true'}),true);
});

test('a matching music sequence reuses the original card without writing or changing creator', async () => {
  const payload={
    p:[['Original phase',300,160]],t:[{p:0,n:'Song',a:'Artist',i:'spotify-one'}],
  };
  let queried=0;
  const db={prepare(sql){
    assert.match(sql,/SELECT share_id FROM workout_cards WHERE fingerprint=/);
    queried++;
    return {bind(fingerprint){assert.match(fingerprint,/^[0-9a-f]{64}$/);return {
      first:async()=>({share_id:18}),
    }}};
  }};
  const result=await publishUniqueWorkout(db,payload,{}, {id:'different-user'});
  assert.deepEqual(result,{id:18,created:false});
  assert.equal(queried,1);
});

test('a historic URL resolves to its original canonical card', async () => {
  const db={prepare(sql){
    assert.match(sql,/workout_card_aliases/);
    return {bind(id){assert.equal(id,46);return {first:async()=>({canonical_share_id:17})}}};
  }};
  assert.equal(await canonicalShareId(db,46),17);
});

test('pack availability depends on real unclaimed stock and the user first-claim limit', async () => {
  const rows=[];
  const db={prepare(sql){
    return {
      first:async()=>{
        if(sql.includes('FROM workout_cards LIMIT'))return null;
        if(sql.includes('FROM workout_card_aliases LIMIT'))return null;
        throw Error(sql);
      },
      bind(...args){
        rows.push({sql,args});
        if(sql.includes('FROM workout_pack_claims'))return {first:async()=>null};
        throw Error(sql);
      },
    };
  }};
  // Separate stock query has no bind parameters.
  db.prepare=sql=>({
    first:async()=>{
      if(sql.includes('COUNT(*)'))return {total:3};
      return null;
    },
    bind:(...args)=>({first:async()=>null}),
  });
  const state=await packState(db,'member-1');
  assert.equal(state.available,true);
  assert.equal(state.remaining,3);
  assert.equal(state.maxPacksPerAccount,1);
});

test('pack opening uses one guarded UPDATE with SQL-driven history and claim', async () => {
  const queries=[];
  const db={prepare(sql){
    queries.push(sql);
    return {
      first:async()=>null,
      bind:(...args)=>({
        first:async()=>{
          if(sql.startsWith('UPDATE workout_cards')) {
            assert.deepEqual(args.slice(0,3),['member-1',args[1],'member-1']);
            return {share_id:9};
          }
          if(sql.startsWith('SELECT name,imports'))return {name:'Séance',imports:42};
          return null;
        }
      }),
    };
  }};
  const response=await openPack(db,'member-1');
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.card.id,1000000000009);
  assert.equal(result.card.imports,42);
  assert.ok(queries.some(sql=>sql.includes('UPDATE workout_cards')&&
    sql.includes('owner_user_id IS NULL')&&sql.includes('NOT EXISTS')));
  assert.ok(!queries.some(sql=>sql.includes('UPDATE shared_items')));
});

test('gift redemption refuses malformed tokens before accessing any DB', async () => {
  const result=await claimGift(null,'user','evil');
  assert.equal(result.status,400);
  assert.equal(validGiftToken('a'.repeat(64)),true);
  assert.equal(validGiftToken('a'.repeat(63)),false);
});

test('backfill scans in historical order and does not delete old shared items', async () => {
  const rows=[
    {id:1,created_at:100,payload_json:JSON.stringify({p:[['A',180,160]],t:[{p:0,n:'Track',a:'Artist'}]})},
    {id:2,created_at:200,payload_json:JSON.stringify({p:[['B',180,161]],t:[{p:0,n:'Track',a:'Artist'}]})},
  ];
  let canonical=null,aliases=0;
  const db={prepare(sql){
    return {bind(...args){
      return {
        all:async()=>({results:rows}),
        first:async()=>{
          if(sql.includes('SELECT share_id FROM workout_cards'))return canonical===null?null:{share_id:canonical};
          if(sql.includes('FROM signed_shares'))return null;
          return null;
        },
        run:async()=>{
          if(sql.includes('INSERT OR IGNORE INTO workout_cards')){canonical=args[0];return {meta:{changes:1}};}
          if(sql.includes('INSERT OR IGNORE INTO workout_card_aliases')){aliases++;return {meta:{changes:1}};}
          throw Error(sql);
        },
      };
    }};
  }};
  const result=await backfillWorkoutCards(db,0,40);
  assert.equal(result.created,1);
  assert.equal(result.aliases,1);
  assert.equal(result.scanned,2);
  assert.equal(aliases,1);
  assert.equal(result.done,true);
});
