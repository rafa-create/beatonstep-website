import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPORT_CARD_DISTANCES,SPORT_CARD_RULESET,SPORT_CARD_DIFFICULTY_RULESET,
  canonicalSportDistance,longestSportDistance,maxSubMinuteByTier,
  effectiveSportSubMinute,difficultyForSportCard,evaluateSportCardCandidate,
} from '../worker/sport-card-rules.js';

const cm=km=>Math.round(km*100_000);
const ms=(minutes)=>Math.round(minutes*60_000);
const result=(finalKm,crossings,finishedMinutes,verified=true)=>
  evaluateSportCardCandidate({
    finalized:true,evidenceVerified:verified,finalDistanceCm:cm(finalKm),
    finishedElapsedMs:ms(finishedMinutes),
    crossings:crossings.map(([km,m])=>({distanceCm:cm(km),elapsedMs:ms(m)})),
  });

test('V1 has exactly 10 explicit, immutable canonical distance families',()=>{
  assert.deepEqual(SPORT_CARD_DISTANCES.map(x=>x.distanceCm),[
    40_000,100_000,500_000,1_000_000,1_500_000,2_000_000,
    2_109_750,3_000_000,4_000_000,4_219_500,
  ]);
  assert.deepEqual(SPORT_CARD_DISTANCES.map(x=>x.code),[
    '400m','1km','5km','10km','15km','20km',
    'half_marathon','30km','40km','marathon',
  ]);
  assert.equal(Object.isFrozen(SPORT_CARD_DISTANCES),true);
  assert.equal(SPORT_CARD_RULESET,'sport-cards-v1');
  assert.equal(SPORT_CARD_DIFFICULTY_RULESET,'v1');
  for(const nonmember of [0,1,100,200_000,300_000,400_000,600_000,
    2_100_000,2_200_000,2_500_000,3_500_000,4_200_000,4_300_000,5_000_000]){
    assert.equal(canonicalSportDistance(nonmember),null,String(nonmember));
    assert.equal(difficultyForSportCard(nonmember,1),null);
  }
  assert.equal(canonicalSportDistance(2_109_750),2_109_750);
  assert.equal(canonicalSportDistance(4_219_500),4_219_500);
});

test('longest recognized distance: no cards at intermediate or rounded-away km',()=>{
  for(const [completed,eligible] of [
    [0,null],[0.39999,null],[0.4,0.4],[0.99,0.4],[1,1],
    [3.5,1],[4.99,1],[5,5],[7,5],[14.99,10],[20,20],
    [21.0974,20],[21.0975,21.0975],[21.5,21.0975],
    [22,21.0975],[29.9,21.0975],[30,30],[40,40],
    [42.1949,40],[42.195,42.195],[42.3,42.195],
    [43,42.195],[50,42.195],
  ]) assert.equal(longestSportDistance(cm(completed)),
    eligible===null?null:cm(eligible),String(completed));
  for(const invalid of [null,undefined,-1,1.5,NaN,Infinity,'500000']){
    assert.equal(longestSportDistance(invalid),null);
  }
});

test('canonical 7-tier difficulty caps for all V1 distances match #451',()=>{
  const caps=[
    [1,[9,8,7,6,5,4,3]],
    [5,[34,31,28,25,22,19,16]],
    [10,[72,65,59,52,46,39,33]],
    [15,[110,100,90,80,70,60,50]],
    [20,[150,136,122,109,95,82,68]],
    [21.0975,[158,144,130,115,101,86,72]],
    [30,[230,209,188,167,146,125,104]],
    [40,[312,283,255,227,198,170,142]],
    [42.195,[330,300,270,240,210,180,150]],
  ];
  const names=['beginner','amateur','regular','intermediate','expert','legend','world_elite'];
  for(const [km,values] of caps){
    const out=maxSubMinuteByTier(cm(km));
    assert.deepEqual(names.map(n=>out[n]),values,String(km));
    assert.equal(new Set(Object.values(out)).size,7);
    assert.equal(difficultyForSportCard(cm(km),values[0]+1),null);
    assert.equal(difficultyForSportCard(cm(km),values[0]).difficulty,'beginner');
    assert.equal(difficultyForSportCard(cm(km),values[6]).difficulty,'world_elite');
    for(let i=0;i<names.length;i++){
      assert.equal(difficultyForSportCard(cm(km),values[i]).difficulty,names[i]);
      assert.equal(difficultyForSportCard(cm(km),values[i]).skin,
        'difficulty_'+names[i]+'_v1');
    }
  }
  assert.equal(maxSubMinuteByTier(40_000),null);
  assert.equal(difficultyForSportCard(40_000,1).difficulty,'expert');
  assert.equal(difficultyForSportCard(40_000,2),null);
});

