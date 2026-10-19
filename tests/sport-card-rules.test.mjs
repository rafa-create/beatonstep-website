import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SPORT_CARD_DISTANCES,SPORT_CARD_RULESET,SPORT_CARD_DIFFICULTY_RULESET,
  canonicalSportDistance,longestSportDistance,maxSubMinuteByTier,
  effectiveSportSubMinute,effectiveSportSubSecond,difficultyForSportCard,evaluateSportCardCandidate,sportCardTimeUnit,
} from '../worker/sport-card-rules.js';

const canonical=JSON.parse(readFileSync(new URL('../sport-card-rules.json',import.meta.url),'utf8'));
const cm=km=>Math.round(km*100_000);
const tierFor=(distanceCm,sub)=>{
  const caps=canonical.capsByDistance[String(distanceCm)];
  return caps&&canonical.tierOrder.find(tier=>sub<=caps[tier])||null;
};
const ms=minutes=>Math.round(minutes*60_000);
const result=(finalKm,crossings,finishedMinutes,verified=true)=>
  evaluateSportCardCandidate({
    finalized:true,evidenceVerified:verified,finalDistanceCm:cm(finalKm),
    finishedElapsedMs:ms(finishedMinutes),
    crossings:crossings.map(([km,m])=>({distanceCm:cm(km),elapsedMs:ms(m)})),
  });
const resultSeconds=(finalKm,crossings,finishedSeconds,verified=true)=>
  evaluateSportCardCandidate({
    finalized:true,evidenceVerified:verified,finalDistanceCm:cm(finalKm),
    finishedElapsedMs:Math.round(finishedSeconds*1000),
    crossings:crossings.map(([km,s])=>({distanceCm:cm(km),elapsedMs:Math.round(s*1000)})),
  });

test('catalog: 400m with multiple second thresholds plus EVERY km 1..200',()=>{
  assert.equal(SPORT_CARD_DISTANCES.length,206);
  assert.deepEqual(SPORT_CARD_DISTANCES.map(x=>x.distanceCm),[
    cm(.4),cm(.8),cm(1.5),160934,...Array.from({length:200},(_,i)=>cm(i+1)),
    cm(21.0975),cm(42.195),
  ].sort((a,b)=>a-b));
  assert.equal(new Set(SPORT_CARD_DISTANCES.map(x=>x.distanceCm)).size,206);
  assert.equal(Object.isFrozen(SPORT_CARD_DISTANCES),true);
  assert.equal(SPORT_CARD_RULESET,'sport-cards-v1');
  assert.equal(SPORT_CARD_DIFFICULTY_RULESET,'v2');
  for(let km=1;km<=200;km++){
    assert.equal(canonicalSportDistance(cm(km)),cm(km));
    assert.equal(longestSportDistance(cm(km)),cm(km));
  }
  for(const invalid of [0,100,10_000,cm(.5),cm(21.0974),cm(42.1949),
    cm(200.1),NaN,Infinity,'100000']){
    assert.equal(canonicalSportDistance(invalid),null,String(invalid));
  }
  for(const distance of [cm(.4),cm(1),cm(10),cm(42),cm(42.195),cm(43),cm(200)]){
    assert.equal(difficultyForSportCard(distance,1)?.skin?.includes('difficulty_'),true);
  }
});

test('longest crossed distance at unrounded half/full and every integer km',()=>{
  for(const [finished,chosen] of [
    [0,null],[.39999,null],[.4,.4],[.79999,.4],[.8,.8],
    [.99,.8],[1,1],[1.4999,1],[1.5,1.5],[1.6,1.5],
    [1.60933,1.5],[1.60934,1.60934],[2,2],[3.5,3],[7,7],[14,14],[14.99,14],
    [21.0974,21],[21.0975,21.0975],[21.5,21.0975],
    [22,22],[29.9,29],[30,30],[40,40],[42.1949,42],
    [42.195,42.195],[42.3,42.195],[43,43],[50,50],
    [199.999,199],[200,200],[250,200],
  ]) assert.equal(longestSportDistance(cm(finished)),
    chosen===null?null:cm(chosen),String(finished));
  for(const invalid of [-1,1.1,null,undefined,NaN,Infinity,'500000']){
    assert.equal(longestSportDistance(invalid),null);
  }
});

