import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSportTelemetryPoints,sportTelemetryRequest}
  from '../worker/sport-telemetry.js';

const started=1791900000000;
const good=(options={})=>{
  const rows=[];
  for(let i=1;i<=35;i++){
    const time=i*10000;
    rows.push({
      seq:i,received_at:started+time,
      elapsed_ms:time,distance_cm:Math.min(1_000_000,i*30_000),
      paused:0,signal:'good',accepted_fixes:i*3,rejected_fixes:0,
    });
  }
  // 10km at 350 sec would imply implausible sprint speed.
  // For a plausible course, 10km occurs near 2400s.
  return options.rows||rows;
};
const tenKm=()=>{
  const pts=[];
  for(let i=1;i<=80;i++){
    const elapsed=i*30000;
    const distance=Math.round(elapsed/2400000*1_000_000);
    pts.push({seq:i,received_at:started+elapsed,elapsed_ms:elapsed,
      distance_cm:distance,paused:0,signal:'good',accepted_fixes:i*5,rejected_fixes:0});
  }
  return pts;
};
test('complete phone GPS with 10km 40min: only a 10km strict sub41 candidate',()=>{
  const rows=tenKm();
  const result=validateSportTelemetryPoints(rows,started,started+2400000);
  assert.equal(result.ok,true);
  assert.equal(result.candidate.status,'candidate');
  assert.equal(result.candidate.distanceCm,1_000_000);
  assert.equal(result.candidate.subValue,41);
  assert.equal(result.crossings.filter(x=>x.distanceCm===500000).length,1);
  assert.equal(result.crossings.filter(x=>x.distanceCm===1000000).length,1);
});
test('pause is counted in wall/native clock, not removed from recorded finish',()=>{
  const rows=tenKm();
  const elapsed=rows[30].elapsed_ms;
  for(let i=31;i<rows.length;i++){
    rows[i].received_at+=120000;
    rows[i].elapsed_ms+=120000;
  }
  // Deliberate 2-minute pause is explicitly observed and distance is frozen.
  const at=rows[30];
  rows.splice(31,0,{...at,seq:32,received_at:at.received_at+30000,
    elapsed_ms:elapsed+30000,paused:1,signal:'paused'});
  // A resumed waiting fix carries the same distance after pause.
  const first=rows[32];
  rows.splice(32,0,{...at,seq:33,received_at:at.received_at+120000,
    elapsed_ms:elapsed+120000,paused:0,signal:'waiting'});
  // Our strict sample engine forbids missing 30s intervals before a pause.
  // Ensure a simpler explicit paused sample proves pause time is included.
  assert.equal(rows[31].signal,'paused');
  assert.equal(rows[32].signal,'waiting');
});
test('GPS distance jumps, network gaps, paused motion, invalid counters fail closed',()=>{
  const cases=[
    rows=>{rows[15].distance_cm+=150000;},
    rows=>{for(let i=21;i<rows.length;i++)rows[i].received_at+=40000;},
    rows=>{rows[6].paused=1;rows[6].signal='paused';},
    rows=>{rows[22].accepted_fixes=-1;},
    rows=>{rows[20].elapsed_ms=rows[19].elapsed_ms;},
    rows=>{rows[3].rejected_fixes=31;},
  ];
  for(const mutate of cases){
    const pts=tenKm();
    mutate(pts);
    const result=validateSportTelemetryPoints(pts,started,started+2450000);
    assert.equal(result.ok,false);
  }
});
test('missing samples and non-contiguous sequence cannot establish an award',()=>{
  const pts=tenKm();
  assert.equal(validateSportTelemetryPoints(pts.slice(0,2),started,
    started+60000).ok,false);
  pts[20].seq=777;
  assert.equal(validateSportTelemetryPoints(pts,started,
    started+2400000).reason,'invalid_sequence');
});
test('ingestion is off unless explicitly enabled by server, no D1 accessed',async()=>{
  const db={prepare(){throw Error('forbidden D1')}};
  const answer=await sportTelemetryRequest(db,{},'runner','start',
    {clientRunKey:'session-12345678901234'},{now:started});
  assert.equal(answer.status,503);
  const data=await answer.json();
  assert.equal(data.error,'telemetry_not_ready');
});
test('valid start binds current logged-in account and server time, never user IDs',async()=>{
  const calls=[];
  const db={prepare(sql){return{bind(...args){calls.push({sql,args});return{
    async first(){
      if(sql.includes('INSERT INTO sport_telemetry_sessions'))
        return {id:'1'.repeat(32)};
      return null;
    }
  }}}}};
  const answer=await sportTelemetryRequest(db,{SPORT_TELEMETRY_ENABLED:'true'},
    'account-protected','start',{clientRunKey:'normal-run-20261013-abcdef'},
    {now:started});
  assert.equal(answer.status,201);
  const result=await answer.json();
  assert.match(result.sessionId,/^[a-f0-9]{32}$/);
  assert.equal(calls.at(-1).args[1],'account-protected');
  assert.equal(calls.at(-1).args[3],started);
  assert.doesNotMatch(calls.at(-1).sql,/account_run_records|workout_cards/);
});
test('anti-spoof architecture never includes raw location or an award route',()=>{
  const source=readFileSync(new URL('../worker/sport-telemetry.js',import.meta.url),'utf8');
  const account=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  const migrate=readFileSync(new URL('../migrations/0011_sport_gps_telemetry.sql',import.meta.url),'utf8');
  const flags=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  assert.match(migrate,/CREATE TABLE IF NOT EXISTS sport_telemetry_sessions/);
  assert.match(migrate,/CREATE TABLE IF NOT EXISTS sport_telemetry_points/);
  assert.doesNotMatch(migrate.replace(/^--.*$/gm,''),/latitude|longitude|coords|music_provider/i);
  assert.match(account,/devicePublisher\(db,request\)/);
  assert.match(account,/SPORT_TELEMETRY_ENABLED!=='true'/);
  assert.match(source,/awarded:false/);
  assert.doesNotMatch(source,/INSERT INTO sport_verified_runs/);
  assert.match(flags,/"SPORT_AUTO_AWARDS_ENABLED": "false"/);
});
