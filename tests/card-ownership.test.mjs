import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  cardsEnabled, requireCardSchema, canonicalShareId, publishUniqueWorkout, backfillWorkoutCards,
} from '../worker/cards.js';
import { packState, openPack, myChallengeAchievements, claimGift, validGiftToken,createGift,giftStatus } from '../worker/pack.js';
import {accountRequest} from '../worker/account.js';

const completeCardSchemaObjects=[
  ...['workout_cards','workout_card_aliases','workout_card_history',
    'workout_pack_claims','workout_card_gifts'].map(name=>({name,type:'table'})),
  ...['workout_card_history_first','workout_card_history_change',
    'workout_card_pack_claim','workout_card_alias_imports']
    .map(name=>({name,type:'trigger'})),
];

test('incomplete D1 migration blocks pack or backfill before any writes', async () => {
  const db={prepare(sql){
    assert.match(sql,/sqlite_master/);
    return {all:async()=>({results:completeCardSchemaObjects.slice(0,3)})};
  }};
  await assert.rejects(()=>requireCardSchema(db),/workout_card_schema_incomplete/);
  await assert.rejects(()=>openPack(db,'u1'),/workout_card_schema_incomplete/);
});

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
    all:async()=>({results:completeCardSchemaObjects}),
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
      all:async()=>({results:completeCardSchemaObjects}),
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