test('all 1..42km plus half/marathon have seven unique levels and discreet skin tokens',()=>{
  const names=['beginner','amateur','regular','intermediate',
    'expert','legend','world_elite'];
  const distances=[...Array.from({length:41},(_,i)=>i+2),21.0975,42.195];
  for(const km of distances){
    const caps=maxSubMinuteByTier(cm(km));
    assert.deepEqual(Object.keys(caps).sort(),[...names].sort());
    let previous=0;
    for(const tier of [...names].reverse()){
      assert.ok(caps[tier]>previous,`${km} km ${tier}: monotonic`);
      previous=caps[tier];
      const expected=difficultyForSportCard(cm(km),caps[tier]);
      assert.equal(expected.difficulty,tier);
      assert.equal(expected.skin,`difficulty_${tier}_v1`);
      assert.equal('rarity' in expected,false);
    }
    assert.equal(difficultyForSportCard(cm(km),caps.beginner+1),null);
  }
  assert.deepEqual(maxSubMinuteByTier(cm(10)),canonical.capsByDistance[String(cm(10))]);
  assert.equal(maxSubMinuteByTier(cm(14)).beginner,
    canonical.capsByDistance[String(cm(14))].beginner);
  assert.equal(maxSubMinuteByTier(cm(42.195)).beginner,
    canonical.capsByDistance[String(cm(42.195))].beginner);
  assert.equal(maxSubMinuteByTier(cm(.4)),null);
  assert.equal(maxSubMinuteByTier(cm(43)),null);
});


test('1km has second-resolution caps calibrated for all seven levels',()=>{
  const caps=canonical.capsByDistance[String(cm(1))];
  for(const [tier,sub] of Object.entries(caps)){
    assert.equal(difficultyForSportCard(cm(1),sub)?.difficulty,tier);
  }
  assert.equal(maxSubMinuteByTier(cm(1)),null);
  for(const [seconds,sub,tier] of [
    [149,150,'world_elite'],[229.999,230,'legend'],[269.999,270,'expert'],
    [359.999,360,'intermediate'],[419.999,420,'regular'],
    [479.999,480,'amateur'],[599.999,600,'beginner'],
  ]){
    const p=resultSeconds(1,[[1,seconds]],seconds+5);
    assert.equal(p.status,'candidate');
    assert.equal(p.timeUnit,'second');
    assert.equal(p.subSecond,sub);
    assert.equal(p.subMinute,null);
    assert.equal(p.difficulty,tier);
    assert.equal(p.performanceKey,cm(1)+':second:'+sub);
  }
  assert.equal(resultSeconds(1,[[1,600]],605).status,'none');
});

test('novice 10km exactly 90:00 qualifies for beginner sub91',()=>{
  const p=result(10,[[10,90]],90);
  assert.equal(p.status,'candidate');
  assert.equal(p.performanceKey,`${cm(10)}:minute:91`);
  assert.equal(p.timeUnit,'minute');
  assert.equal(p.subSecond,null);
  assert.equal(p.difficulty,'beginner');
  assert.equal(p.skin,'difficulty_beginner_v1');
  assert.equal(effectiveSportSubMinute(ms(90)-1),90);
  assert.equal(effectiveSportSubMinute(ms(90)),91);
  const quick=result(10,[[10,90-1/60]],90);
  assert.equal(quick.subMinute,90);
  assert.equal(quick.difficulty,'beginner');
  assert.equal(result(10,[[10,100]],100).status,'none');
  // A 14km 1h09m59 has a valid dedicated card, not a 10km proxy.
  const fourteen=result(14,[[14,70-1/60]],70);
  assert.equal(fourteen.status,'candidate');
  assert.equal(fourteen.subMinute,70);
  assert.equal(fourteen.distanceCm,cm(14));
  assert.equal(fourteen.difficulty,'expert');
});

