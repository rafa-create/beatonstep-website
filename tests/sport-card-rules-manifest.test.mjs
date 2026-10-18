import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {
  SPORT_CARD_DISTANCES,SPORT_CARD_400M_TIERS,SPORT_CARD_TIER_REVISION,
  maxSubMinuteByTier,difficultyForSportCard,sportCardRulesManifest,
} from '../worker/sport-card-rules.js';

test('the static website JSON is the exact tier table used for awards',()=>{
  const rules=sportCardRulesManifest();
  assert.equal(rules.schema,1);
  assert.equal(rules.revision,SPORT_CARD_TIER_REVISION);
  assert.equal(rules.ruleset,'sport-cards-v1');
  assert.equal(rules.difficultyRuleset,'v2');
  assert.equal(rules.percentileCalibration.estimatedPercentileTargets.intermediate,50);
  assert.deepEqual(rules.distancesCm,SPORT_CARD_DISTANCES.map(x=>x.distanceCm));
  assert.deepEqual(rules.tierOrder,
    ['world_elite','legend','expert','intermediate','regular','amateur','beginner']);
  assert.deepEqual(SPORT_CARD_400M_TIERS.map(x=>x.maxSubSecond),
    rules.tierOrder.map(tier=>rules.capsByDistance['40000'][tier]));
  assert.equal(rules.ultraStartCm,4300000);
  assert.equal(rules.ultraDifficulty,'legend');
  assert.deepEqual(rules.secondResolutionDistancesCm,
    [40000,80000,100000,150000,160934]);
  assert.equal(rules.timeUnitByDistance['4219500'],'minute');
  assert.equal(rules.timeUnitByDistance['40000'],'second');
  assert.deepEqual(rules.legacyCapsByDistanceAndUnit['100000'].minute,
    {world_elite:3,legend:5,expert:6,intermediate:7,regular:8,amateur:10,beginner:11});
  for(const distanceCm of rules.distancesCm)
    assert.ok(['minute','second'].includes(rules.timeUnitByDistance[String(distanceCm)]),
      'each distance declares its time unit: '+distanceCm);
  assert.equal(rules.pendingTrackDistancesCm,undefined);
  for(const distanceCm of [80000,100000,150000,160934]){
    assert.equal(rules.distancesCm.includes(distanceCm),true);
    const caps=rules.capsByDistance[String(distanceCm)];
    assert.ok(caps&&Object.keys(caps).length===7);
    assert.equal(maxSubMinuteByTier(distanceCm),null);
    for(const tier of rules.tierOrder)
      assert.ok(Number.isSafeInteger(caps[tier])&&caps[tier]>0);
  }
  for(const {distanceCm} of SPORT_CARD_DISTANCES){
    if(distanceCm>=rules.ultraStartCm){
      assert.equal(difficultyForSportCard(distanceCm,100000)?.difficulty,'legend');
      assert.equal(rules.capsByDistance[distanceCm],undefined);
      continue;
    }
    const caps=rules.capsByDistance[distanceCm];
    assert.equal(Object.keys(caps).length,7,String(distanceCm));
    if(!rules.secondResolutionDistancesCm.includes(distanceCm)){
      assert.deepEqual(caps,maxSubMinuteByTier(distanceCm));
    }
    let previous=0;
    for(const tier of rules.tierOrder){
      assert.ok(caps[tier]>previous,String(distanceCm));
      assert.equal(difficultyForSportCard(distanceCm,caps[tier])?.difficulty,
        tier,String(distanceCm));
      previous=caps[tier];
    }
    assert.equal(difficultyForSportCard(distanceCm,previous+1),null);
  }
  assert.equal(rules.capsByDistance[4219500].expert,230,
    'marathon Expert uses website JSON; change it only there');
  assert.equal(rules.capsByDistance[1000000].beginner,100);
  assert.deepEqual(rules.capsByDistance[100000],{world_elite:150,legend:225,expert:270,intermediate:360,regular:420,amateur:480,beginner:600});
});

test('manual D1 reclassification plan uses the same 44 legacy-unit-compatible v2 rows without changing ownership',()=>{
  const rules=sportCardRulesManifest();
  const sql=execFileSync(process.execPath,
    ['scripts/plan-sport-percentile-backfill.mjs'],{encoding:'utf8'});
  assert.match(sql,/UPDATE sport_world_cards AS c/);
  assert.match(sql,/SET difficulty=/);
  assert.match(sql,/c\.difficulty IS NOT/,'idempotent update on changed labels only');
  assert.doesNotMatch(sql,/UPDATE sport_card_ownership_events|SET current_owner_id|SET owner_epoch|DELETE FROM/);
  for(const [cm,caps] of Object.entries(rules.capsByDistance)
    .filter(([cm])=>![80000,100000,150000,160934].includes(Number(cm)))){
    const literal='('+[Number(cm),...rules.tierOrder.map(t=>caps[t])].join(',')+')';
    assert.ok(sql.includes(literal),'D1 plan must match official limits at '+cm);
  }
  assert.equal((sql.match(/^    \(\d+,/gm)||[]).length,44);
  assert.match(sql,/43-200 km remain unchanged/);
});

test('static website build publishes the exact official file without D1 or Worker',()=>{
  const root=resolve('.');
  const official=readFileSync(resolve(root,'sport-card-rules.json'),'utf8');
  const published=readFileSync(resolve(root,'dist/sport-card-rules.json'),'utf8');
  assert.equal(published,official);
  assert.deepEqual(JSON.parse(published),sportCardRulesManifest());
  const legacyGuide=JSON.parse(readFileSync(
    resolve(root,'dist/sport-card-paliers.json'),'utf8'));
  assert.equal(legacyGuide.distances.find(d=>d.distanceCm===4219500).caps.expert,
    sportCardRulesManifest().capsByDistance[4219500].expert);
});
