import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {
  SPORT_CARD_DISTANCES,SPORT_CARD_400M_TIERS,SPORT_CARD_TIER_REVISION,
  maxSubMinuteByTier,difficultyForSportCard,sportCardRulesManifest,
} from '../worker/sport-card-rules.js';

test('public rule snapshot derives from the SAME logic that awards world cards',()=>{
  const rules=sportCardRulesManifest();
  assert.equal(rules.schema,1);
  assert.equal(rules.revision,SPORT_CARD_TIER_REVISION);
  assert.equal(rules.ruleset,'sport-cards-v1');
  assert.deepEqual(rules.distancesCm,SPORT_CARD_DISTANCES.map(x=>x.distanceCm));
  assert.deepEqual(rules.capsByDistance[40000],
    SPORT_CARD_400M_TIERS.map(x=>x.maxSubSecond));
  assert.equal(rules.ultraStartCm,4300000);
  assert.equal(rules.ultraDifficulty,'legend');
  for(const {distanceCm} of SPORT_CARD_DISTANCES){
    if(distanceCm>=rules.ultraStartCm){
      assert.equal(difficultyForSportCard(distanceCm,100000)?.difficulty,'legend');
      assert.equal(rules.capsByDistance[distanceCm],undefined);
      continue;
    }
    const caps=rules.capsByDistance[distanceCm];
    assert.equal(caps.length,7,String(distanceCm));
    if(distanceCm!==40000){
      const source=maxSubMinuteByTier(distanceCm);
      assert.deepEqual(caps,rules.tierOrder.map(tier=>source[tier]));
    }
    let previous=0;
    for(let i=0;i<caps.length;i++){
      assert.ok(caps[i]>previous,String(distanceCm));
      assert.equal(difficultyForSportCard(distanceCm,caps[i])?.difficulty,
        rules.tierOrder[i],String(distanceCm));
      previous=caps[i];
    }
    assert.equal(difficultyForSportCard(distanceCm,previous+1),null);
  }
  assert.equal(rules.capsByDistance[4219500][2],210,
    'marathon Expert uses the canonical anchor until an exact override');
  assert.equal(rules.capsByDistance[1000000][6],91);
});

test('read-only GET /api/sport/rules works without DB or feature flags',async()=>{
  const request=new Request('https://beatonstep.app/api/sport/rules');
  const response=await worker.fetch(request,{},null);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),sportCardRulesManifest());
  const reject=await worker.fetch(new Request(request.url,{method:'POST'}),{},null);
  assert.equal(reject.status,405);
});
