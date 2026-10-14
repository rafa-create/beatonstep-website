import test from 'node:test';
import assert from 'node:assert/strict';
import {enqueueSportTelemetryReview,processPendingSportTelemetryReviews}
  from '../worker/sport-card-telemetry.js';

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
  assert.match(statements[0].sql,/c.owner_epoch=\?/);
  assert.deepEqual(statements[0].args,[1,2000,3,9]);
  assert.doesNotMatch(statements[0].sql,/UPDATE sport_world_cards|DELETE FROM sport_world_cards/);
});
test('a gift increments epoch and the next owner never inherits an old warning',async()=>{
  const {db,statements}=fake();
  await processPendingSportTelemetryReviews(db,{now:3000});
  const q=statements[0];
  assert.match(q.sql,/c.owner_epoch=sport_card_telemetry_reviews.owner_epoch/);
  assert.match(q.sql,/current_owner_id IS NOT NULL/);
  assert.match(q.sql,/state='pending'/);
  assert.match(q.sql,/THEN 'warning' ELSE 'clear'/);
  assert.equal(q.args[0],3000);
  assert.doesNotMatch(q.sql,/UPDATE sport_world_cards|INSERT INTO sport_card_ownership_events/);
});
