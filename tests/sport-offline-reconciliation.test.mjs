import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {reconcileOfflineSportResult}
  from '../worker/sport-offline-reconciliation.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const now=1791900000000;
const summary={
  startedAtMs:now-2370000,endedAtMs:now-1,
  distanceMeters:10000,distanceSource:'garmin_watch_saved',
};
const body=()=>({
  runId:'run-'+summary.startedAtMs+'-'+summary.endedAtMs,
  summary:{...summary},
});
const sqlCalls=()=>{
  const calls=[],state={batches:0,reads:0};
  const db={
    prepare(sql){return {bind(...args){
      const stmt={sql,args};
      calls.push(stmt);
      return {...stmt,async first(){
        state.reads++;
        return {distance_cm:1000000,time_unit:'minute',sub_value:40,
          evidence_digest:calls.find(call=>call.sql.includes('INSERT INTO sport_verified_runs'))?.args[4]};
      }};
    }}},
    async batch(items){
      state.batches++;
      assert.equal(items.length,4);
      return [
        {meta:{changes:1}},
        {results:[{id:17,current_owner_id:null,owner_epoch:0}]},
        {results:[{card_id:17}],meta:{changes:1}},
        {results:[{id:17,current_owner_id:'runner-a',owner_epoch:1,
          difficulty:'expert'}]},
      ];
    },
  };
  return {db,calls,state};
};
test('finish-only Garmin report is authenticated by caller, not via GPS stream',async()=>{
  const {db,calls,state}=sqlCalls();
  const response=await reconcileOfflineSportResult(db,'runner-a',body(),{now});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.performanceKey,'1000000:minute:40');
  assert.equal(result.worldStatus,'confirmed');
  assert.equal(result.awarded,true);
  assert.equal(result.acquisition,'created');
  assert.equal(result.difficulty,'expert',
    'the server reports the persisted worldwide card classification');
  assert.equal(state.batches,1);
  assert.match(calls[0].sql,/INSERT INTO sport_world_cards/);
  assert.match(calls[1].sql,/SELECT c.id,c.current_owner_id,c.owner_epoch/);
  assert.match(calls[2].sql,/INSERT INTO sport_verified_runs/);
  assert.match(calls[2].sql,/ON CONFLICT\(user_id,run_id\) DO NOTHING/);
  assert.equal(calls[2].args[0],'runner-a');
  assert.equal(calls[2].args[1],body().runId);
  assert.equal(calls[2].args[6],1000000);
  assert.equal(calls[2].args[8],40);
  assert.equal(calls[2].args[5],'verified_import');
  assert.doesNotMatch(JSON.stringify(calls),/longitude|latitude|playlist/);
});
test('phone GPS without any pause record qualifies as well',async()=>{
  const {db,calls}=sqlCalls();
  const raw=body();raw.summary.distanceSource='phone_gps';
  const response=await reconcileOfflineSportResult(db,'runner-a',raw,{now});
  assert.equal(response.status,200);
  assert.equal(calls[2].args[5],'attested_phone');
});
test('invalid run ID is refused, suspicious running speed still earns a card',async()=>{
  const db={prepare(){throw Error('must not query')}};
  const id=body();id.runId='run-other-123456789';
  assert.equal((await reconcileOfflineSportResult(db,'runner-a',id,{now})).status,400);
  const {db:awardDb}=sqlCalls();
  const suspicious=body();suspicious.summary.startedAtMs=now-2000;
  suspicious.runId='run-'+suspicious.summary.startedAtMs+'-'+suspicious.summary.endedAtMs;
  let queued=null;
  const response=await reconcileOfflineSportResult(awardDb,'runner-a',suspicious,{
    now,onAward:review=>{queued=review;},
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).awarded,true);
  assert.equal(queued.needsWarning,true);
  assert.equal(queued.ownerEpoch,1);
});
test('a different runner can retroactively take a formerly confirmed tier',async()=>{
  const {db}=sqlCalls();
  db.batch=async()=>[
    {meta:{changes:0}},
    {results:[{id:17,current_owner_id:'runner-b',owner_epoch:2}]},
    {results:[{card_id:17}],meta:{changes:1}},
    {results:[{id:17,current_owner_id:'runner-b',owner_epoch:3}]},
  ];
  const response=await reconcileOfflineSportResult(db,'runner-a',body(),{now});
  const result=await response.json();
  assert.equal(result.worldStatus,'lost');
  assert.equal(result.ownerEpoch,3);
  assert.equal(result.acquisition,'superseded');
});
test('an existing worldwide card is stolen when the prior owner differs',async()=>{
  const {db}=sqlCalls();
  db.batch=async()=>[
    {meta:{changes:0}},
    {results:[{id:17,current_owner_id:'runner-b',owner_epoch:2}]},
    {results:[{card_id:17}],meta:{changes:1}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
  ];
  const result=await (await reconcileOfflineSportResult(db,'runner-a',body(),{now})).json();
  assert.equal(result.acquisition,'stolen');
  assert.equal(result.ownerEpoch,3);
  assert.equal(JSON.stringify(result).includes('runner-b'),false,
    'previous owner identity must remain private');
});
test('an existing but abandoned world card is not presented as first created',async()=>{
  const {db}=sqlCalls();
  db.batch=async()=>[
    {meta:{changes:0}},
    {results:[{id:17,current_owner_id:null,owner_epoch:2}]},
    {results:[{card_id:17}],meta:{changes:1}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
  ];
  const result=await (await reconcileOfflineSportResult(db,'runner-a',body(),{now})).json();
  assert.equal(result.acquisition,'unclaimed');
});
test('previously owned or replayed card does not celebrate a fresh capture',async()=>{
  const {db}=sqlCalls();
  db.batch=async()=>[
    {meta:{changes:0}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
    {results:[{card_id:17}],meta:{changes:1}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
  ];
  const first=await (await reconcileOfflineSportResult(db,'runner-a',body(),{now})).json();
  assert.equal(first.acquisition,'already_owned');
  db.batch=async()=>[
    {meta:{changes:0}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
    {results:[],meta:{changes:0}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
  ];
  const replay=await (await reconcileOfflineSportResult(db,'runner-a',body(),{now})).json();
  assert.equal(replay.acquisition,'already_processed');
});
test('replay with changed evidence in the same tier is refused',async()=>{
  const {db}=sqlCalls();
  db.batch=async()=>[
    {meta:{changes:0}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
    {results:[],meta:{changes:0}},
    {results:[{id:17,current_owner_id:'runner-a',owner_epoch:3}]},
  ];
  const original=body();
  const canonical=JSON.stringify([
    'runner-a',original.runId,'1000000:minute:40',
    original.summary.distanceSource,original.summary.startedAtMs,
    original.summary.endedAtMs,original.summary.distanceMeters,
  ]);
  const digest=Buffer.from(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(canonical))).toString('hex');
  const originalPrepare=db.prepare.bind(db);
  db.prepare=sql=>{
    const prepared=originalPrepare(sql);
    if(!sql.includes('SELECT c.distance_cm,c.time_unit,c.sub_value'))return prepared;
    return {bind:()=>({first:async()=>({
      distance_cm:1000000,time_unit:'minute',sub_value:40,evidence_digest:digest,
    })})};
  };
  const changed=body();
  changed.summary.distanceMeters=10001;
  const response=await reconcileOfflineSportResult(db,'runner-a',changed,{now});
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,'run_already_used_for_different_evidence');
});
test('post-finish route stays opt-in; no continuous GPS, raw paths or guest claiming',()=>{
  const account=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  const source=readFileSync(new URL('../worker/sport-offline-reconciliation.js',import.meta.url),'utf8');
  assert.match(account,/path==='\/api\/account\/device\/sport\/reconcile'/);
  assert.match(account,/SPORT_AUTO_AWARDS_ENABLED!=='true'/);
  assert.match(account,/devicePublisher\(db,request\)/);
  assert.doesNotMatch(account,/sport\/telemetry|sportTelemetryRequest/);
  assert.doesNotMatch(source,/evidenceVerified:true|sport_telemetry_points|routeFixes/);
});
