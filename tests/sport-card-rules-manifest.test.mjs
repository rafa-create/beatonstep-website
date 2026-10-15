import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
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
  for(const {distanceCm} of SPORT_CARD_DISTANCES){
    if(distanceCm>=rules.ultraStartCm){
      assert.equal(difficultyForSportCard(distanceCm,100000)?.difficulty,'legend');
      assert.equal(rules.capsByDistance[distanceCm],undefined);
      continue;
    }
    const caps=rules.capsByDistance[distanceCm];
    assert.equal(Object.keys(caps).length,7,String(distanceCm));
    if(distanceCm!==40000){
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
