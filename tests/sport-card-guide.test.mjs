import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPORT_CARD_DISTANCES,SPORT_CARD_400M_TIERS,
  maxSubMinuteByTier,difficultyForSportCard} from '../worker/sport-card-rules.js';

const json=JSON.parse(readFileSync(new URL('../dist/sport-card-paliers.json',import.meta.url),'utf8'));
const page=readFileSync(new URL('../cartes-guide.html',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../partages.html',import.meta.url),'utf8');

test('catalog links to a separate, accessible challenge guide',()=>{
  assert.match(catalog,/id="sport-guide-link" href="cartes-guide\.html\?lang=fr"/);
  assert.match(catalog,/id="sport-guide-label"/);
  assert.match(catalog,/sport-guide-link'\)\.hidden=!sport/);
  assert.match(page,/id="levels-rows"/);
  assert.match(page,/id="threshold-rows"/);
  assert.match(page,/id="individual-rows"/);
  assert.match(page,/id="time-input"/);
  assert.match(page,/sport-card-paliers\.json/);
  assert.match(page,/if\(\$\('distance'\)\.value==='500000'\)/);
});

test('guide JSON covers all 203 canonical sporting distances with no duplicate',()=>{
  assert.equal(json.ruleset,'sport-cards-v1');
  assert.deepEqual(json.levels,
    ['world_elite','legend','expert','intermediate','regular','amateur','beginner']);
  assert.equal(json.distances.length,203);
  assert.deepEqual(json.distances.map(row=>row.distanceCm),
    SPORT_CARD_DISTANCES.map(row=>row.distanceCm));
  assert.equal(new Set(json.distances.map(row=>row.distanceCm)).size,203);
});

test('all public SUB difficulty boundaries agree with the official award engine',()=>{
  for(const entry of json.distances){
    const {distanceCm,caps,unit,ultra}=entry;
    if(ultra){
      assert.equal(distanceCm>=4_300_000,true);
      assert.equal(caps,null);
      assert.equal(unit,'minute');
      for(const sub of [1,75,250,500,1000]){
        assert.equal(difficultyForSportCard(distanceCm,sub)?.difficulty,'legend');
      }
      continue;
    }
    const expected=distanceCm===40_000
      ?Object.fromEntries(SPORT_CARD_400M_TIERS.map(
        ({difficulty,maxSubSecond})=>[difficulty,maxSubSecond]))
      :maxSubMinuteByTier(distanceCm);
    assert.deepEqual(caps,expected,'distance='+distanceCm);
    assert.equal(unit,distanceCm===40_000?'second':'minute');
    let previous=0;
    for(const difficulty of json.levels){
      assert.ok(caps[difficulty]>previous,'ordered caps '+distanceCm+' '+difficulty);
      for(let sub=previous+1;sub<=caps[difficulty];sub++){
        assert.equal(difficultyForSportCard(distanceCm,sub)?.difficulty,
          difficulty,'distance='+distanceCm+' sub='+sub);
      }
      previous=caps[difficulty];
    }
    assert.equal(difficultyForSportCard(distanceCm,previous+1),null);
  }
});

test('5km sample lands on the intermediate SUB 25 card',()=>{
  const five=json.distances.find(row=>row.distanceCm===500000);
  assert.deepEqual(five.caps,{
    world_elite:16,legend:19,expert:22,intermediate:25,regular:28,
    amateur:31,beginner:44,
  });
  const sub=Math.floor((24*60+35)*1000/60_000)+1;
  assert.equal(sub,25);
  assert.equal(difficultyForSportCard(500000,sub).difficulty,'intermediate');
  assert.equal(difficultyForSportCard(500000,26).difficulty,'regular');
  assert.equal(difficultyForSportCard(40000,60).difficulty,'legend');
  assert.equal(difficultyForSportCard(40000,61).difficulty,'expert');
});