test('strict N minutes and performance examples: no rounding or rarity',()=>{
  assert.equal(effectiveSportSubMinute(ms(25)-1),25);
  assert.equal(effectiveSportSubMinute(ms(25)),26);
  assert.equal(effectiveSportSubMinute(59_999),1);
  assert.equal(effectiveSportSubMinute(60_000),2);
  assert.equal(effectiveSportSubMinute(0),null);
  const examples=[
    [5,24+59/60,25,'intermediate'],
    [5,29.75,30,'amateur'],
    [21.0975,89.5,90,'expert'],
    [21.0975,119.5,120,'regular'],
    [42.195,239+59/60,240,'intermediate'],
    [42.195,329+59/60,330,'beginner'],
  ];
  for(const [km,minutes,sub,tier] of examples){
    const p=result(km,[[km,minutes]],minutes);
    assert.equal(p.status,'candidate');
    assert.equal(p.distanceCm,cm(km));
    assert.equal(p.subMinute,sub);
    assert.equal(p.difficulty,tier);
    assert.equal(p.performanceKey,cm(km)+':'+sub);
    assert.equal('rarity' in p,false);
    assert.equal('owner' in p,false);
    assert.equal('awarded' in p,false);
  }
  assert.equal(result(42.195,[[42.195,330]],330).status,'none');
  assert.equal(result(.4,[[.4,59.999/60]],.999983).status,'unverified');
});

test('one candidate at longest recognized crossing and no fallback when it fails',()=>{
  const winning=result(20.4,[[1,5],[5,24],[10,60],[15,95],[20,149.9833]],160);
  assert.equal(winning.status,'candidate');
  assert.equal(winning.distanceCm,cm(20));
  assert.equal(winning.subMinute,150);
  const failed=result(20.4,[[1,5],[5,24],[10,60],[15,95],[20,150]],165);
  assert.equal(failed.status,'none');
  assert.equal(failed.reason,'outside_beginner_qualification_cap');
  assert.equal(failed.distanceCm,cm(20));
  // No 21, 22 or 43 km card. Only semi/marathon may be selected.
  assert.equal(result(22,[[21.0975,120]],130).distanceCm,cm(21.0975));
  assert.equal(result(43,[[42.195,240]],250).distanceCm,cm(42.195));
  assert.equal(result(7,[[1,5],[5,29.75]],40).distanceCm,cm(5));
});

test('400m sub1 only, loses priority after any larger recognized distance',()=>{
  assert.equal(result(.5,[[.4,59.999/60]],1).status,'candidate');
  assert.equal(result(.5,[[.4,1]],1.5).status,'none');
  assert.equal(result(1,[[.4,59.999/60],[1,8]],9).distanceCm,cm(1));
});

test('must be finalized, trusted, and crossed at a measured sporting timestamp',()=>{
  const candidate={finalized:true,evidenceVerified:true,
    finalDistanceCm:cm(5),finishedElapsedMs:ms(30),
    crossings:[{distanceCm:cm(5),elapsedMs:ms(24)}]};
  assert.equal(evaluateSportCardCandidate(candidate).status,'candidate');
  for(const change of [
    {finalized:false},{finalized:undefined},{evidenceVerified:false},
    {evidenceVerified:undefined},
  ]) assert.equal(evaluateSportCardCandidate({...candidate,...change}).status,'unverified');
  for(const change of [
    {crossings:[]},
    {crossings:[{distanceCm:cm(1),elapsedMs:ms(4)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(31)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:0}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},
      {distanceCm:cm(5),elapsedMs:ms(25)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},
      {distanceCm:cm(1),elapsedMs:ms(25)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},
      {distanceCm:cm(10),elapsedMs:ms(25)}]},
    {crossings:[{distanceCm:cm(5),elapsedMs:ms(24)},
      {distanceCm:cm(6),elapsedMs:ms(25)}]},
    {finalDistanceCm:cm(5)+.5},{finishedElapsedMs:0},
  ]) assert.equal(evaluateSportCardCandidate({...candidate,...change}).status,'unverified');
});