test('performance threshold examples, strict minute and no rare/owner fields',()=>{
  for(const [km,minutes,sub] of [
    [5,24+59/60,25],
    [5,29.75,30],
    [21.0975,89.5,90],
    [21.0975,119.5,120],
    [42.195,239+59/60,240],
    [42.195,329+59/60,330],
  ]){
    const tier=tierFor(cm(km),sub);
    const candidate=result(km,[[km,minutes]],minutes);
    assert.equal(candidate.status,'candidate');
    assert.equal(candidate.distanceCm,cm(km));
    assert.equal(candidate.subMinute,sub);
    assert.equal(candidate.difficulty,tier);
    assert.equal('rarity' in candidate,false);
    assert.equal('owner' in candidate,false);
    assert.equal('awarded' in candidate,false);
  }
  assert.equal(effectiveSportSubMinute(0),null);
  assert.equal(effectiveSportSubMinute(59_999),1);
  assert.equal(effectiveSportSubMinute(60_000),2);
  assert.equal(result(.4,[[.4,59.999/60]],.999).status,'unverified');
});

test('ultra 43..200km is legend independent of elapsed time; never bypass proof',()=>{
  for(const km of [43,44,50,100,199,200]){
    for(const minutes of [300,1000,10000]){
      const p=result(km,[[km,minutes]],minutes+5);
      assert.equal(p.status,'candidate');
      assert.equal(p.difficulty,'legend');
      assert.equal(p.skin,'difficulty_legend_v1');
      assert.equal(p.distanceCm,cm(km));
      assert.equal(result(km,[[km,minutes]],minutes+5,false).status,'unverified');
      assert.equal(maxSubMinuteByTier(cm(km)),null);
    }
  }
  // Marathon itself retains the seven difficulty levels.
  assert.equal(result(42.195,[[42.195,240]],245).difficulty,'intermediate');
});

test('one candidate only at last recognized checkpoint, never fallback',()=>{
  const ok=result(14.3,[[1,5],[5,25],[10,65],[14,100]],110);
  assert.equal(ok.status,'candidate');
  assert.equal(ok.distanceCm,cm(14));
  const over=result(14.3,[[1,5],[5,25],[10,65],[14,140]],145);
  assert.equal(over.status,'none');
  assert.equal(over.distanceCm,cm(14));
  assert.equal(over.reason,'outside_beginner_qualification_cap');
  assert.equal(result(21.5,[[21,138],[21.0975,150]],155).distanceCm,cm(21.0975));
  assert.equal(result(42.3,[[42,200],[42.195,250]],260).distanceCm,cm(42.195));
  assert.equal(result(43,[[42.195,250],[43,300]],305).distanceCm,cm(43));
});

test('400m is timed per SECOND with seven levels, strict 1-minute milestone',()=>{
  const tiers=[
    [59.999,'legend',60],
    [60,'expert',61],
    [100.999,'expert',101],
    [101,'intermediate',102],
    [122.999,'intermediate',123],
    [123,'regular',124],
    [147.999,'regular',148],
    [148,'amateur',149],
    [177.999,'amateur',178],
    [178,'beginner',179],
    [200,'beginner',201],
  ];
  for(const [seconds,difficulty,subSecond] of tiers){
    const sec=Math.round(seconds*1000);
    const p=evaluateSportCardCandidate({
      finalized:true,evidenceVerified:true,
      finalDistanceCm:cm(.4),finishedElapsedMs:sec,
      crossings:[{distanceCm:cm(.4),elapsedMs:sec}],
    });
    assert.equal(p.status,'candidate',String(seconds));
    assert.equal(p.difficulty,difficulty,String(seconds));
    assert.equal(p.subSecond,subSecond,String(seconds));
    assert.equal(p.subMinute,null);
    assert.equal(p.timeUnit,'second');
    assert.equal(p.performanceKey,`${cm(.4)}:second:${subSecond}`);
    assert.equal('rarity' in p,false);
  }
  assert.equal(effectiveSportSubSecond(59_999),60);
  assert.equal(effectiveSportSubSecond(60_000),61);
  assert.equal(effectiveSportSubSecond(0),null);
  assert.equal(difficultyForSportCard(cm(.4),201).difficulty,'beginner');
  assert.equal(difficultyForSportCard(cm(.4),202),null);
  assert.equal(result(.4,[[.4,202/60]],203/60).status,'none');
  assert.equal(result(1,[[.4,.5],[1,8]],9).distanceCm,cm(1));
  // A normal 400 m is a sprint; never use a minute-rounded sub1
  // or silently reuse the per-minute 5km identity scheme.
});

