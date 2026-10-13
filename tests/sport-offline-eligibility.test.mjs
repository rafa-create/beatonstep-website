import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateOfflineSportSummary} from '../worker/sport-offline-eligibility.js';

const start=1791900000000;
const run=(source,distance,elapsedMs,extra={})=>({
  distanceSource:source,distanceMeters:distance,
  startedAtMs:start,endedAtMs:start+elapsedMs,...extra,
});
test('a normal Garmin watch 10km, with NO pause event or GPS trace, qualifies',()=>{
  const result=evaluateOfflineSportSummary(
    run('garmin_watch_saved',10000,39*60000+30000));
  assert.equal(result.status,'candidate');
  assert.equal(result.performanceKey,'1000000:minute:40');
  assert.equal(result.source,'garmin_watch_saved');
  assert.equal(result.elapsedIncludesPauses,true);
  assert.equal(result.splitTiming,'conservative_finish');
  assert.equal(result.autoAwarded,false);
});
test('Garmin Connect IQ live and watch stop sources both count in good faith',()=>{
  for(const source of ['garmin_live_recap','garmin_mobile_stop']){
    const result=evaluateOfflineSportSummary(run(source,5000,18*60000+50000));
    assert.equal(result.status,'candidate',source);
    assert.equal(result.distanceCm,500000);
    assert.equal(result.subValue,19);
  }
});
test('normal phone GPS finish also qualifies offline with no mandated pause',()=>{
  const r=run('phone_gps',10000,2400000,{
    durationSeconds:2400,runRoute:null,
  });
  const result=evaluateOfflineSportSummary(r);
  assert.equal(result.status,'candidate');
  assert.equal(result.subValue,41);
});
test('a watch active duration excluding pause must not turn 22m elapsed into sub19',()=>{
  const result=evaluateOfflineSportSummary(run('garmin_watch_saved',5000,22*60000,{
    durationSeconds:18*60,pausedDurationMs:4*60000,
  }));
  assert.equal(result.status,'candidate');
  assert.equal(result.subValue,23);
});
test('missing pause duration and explicit zero pause are BOTH allowed',()=>{
  const missing=evaluateOfflineSportSummary(run('garmin_watch_saved',5000,19*60000));
  const zero=evaluateOfflineSportSummary(run('garmin_watch_saved',5000,19*60000,{
    pausedDurationMs:0,
  }));
  assert.equal(missing.status,'candidate');
  assert.equal(zero.performanceKey,missing.performanceKey);
});
test('never extrapolate 10km split from final 10.1km; use conservative finish',()=>{
  const result=evaluateOfflineSportSummary(run('garmin_watch_saved',10100,39*60000+50000));
  assert.equal(result.status,'candidate');
  assert.equal(result.distanceCm,1000000);
  assert.equal(result.subValue,40);
  assert.equal(result.splitTiming,'conservative_finish');
});
test('a trustworthy local source can supply measured splits without requiring streaming',()=>{
  const result=evaluateOfflineSportSummary(run('garmin_watch_saved',10000,42*60000,{
    sportCrossings:[{distanceCm:1000000,elapsedMs:39*60000+10000}],
  }));
  assert.equal(result.status,'candidate');
  assert.equal(result.subValue,40);
  assert.equal(result.splitTiming,'recorded');
});
test('implausible runs and forged metadata are rejected rather than awarded',()=>{
  assert.equal(evaluateOfflineSportSummary(run('phone_gps',10000,120000)).reason,
    'implausible_average_speed');
  assert.equal(evaluateOfflineSportSummary(run('garmin_watch_saved',5000,600000,{
    pausedDurationMs:700000,
  })).reason,'invalid_pause_duration');
  assert.equal(evaluateOfflineSportSummary(run('manual',10000,2400000)).reason,
    'invalid_summary');
  assert.equal(evaluateOfflineSportSummary(run('garmin_watch_saved',10000,2400000,{
    sportCrossings:[{distanceCm:500000,elapsedMs:1100000}],
  })).reason,'missing_final_split');
});
test('there is no running-time server dependency or telemetry schema',()=>{
  const path=new URL('../worker/account.js',import.meta.url);
  const account=readFileSync(path,'utf8');
  const source=readFileSync(new URL('../worker/sport-offline-eligibility.js',import.meta.url),'utf8');
  assert.doesNotMatch(account,/sportTelemetryRequest|sport\/telemetry|SPORT_TELEMETRY_ENABLED/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sport_telemetry_points/);
  assert.match(source,/garmin_watch_saved/);
  assert.doesNotMatch(source,/INSERT INTO sport_verified_runs/);
});
