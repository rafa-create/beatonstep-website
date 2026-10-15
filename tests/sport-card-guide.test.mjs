import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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
  for(const id of ['time-hours','time-minutes','time-seconds','time-centiseconds']){
    assert.match(page,new RegExp('id="'+id+'"'));
    assert.match(page,new RegExp('for="'+id+'"'),
      'each dropdown has its own accessible label');
  }
  assert.match(page,/role="group" aria-labelledby="chrono-label"/);
  assert.doesNotMatch(page,/id="time-input"/);
  assert.match(page,/sport-card-paliers\.json/);
  assert.match(page,/if\(\$\('distance'\)\.value==='500000'\)/);
});

test('chrono dropdowns preserve hours, minutes, seconds and 400m hundredths',()=>{
  const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new vm.Script(script),'guide JavaScript must parse');
  assert.match(script,/\['time-hours',199,false\]/);
  assert.match(script,/\['time-minutes',59,false\]/);
  assert.match(script,/\['time-seconds',59,true\]/);
  assert.match(script,/\['time-centiseconds',99,false\]/);
  assert.match(script,/\$\('time-centiseconds-part'\)\.hidden=row\.unit!=='second'/);
  assert.match(script,/resetTime\(\);\s*renderThresholds\(\)/,
    'switching distance resets the previous time');
  assert.match(script,/\$\('time-minutes'\)\.value='24'/,
    '5km opens with the existing 24:35 example');
  const source=script.match(/function elapsedFromParts\(hours,minutes,seconds,centiseconds=0\)\{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source,'converter is present');
  const elapsed=new Function(source+'\nreturn elapsedFromParts;')();
  assert.equal(elapsed(0,24,35),24*60_000+35_000);
  assert.equal(elapsed(1,30,0),90*60_000);
  assert.equal(elapsed(0,0,59,80),59_800);
  assert.equal(elapsed(0,1,2,40),62_400);
  assert.equal(elapsed(0,25,0),25*60_000);
  for(const time of [[0,0,0,0],[0,24,60,0],[0,60,0,0],
    [1,30,-1,0],[0,0,59,100],[200,0,0,0]]){
    assert.equal(elapsed(...time),null,'invalid time '+time.join(':'));
  }
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

test('5km sample lands on expert SUB 25 after percentile calibration',()=>{
  const five=json.distances.find(row=>row.distanceCm===500000);
  assert.deepEqual(five.caps,{
    world_elite:19,legend:22,expert:29,intermediate:35,regular:42,
    amateur:51,beginner:57,
  });
  const sub=Math.floor((24*60+35)*1000/60_000)+1;
  assert.equal(sub,25);
  assert.equal(difficultyForSportCard(500000,sub).difficulty,'expert');
  assert.equal(difficultyForSportCard(500000,26).difficulty,'expert');
  assert.equal(difficultyForSportCard(40000,60).difficulty,'world_elite');
  assert.equal(difficultyForSportCard(40000,68).difficulty,'legend');
});