test('800m, 1500m, mile are real one-second SUB collectibles',()=>{
  for(const [cmDistance,elapsedMs,expectedSub] of [
    [80000,179999,180],[150000,450123,451],
    [160934,499999,500],
  ]){
    const card=evaluateSportCardCandidate({
      finalized:true,evidenceVerified:true,
      finalDistanceCm:cmDistance,
      finishedElapsedMs:elapsedMs,
      crossings:[{distanceCm:cmDistance,elapsedMs}],
    });
    assert.equal(card.status,'candidate');
    assert.equal(card.distanceCm,cmDistance);
    assert.equal(card.timeUnit,'second');
    assert.equal(card.subValue,expectedSub);
    assert.equal(card.performanceKey,cmDistance+':second:'+expectedSub);
  }
  const sixteen=evaluateSportCardCandidate({
    finalized:true,evidenceVerified:true,finalDistanceCm:160000,
    finishedElapsedMs:500000,
    crossings:[{distanceCm:150000,elapsedMs:500000}],
  });
  assert.equal(sixteen.distanceCm,150000);
  assert.equal(sixteen.timeUnit,'second');
  assert.equal(sixteen.performanceKey,'150000:second:501');
  assert.equal(longestSportDistance(160933),150000);
  assert.equal(longestSportDistance(160934),160934);
});

test('unverified/fake samples are never eligible for cards',()=>{
  const base={finalized:true,evidenceVerified:true,finalDistanceCm:cm(5),
    finishedElapsedMs:ms(30),
    crossings:[{distanceCm:cm(5),elapsedMs:ms(24)}]};
  assert.equal(evaluateSportCardCandidate(base).status,'candidate');
  for(const changes of [
    {finalized:false},{finalized:undefined},{evidenceVerified:false},
    {evidenceVerified:undefined},
    {crossings:[]},
    {crossings:[{distanceCm:cm(1),elapsedMs:ms(4)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(31)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:0}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},{distanceCm:cm(5),elapsedMs:ms(25)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},{distanceCm:cm(1),elapsedMs:ms(25)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},{distanceCm:cm(10),elapsedMs:ms(25)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},{distanceCm:cm(5.5),elapsedMs:ms(25)}]},
    {finalDistanceCm:cm(5)+.5},{finishedElapsedMs:0},
  ]) assert.equal(evaluateSportCardCandidate({...base,...changes}).status,'unverified');
  const all=SPORT_CARD_DISTANCES.map((entry,i)=>({
    distanceCm:entry.distanceCm,elapsedMs:(i+1)*60_000,
  }));
  assert.equal(evaluateSportCardCandidate({
    ...base,finalDistanceCm:cm(200),finishedElapsedMs:210*60_000,
    crossings:all,
  }).status,'candidate');
  assert.equal(evaluateSportCardCandidate({
    ...base,crossings:[...all,all.at(-1)],
  }).status,'unverified');
});

test('per-distance time-unit configuration preserves existing units and second precision',()=>{
  assert.equal(sportCardTimeUnit(40000),'second');
  assert.equal(sportCardTimeUnit(100000),'second');
  assert.equal(sportCardTimeUnit(500000),'minute');
  assert.equal(sportCardTimeUnit(4219500),'minute');
  assert.equal(effectiveSportSubSecond((3*3600+20*60+45)*1000),12046);
});
