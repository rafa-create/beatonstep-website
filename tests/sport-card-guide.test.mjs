import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {SPORT_CARD_DISTANCES,SPORT_CARD_400M_TIERS,
  maxSubMinuteByTier,difficultyForSportCard} from '../worker/sport-card-rules.js';

const json=JSON.parse(readFileSync(new URL('../dist/sport-card-paliers.json',import.meta.url),'utf8'));
const canonical=JSON.parse(readFileSync(new URL('../sport-card-rules.json',import.meta.url),'utf8'));
const page=readFileSync(new URL('../cartes-guide.html',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../partages.html',import.meta.url),'utf8');

test('challenge guide exposes its essential entry points',()=>{
  assert.match(catalog,/href="cartes-guide\.html\?lang=fr"/);
  assert.match(page,/id="distance"/);
  assert.match(page,/id="calc-card-preview"/);
  assert.match(page,/id="threshold-rows"/);
  assert.match(page,/id="ownership-details"/);
  assert.match(page,/class="challenge-faq"/);
  assert.match(page,/sport-card-paliers\.json/);
  assert.match(page,/<script src="\/sport-card-percentile\.js"><\/script>/);
  assert.match(page,/<script src="\/sport-card-face\.js"><\/script>/);
});

test('generated guide and every difficulty explanation follow the canonical JSON',()=>{
  assert.equal(json.revision,canonical.revision);
  assert.deepEqual(json.levels,canonical.tierOrder);
  assert.equal(json.ultraDifficulty,canonical.ultraDifficulty);
  assert.match(page,/const difficulty=row.ultra\?guide.ultraDifficulty/);
  assert.match(page,/data.ultraDifficulty!==official.ultraDifficulty/);
  assert.deepEqual(json.percentileTargets,
    canonical.percentileCalibration.estimatedPercentileTargets);
  assert.deepEqual(json.distances.map(row=>row.distanceCm),
    [...canonical.distancesCm].sort((a,b)=>a-b));
  for(const row of json.distances){
    assert.equal(row.unit,canonical.timeUnitByDistance[String(row.distanceCm)]||(canonical.timeUnitByDistance[String(row.distanceCm)]||(canonical.secondResolutionDistancesCm.includes(row.distanceCm)?'second':'minute')));
    assert.deepEqual(row.caps,canonical.capsByDistance[String(row.distanceCm)]||null);
  }
  const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const formula=script.match(/  const levelNames=\{[\s\S]*?  const t=\(fr,en\)=>lang==='fr'\?fr:en;/)?.[0];
  assert.ok(formula,'dynamic level explanation methods present');
  const render=new Function('guide','lang',
    formula+';return {tierStars,tierDescription};');
  const officialGuide={levels:[...canonical.tierOrder],
    percentileTargets:{...canonical.percentileCalibration.estimatedPercentileTargets}};
  const base=render(officialGuide,'fr');
  assert.equal(base.tierStars('world_elite'),7);
  assert.equal(base.tierStars('beginner'),1);
  assert.equal(base.tierDescription('expert'),'Environ top 20 % des arrivants');
  const future={...officialGuide,percentileTargets:{}};
  const changed=render(future,'fr');
  assert.equal(changed.tierDescription('expert'),'—');
  assert.equal(changed.tierDescription('beginner'),'Premier palier accessible');
  assert.doesNotMatch(changed.tierDescription('expert'),/Top|20 %|21 %/,
    'the guide does not present unsupported percentile claims while calibration is pending');
});

test('chrono dropdowns preserve hours, minutes and seconds without centiseconds',()=>{
  const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new vm.Script(script),'guide JavaScript must parse');
  assert.match(script,/\['time-hours',199,false\]/);
  assert.match(script,/\['time-minutes',59,false\]/);
  assert.match(script,/\['time-seconds',59,true\]/);
  assert.doesNotMatch(page,/time-centiseconds|Centièmes|Hundredths/,
    'the guide no longer offers hundredths of a second');
  assert.match(script,/const chronoIds=\['time-hours','time-minutes','time-seconds'\]/,
    'switching distance explicitly preserves every chrono field');
  assert.doesNotMatch(script,/resetTime\(\);\s*renderThresholds\(\)/,
    'switching distance must not reset the previous time');
  assert.match(script,/\$\('time-minutes'\)\.value='24'/,
    '5km opens with the existing 24:35 example');
  const source=script.match(/function elapsedFromParts\(hours,minutes,seconds\)\{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source,'converter is present');
  const elapsed=new Function(source+'\nreturn elapsedFromParts;')();
  assert.equal(elapsed(0,24,35),24*60_000+35_000);
  assert.equal(elapsed(1,30,0),90*60_000);
  assert.equal(elapsed(0,25,0),25*60_000);
  for(const time of [[0,0,0],[0,24,60],[0,60,0],
    [1,30,-1],[200,0,0]]){
    assert.equal(elapsed(...time),null,'invalid time '+time.join(':'));
  }
});

test('tier table shows readable percentiles and exact chrono intervals, not SUB-to-SUB ranges',()=>{
  assert.match(page,/\.world-percent\{color:#c8dae9;/,
    'top-percent labels contrast with the dark table without bright yellow');
  assert.match(page,/<span data-fr>Fourchette de temps<\/span>/);
  assert.match(page,/tierTimeRange\(previous,max,row\.unit\)/);
  assert.match(page,/make\('td','time-range',t\('Tout chrono validé'/);
  const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'the guide client script exists');
  const section=script.match(/function timeLabel\(n,unit\)\{[\s\S]*?(?=  function renderLevels\()/)?.[0];
  assert.ok(section,'the shared precise time range formatter exists');
  const getRanges=new Function('lang',
    "const t=(fr,en)=>lang==='fr'?fr:en;"+section+';return tierTimeRange;');
  const fr=getRanges('fr'),en=getRanges('en');
  assert.equal(fr(0,19,'minute'),'Moins de 19 min');
  assert.equal(fr(19,22,'minute'),'De 19 min à moins de 22 min');
  assert.equal(fr(22,29,'minute'),'De 22 min à moins de 29 min');
  assert.equal(fr(67,77,'second'),'De 1 min 07 s à moins de 1 min 17 s');
  assert.equal(fr(0,67,'second'),'Moins de 1 min 07 s');
  assert.equal(en(19,22,'minute'),'19 min to under 22 min');
  assert.doesNotMatch(page,/subLabel\(first,row\.unit\)\+' — '\+subLabel\(max,row\.unit\)/);
  assert.match(page,/make\('td','time-range',tierTimeRange\(previous,max,row\.unit\)\)/,
    'the guide displays readable time intervals for each tier');
  assert.doesNotMatch(page,/make\('td','',subLabel\(n,row\.unit\)\)/,
    'the retired individual SUB listing is not part of the current guide');
});

test('guide awards all 206 distances, including three track specialties',()=>{
  assert.equal(json.ruleset,'sport-cards-v1');
  assert.deepEqual(json.levels,
    ['world_elite','legend','expert','intermediate','regular','amateur','beginner']);
  assert.equal(json.distances.length,206);
  assert.deepEqual(json.distances.filter(row=>!row.previewOnly).map(row=>row.distanceCm),
    SPORT_CARD_DISTANCES.map(row=>row.distanceCm));
  assert.deepEqual(json.distances.filter(row=>row.previewOnly),[]);
  assert.equal(new Set(json.distances.map(row=>row.distanceCm)).size,206);
  for(const distanceCm of [80000,100000,150000,160934]){
    const row=json.distances.find(item=>item.distanceCm===distanceCm);
    assert.equal(row.unit,'second');
    assert.equal(row.ultra,false);
    assert.equal(row.previewOnly,false);
    let lower=0;
    for(const tier of json.levels){
      assert.ok(row.caps[tier]>lower);
      lower=row.caps[tier];
    }
    assert.equal(difficultyForSportCard(distanceCm,1)?.difficulty,'world_elite');
  }
});

test('all public SUB difficulty boundaries agree with the official award engine',()=>{
  for(const entry of json.distances){
    const {distanceCm,caps,unit,ultra,previewOnly}=entry;
    if(previewOnly)continue;
    if(ultra){
      assert.equal(distanceCm>=4_300_000,true);
      assert.equal(caps,null);
      assert.equal(unit,'minute');
      for(const sub of [1,75,250,500,1000]){
        assert.equal(difficultyForSportCard(distanceCm,sub)?.difficulty,'legend');
      }
      continue;
    }
    const expected=unit==='second'
      ?canonical.capsByDistance[String(distanceCm)]
      :maxSubMinuteByTier(distanceCm);
    assert.deepEqual(caps,expected,'distance='+distanceCm);
    assert.equal(unit,canonical.timeUnitByDistance[String(distanceCm)]||(canonical.timeUnitByDistance[String(distanceCm)]||(canonical.secondResolutionDistancesCm.includes(distanceCm)?'second':'minute')));
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

test('5km sample classification and 1km second caps follow the canonical JSON',()=>{
  const five=canonical.capsByDistance['500000'];
  assert.deepEqual(json.distances.find(row=>row.distanceCm===500000).caps,five);
  const sub=Math.floor((24*60+35)*1000/60_000)+1;
  assert.equal(sub,25);
  const expectedTier=canonical.tierOrder.find(tier=>sub<=five[tier]);
  assert.equal(difficultyForSportCard(500000,sub).difficulty,expectedTier);
  const oneKm=json.distances.find(row=>row.distanceCm===100000);
  assert.equal(oneKm.unit,'second','1 km uses second-resolution SUBs');
  assert.deepEqual(oneKm.caps,canonical.capsByDistance['100000'],
    '1 km palier thresholds are expressed in seconds');
  const sprintCaps=canonical.capsByDistance['40000'];
  assert.equal(difficultyForSportCard(40000,sprintCaps.world_elite).difficulty,'world_elite');
  assert.equal(difficultyForSportCard(40000,sprintCaps.legend).difficulty,'legend');
  assert.equal(difficultyForSportCard(40000,sprintCaps.expert).difficulty,'expert');
});