test('only the current owner can issue a gift and issuing does not transfer ownership', async()=>{
  const sqlSeen=[];
  const ownerId='owner-1';
  const db={prepare(sql){
    sqlSeen.push(sql);
    if(sql.includes('sqlite_master'))return {all:async()=>({results:completeCardSchemaObjects})};
    if(sql.startsWith('SELECT share_id FROM workout_cards'))return {
      bind:(id,user)=>({first:async()=>user===ownerId&&id===12?{share_id:12}:null}),
    };
    if(sql.includes('COUNT(*) AS total FROM workout_card_gifts'))return {
      bind:()=>({first:async()=>({total:0})}),
    };
    if(sql.startsWith('INSERT INTO workout_card_gifts'))return {
      bind:(hash,expiry,id,user)=>({
        run:async()=>{
          assert.match(hash,/^[a-f0-9]{64}$/);
          assert.equal(id,12);assert.equal(user,ownerId);
          assert.ok(expiry>Date.now());
          return {meta:{changes:1}};
        },
      }),
    };
    throw Error('unexpected SQL '+sql);
  }};
  const bad=await createGift(db,'different-user',1000000000012);
  assert.equal(bad.status,403);
  const good=await createGift(db,ownerId,1000000000012);
  assert.equal(good.status,200);
  const result=await good.json();
  assert.match(result.url,/^https:\/\/beatonstep\.app\/cadeau\.html#gift=[a-f0-9]{64}$/);
  assert.equal(result.id,1000000000012);
  assert.ok(sqlSeen.some(sql=>sql.includes('WHERE share_id=? AND owner_user_id=?')));
  assert.ok(!sqlSeen.some(sql=>sql.startsWith('UPDATE workout_cards')));
});

test('public gift preview reveals only public card artwork data, not recipient or token',async()=>{
  const db={prepare(sql){
    if(sql.includes('sqlite_master'))return {all:async()=>({results:completeCardSchemaObjects})};
    if(sql.includes('FROM workout_card_gifts g'))return {bind:()=>({
      first:async()=>({share_id:12,name:'Progression',
        duration_sec:2400,expires_at:Date.now()+10000,
        profile_json:JSON.stringify([[600,135],[1200,160],[600,142]])}),
    })};
    throw Error('unexpected SQL '+sql);
  }};
  const answer=await giftStatus(db,'a'.repeat(64));
  assert.equal(answer.status,200);
  const data=await answer.json();
  assert.equal(data.card.id,1000000000012);
  assert.deepEqual(data.card.profile,[[600,135],[1200,160],[600,142]]);
  assert.equal(data.card.name,'Progression');
  assert.equal(data.card.owner,undefined);
  assert.equal(data.token,undefined);
});

test('a legacy workout still displays its real duration-weighted PPM phases',async()=>{
  const db={prepare(sql){
    if(sql.includes('sqlite_master'))return {all:async()=>({results:completeCardSchemaObjects})};
    if(sql.includes('FROM workout_card_gifts g')){
      assert.match(sql,/json_extract\(x\.payload_json/);
      return {bind:()=>({first:async()=>({
        share_id:13,name:'Séance historique',duration_sec:600,
        expires_at:Date.now()+10000,
        // Legacy workout phase schema: label, duration, target PPM, music BPM.
        profile_json:JSON.stringify([
          ['Échauffement',120,132,null],['Effort',360,168,171],
          ['Retour au calme',120,138,null],
        ]),
      })})};
    }
    throw Error('unexpected SQL '+sql);
  }};
  const response=await giftStatus(db,'b'.repeat(64));
  const data=await response.json();
  assert.deepEqual(data.card.profile,[[120,132],[360,168],[120,138]]);
});

test('deleting the owner also revokes their outstanding gift invitations',()=>{
  const account=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  assert.match(account,/DELETE FROM workout_card_gifts WHERE expected_owner_id=\?/);
  assert.ok(account.indexOf('DELETE FROM workout_card_gifts')<
    account.indexOf('DELETE FROM community_users WHERE id=?'));
});

test('gift capacity allows issuing another invitation by retiring one unused code',async()=>{
  let rotated=false,inserted=false;
  const db={prepare(sql){
    if(sql.includes('sqlite_master'))return {all:async()=>({results:completeCardSchemaObjects})};
    return {bind:(...args)=>({
      first:async()=>sql.includes('COUNT(*)')?{total:3}:{share_id:12},
      run:async()=>({meta:{changes:1}}),
    })};
  },batch:async statements=>{
    assert.equal(statements.length,2);
    rotated=true;inserted=true;
    return [{meta:{changes:1}},{meta:{changes:1}}];
  }};
  const response=await createGift(db,'owner-1',1000000000012);
  assert.equal(response.status,200);
  assert.equal(rotated,true);
  assert.equal(inserted,true);
});

test('private challenge achievements survive ownership loss and show no GPS or other identities',async()=>{
  const db={prepare(sql){
    if(sql.includes('sqlite_master'))return {all:async()=>({results:completeCardSchemaObjects})};
    assert.match(sql,/workout_challenge_validations v/);
    assert.match(sql,/workout_challenge_attempts a/);
    assert.match(sql,/json_extract\(s\.payload_json/);
    return {bind:(a,b)=>{
      assert.equal(a,'runner-me');assert.equal(b,'runner-me');
      return {all:async()=>({results:[
        {share_id:41,name:'5 km / 30 min',first_validated_at:1000,
          owner_user_id:'runner-other',win_count:2},
        {share_id:42,name:'10 km / 60 min',first_validated_at:900,
          owner_user_id:'runner-me',win_count:1},
      ]})};
    }};
  }};
  const response=await myChallengeAchievements(db,'runner-me');
  assert.equal(response.status,200);
  const json=await response.json();
  assert.deepEqual(json.items,[
    {id:1000000000041,name:'5 km / 30 min',firstValidatedAt:1000,
      successfulAttempts:2,currentlyOwned:false},
    {id:1000000000042,name:'10 km / 60 min',firstValidatedAt:900,
      successfulAttempts:1,currentlyOwned:true},
  ]);
  assert.equal(JSON.stringify(json).includes('runner-other'),false);
  assert.equal(JSON.stringify(json).includes('latitude'),false);
});

test('challenge achievements need a current browser session or native bearer grant',async()=>{
  const db={prepare(sql){
    assert.match(sql,/SELECT id FROM community_users LIMIT 1/);
    return {first:async()=>null};
  }};
  const env={DB:db,CATALOG_BACKEND:'d1',CARDS_ENABLED:'true'};
  for(const path of ['/api/account/achievements','/api/account/device/achievements']){
    const url=new URL('https://beatonstep.app'+path);
    const res=await accountRequest(new Request(url),env,url);
    assert.equal(res.status,401);
  }
});
