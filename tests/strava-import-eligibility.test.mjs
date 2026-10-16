import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyStravaSportImport} from '../worker/strava-import-eligibility.js';

const start=Date.now()-600000;
const base=()=>({
  id:123456789,sport_type:'Run',manual:false,trainer:false,
  athlete:{id:99},start_date:new Date(start).toISOString(),
  elapsed_time:540,distance:1600,max_speed:5,
});
const gps={
  latlng:{data:[[43.3,5.38],[43.301,5.382]]},
  time:{data:[0,540]},
  distance:{data:[0,1600]},
};

test('Strava GPS course can qualify for the 1500m worldwide tier',()=>{
  const result=classifyStravaSportImport(base(),gps);
  assert.equal(result.eligible,true);
  assert.equal(result.distanceMeters,1600);
  assert.equal(result.startedAtMs,start);
  assert.equal(result.endedAtMs,start+540000);
  assert.equal(result.deviceType,'gps');
  assert.deepEqual(result.warningReasons,[]);
});
test('manual activity cannot mint a worldwide card even with GPS-shaped data',()=>{
  assert.deepEqual(classifyStravaSportImport({...base(),manual:true},gps),
    {eligible:false,reason:'manual_activity'});
});
test('missing manual flag is not treated as proof of recorded data',()=>{
  const {manual,...unknown}=base();
  assert.equal(classifyStravaSportImport(unknown,gps).reason,'recording_unknown');
});
test('treadmill recorded by a wearable qualifies without geographic points',()=>{
  const result=classifyStravaSportImport({
    ...base(),trainer:true,device_name:'Garmin Forerunner 265',
  },null);
  assert.equal(result.eligible,true);
  assert.equal(result.deviceType,'stationary_device');
});
test('watch without measurable evidence stays history only',()=>{
  assert.equal(classifyStravaSportImport(base(),null).reason,
    'no_measured_route_or_device');
  assert.equal(classifyStravaSportImport({
    ...base(),trainer:true,device_name:'',
  },null).eligible,false);
});
test('flagged and implausibly fast recorded Strava runs warn',()=>{
  const result=classifyStravaSportImport({...base(),flagged:true,max_speed:21},gps);
  assert.equal(result.eligible,true);
  assert.deepEqual(result.warningReasons,['strava_flagged','implausible_speed']);
  assert.equal(result.peakSpeedKmh,75.6);
});
test('malformed coordinates never become trusted GPS evidence',()=>{
  assert.equal(classifyStravaSportImport(base(),{
    ...gps,latlng:{data:[[200,5],[201,5]]},
  }).eligible,false);
  assert.equal(classifyStravaSportImport(base(),{
    ...gps,time:{data:[5,4]},
  }).eligible,false);
});
test('world awards are separately gated and require server evidence',()=>{
  const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url)));
  const worker=readFileSync(new URL('../worker/strava-world-award.js',import.meta.url),'utf8');
  const account=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  const migration=readFileSync(new URL(
    '../migrations/0015_strava_activity_award_claims.sql',import.meta.url),'utf8');
  assert.equal(wrangler.vars.STRAVA_IMPORT_AWARDS_ENABLED,'false');
  assert.match(worker,/devicePublisher\(env\.DB,request\)/);
  assert.match(worker,/stravaGet\(token/);
  assert.match(worker,/strava_activity_award_claims/);
  assert.match(worker,/already_recorded_beatonstep/);
  assert.match(account,/payload\.summary\?\.distanceSource==='strava_import'/);
  assert.match(migration,/PRIMARY KEY\(athlete_id,activity_id\)/);
});
