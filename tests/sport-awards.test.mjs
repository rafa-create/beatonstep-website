import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {acceptSignedSportReceipt} from '../worker/sport-awards.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const key='development-only-attestation-test-secret-please-never-reuse-in-production';
const now=1791900000000;
const example=()=>({
  userId:'runner-1',runId:'run-20261013-1',completedAt:now-1000,
  evidenceDigest:'a'.repeat(64),evidenceSource:'verified_import',
  finalDistanceCm:1000000,finishedElapsedMs:2450000,
  crossings:[
    {distanceCm:40000,elapsedMs:100000},
    {distanceCm:500000,elapsedMs:1160000},
    {distanceCm:1000000,elapsedMs:2370000},
  ],
});
async function signed(body,timestamp=now,secret=key){
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const data=new TextEncoder().encode('beatonstep-sport-receipt-v1\n'+timestamp+'\n'+body);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',k,data));
  return [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function fakeDb(changes=1){
  const state={batchCount:0,statements:[]};
  const db={
    prepare(sql){return {bind(...args){const entry={sql,args};state.statements.push(entry);return entry;}}},
    async batch(statements){
      state.batchCount++;
      assert.equal(statements.length,2);
      return [
        {meta:{changes:1}},
        {meta:{changes},results:changes?[{card_id:42}]:[]},
      ];
    }
  };
  return {db,state};
}
test('disabled without a private backend secret, even when client asserts verified',async()=>{
  const {db,state}=fakeDb();
  const json=JSON.stringify({...example(),evidenceVerified:true,finalized:true});
  const res=await acceptSignedSportReceipt(db,{},json,now,'a'.repeat(64),{now});
  assert.equal(res.status,'disabled');
  assert.equal(state.batchCount,0);
});
test('rejects unsigned, forged, expired and mutated sport receipts BEFORE D1',async()=>{
  const {db,state}=fakeDb();
  const raw=JSON.stringify(example()),sig=await signed(raw);
  const env={SPORT_ATTESTATION_HMAC_SECRET:key};
  const cases=[
    [raw,now,'a'.repeat(64),now],
    [raw,now,sig,now+300001],
    [raw.replace('run-20261013-1','run-hijacked'),now,sig,now],
    [raw,now-400000,sig,now],
  ];
  for(const [json,at,mac,clock] of cases){
    const result=await acceptSignedSportReceipt(db,env,json,at,mac,{now:clock});
    assert.equal(result.status,'rejected');
  }
  assert.equal(state.batchCount,0);
});
test('valid signed 10km crossing awards ONLY the longest tier in one D1 batch',async()=>{
  const {db,state}=fakeDb();
  const raw=JSON.stringify({...example(),evidenceVerified:false});
  const answer=await acceptSignedSportReceipt(db,
    {SPORT_ATTESTATION_HMAC_SECRET:key},
    raw,now,await signed(raw),{now});
  assert.equal(answer.status,'recorded');
  assert.equal(answer.performanceKey,'1000000:minute:40');
  assert.equal(answer.cardId,42);
  assert.equal(state.batchCount,1);
  assert.equal(state.statements.length,2);
  assert.match(state.statements[0].sql,/INSERT INTO sport_world_cards/);
  assert.match(state.statements[0].sql,/ON CONFLICT\(distance_cm,time_unit,sub_value\)/);
  assert.equal(state.statements[0].args[0],1000000);
  assert.equal(state.statements[0].args[2],40);
  assert.match(state.statements[1].sql,/INSERT INTO sport_verified_runs/);
  assert.match(state.statements[1].sql,/ON CONFLICT\(user_id,run_id\) DO NOTHING/);
  assert.deepEqual(state.statements[1].args.slice(0,2),
    ['runner-1','run-20261013-1']);
  assert.equal(state.statements[1].args[7],1000000);
  assert.equal(state.statements[1].args[9],40);
});
test('replay is a no-op and never increments achievements or steals again',async()=>{
  const {db,state}=fakeDb(0);
  const raw=JSON.stringify(example());
  const answer=await acceptSignedSportReceipt(db,
    {SPORT_ATTESTATION_HMAC_SECRET:key},
    raw,now,await signed(raw),{now});
  assert.equal(answer.status,'replay');
  assert.equal(state.batchCount,1);
});
test('signed but invalid crossings do not award a lower-tier fallback',async()=>{
  const {db,state}=fakeDb();
  const raw=JSON.stringify({...example(),crossings:[
    {distanceCm:40000,elapsedMs:100000},
    {distanceCm:500000,elapsedMs:1160000},
  ]});
  const answer=await acceptSignedSportReceipt(db,
    {SPORT_ATTESTATION_HMAC_SECRET:key},
    raw,now,await signed(raw),{now});
  assert.equal(answer.status,'no_award');
  assert.equal(answer.reason,'missing_final_distance_crossing');
  assert.equal(state.batchCount,0);
});
test('private writer has no client route or embedded attestation secret',()=>{
  const account=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  const index=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
  const source=readFileSync(new URL('../worker/sport-awards.js',import.meta.url),'utf8');
  assert.doesNotMatch(account,/from ['"]\.\/sport-awards\.js/);
  assert.doesNotMatch(index,/from ['"]\.\/sport-awards\.js/);
  assert.match(source,/SPORT_ATTESTATION_HMAC_SECRET/);
  assert.doesNotMatch(source,/EXPO_PUBLIC_/);
  const sql=readFileSync(new URL('../migrations/0010_sport_verified_award_trigger.sql',import.meta.url),'utf8');
  assert.match(sql,/AFTER INSERT ON sport_verified_runs/);
  assert.match(sql,/sport_card_achievements/);
  assert.match(sql,/sport_card_ownership_events/);
  assert.match(sql,/current_owner_id IS NOT NEW.user_id/);
  assert.doesNotMatch(sql,/account_run_records|UPDATE workout_cards/i);
});
