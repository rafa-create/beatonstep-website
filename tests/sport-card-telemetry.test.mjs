import test from 'node:test';
import assert from 'node:assert/strict';
import {enqueueSportTelemetryReview,processPendingSportTelemetryReviews,
  readSportWarningReasons} from '../worker/sport-card-telemetry.js';

const fake=()=>{
  const statements=[];
  const db={prepare(sql){return {bind(...args){
    statements.push({sql,args});
    return {run:async()=>({meta:{changes:1}})};
  }};}};
  return {db,statements};
};

test('queuing a sporting warning never changes trophy ownership',async()=>{
  const {db,statements}=fake();
  assert.equal(await enqueueSportTelemetryReview(db,3,9,true,{now:2000}),true);
  assert.match(statements[0].sql,/ON CONFLICT\(card_id,owner_epoch\) DO NOTHING/);
  assert.match(statements[0].sql,/e.new_epoch=\?/);
  assert.match(statements[0].sql,/e.reason='sport_win'/);
  assert.deepEqual(statements[0].args,[1,2000,3,9]);
  assert.doesNotMatch(statements[0].sql,/UPDATE sport_world_cards|DELETE FROM sport_world_cards/);
});
test('a gift increments epoch and the next owner never inherits an old warning',async()=>{
  const {db,statements}=fake();
  await processPendingSportTelemetryReviews(db,{now:3000});
  const q=statements[0];
  assert.match(q.sql,/state='pending'/);
  assert.match(q.sql,/WHEN needs_warning=1 THEN 'warning' ELSE 'clear'/);
  assert.doesNotMatch(q.sql,/current_owner_id|owner_epoch/);
  assert.equal(q.args[0],3000);
  assert.doesNotMatch(q.sql,/UPDATE sport_world_cards|INSERT INTO sport_card_ownership_events/);
});

test('explanations are immutable reason codes attached to an award epoch',async()=>{
  const {db,statements}=fake();
  await enqueueSportTelemetryReview(db,9,3,true,{
    now:5000,reasonCodes:['implausible_speed','inconsistent_crossings','nonsense'],
  });
  assert.equal(statements.length,2);
  assert.match(statements[0].sql,/FROM sport_card_ownership_events e/);
  assert.doesNotMatch(statements[0].sql,/current_owner_id/);
  assert.match(statements[1].sql,/sport_card_telemetry_reason_details/);
  assert.match(statements[1].sql,/ON CONFLICT\(card_id,owner_epoch\) DO NOTHING/);
  assert.deepEqual(statements[1].args,[9,3,
    '["implausible_speed","inconsistent_crossings"]']);
  assert.deepEqual(readSportWarningReasons('["implausible_speed","invalid_pause_duration"]'),
    ['implausible_speed','invalid_pause_duration']);
  assert.deepEqual(readSportWarningReasons('invalid JSON'),[]);
});
