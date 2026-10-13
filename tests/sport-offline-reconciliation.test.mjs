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
        return {distance_cm:1000000,time_unit:'minute',sub_value:40};
      }};
    }}},
    async batch(items){
      state.batches++;
      assert.equal(items.length,3);
      return [
        {meta:{changes:1}},
        {results:[{card_id:17}],meta:{changes:1}},
        {results:[{id:17,current_owner_id:'runner-a',owner_epoch:1}]},
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
  assert.equal(state.batches,1);
  assert.match(calls[0].sql,/INSERT INTO sport_world_cards/);
  assert.match(calls[1].sql,/INSERT INTO sport_verified_runs/);
  assert.match(calls[1].sql,/ON CONFLICT\(user_id,run_id\) DO NOTHING/);
  assert.equal(calls[1].args[0],'runner-a');
  assert.equal(calls[1].args[1],body().runId);
  assert.equal(calls[1].args[6],1000000);
  assert.equal(calls[1].args[8],40);
  assert.equal(calls[1].args[5],'verified_import');
  assert.doesNotMatch(JSON.stringify(calls),/longitude|latitude|playlist/);
});
test('phone GPS without any pause record qualifies as well',async()=>{
  const {db,calls}=sqlCalls();
  const raw=body();raw.summary.distanceSource='phone_gps';
  const response=await reconcileOfflineSportResult(db,'runner-a',raw,{now});
  assert.equal(response.status,200);
  assert.equal(calls[1].args[5],'attested_phone');
});
test('invalid run ID and impossible average speed never reach D1',async()=>{
  const db={prepare(){throw Error('must not query')}};
  const id=body();id.runId='run-other-123456789';
  assert.equal((await reconcileOfflineSportResult(db,'runner-a',id,{now})).status,400);
  const impossible=body();impossible.summary.distanceMeters=100000;
  assert.equal((await reconcileOfflineSportResult(db,'runner-a',impossible,{now})).status,422);
});
test('a different runner can retroactively take a formerly confirmed tier',async()=>{
  const {db}=sqlCalls();
  db.batch=async()=>[
    {meta:{changes:0}},
    {results:[{card_id:17}],meta:{changes:1}},
    {results:[{id:17,current_owner_id:'runner-b',owner_epoch:3}]},
  ];
  const response=await reconcileOfflineSportResult(db,'runner-a',body(),{now});
  const result=await response.json();
  assert.equal(result.worldStatus,'lost');
  assert.equal(result.ownerEpoch,3);
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
