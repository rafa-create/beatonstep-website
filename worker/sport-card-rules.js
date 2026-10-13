// #444/#448/#450/#451 — performance-card business calculation only.
// This file never creates a card, authenticates a run or writes to D1.
// Historical musical cards and the earlier distance+deadline V2 remain separate.

export const SPORT_CARD_RULESET='sport-cards-v1';
export const SPORT_CARD_DIFFICULTY_RULESET='v1';

const MARATHON_CM=4_219_500;
const HALF_MARATHON_CM=2_109_750;
const ULTRA_START_CM=4_300_000;
const BEGINNER_10K_MAX_SUB_MINUTE=91; // 10 km in exactly 1h30 -> sub91 eligible.
// Product-only 400m difficulty caps, not official World Athletics rankings.
// Caps use strict sub-second thresholds. 400m 59.999s = sub60 Legend;
// at exactly 60.000s the candidate is sub61 Expert.
const FOUR_HUNDRED_METER_TIERS=Object.freeze([
  ['world_elite',50],['legend',60],['expert',70],
  ['intermediate',85],['regular',100],['amateur',125],
  ['beginner',181], // Allows exactly 3 minutes on the 400m.
].map(([difficulty,maxSubSecond])=>Object.freeze({
  difficulty,maxSubSecond,
})));

// Exact centimeters identify a canonical family, not GPS centimeter accuracy.
// 1..200 km + 400m sub1 + exact half-marathon + exact marathon = 203 families.
// New families require a reviewed, versioned catalog change.
const CATALOG=[
  {distanceCm:40_000,code:'400m'},
  ...Array.from({length:200},(_,i)=>({
    distanceCm:(i+1)*100_000,code:`${i+1}km`,
  })),
  {distanceCm:HALF_MARATHON_CM,code:'half_marathon'},
  {distanceCm:MARATHON_CM,code:'marathon'},
].sort((a,b)=>a.distanceCm-b.distanceCm);
export const SPORT_CARD_DISTANCES=Object.freeze(
  CATALOG.map(item=>Object.freeze(item)),
);
const recognized=new Set(SPORT_CARD_DISTANCES.map(item=>item.distanceCm));

// Other six levels retain #451's original marathon performance anchors.
// Beginner is deliberately widened to include 10 km in 90:00 exactly.
// This is a game-design threshold, not a medical/scientific assessment.
const ANCHORS=Object.freeze([
  ['world_elite',150],['legend',180],['expert',210],
  ['intermediate',240],['regular',270],['amateur',300],
  ['beginner',330],
].map(([tier,limit])=>Object.freeze({tier,limit})));
const whole=value=>Number.isSafeInteger(value)&&value>=0;

export function canonicalSportDistance(distanceCm){
  return recognized.has(distanceCm)?distanceCm:null;
}
export function longestSportDistance(finalDistanceCm){
  if(!whole(finalDistanceCm))return null;
  for(let i=SPORT_CARD_DISTANCES.length-1;i>=0;i--){
    const d=SPORT_CARD_DISTANCES[i].distanceCm;
    if(finalDistanceCm>=d)return d;
  }
  return null;
}

export function maxSubMinuteByTier(distanceCm){
  if(canonicalSportDistance(distanceCm)===null||
     distanceCm===40_000||distanceCm>=ULTRA_START_CM)return null;
  const factor=(distanceCm/MARATHON_CM)**1.06;
  const out={};
  let previous=0;
  for(const {tier,limit} of ANCHORS){
    let cap=Math.round(limit*factor);
    if(tier==='beginner'){
      const inclusiveTenKmCap=Math.round(
        BEGINNER_10K_MAX_SUB_MINUTE*(distanceCm/1_000_000)**1.06,
      );
      cap=Math.max(cap,inclusiveTenKmCap);
    }
    cap=Math.max(1,cap,previous+1);
    out[tier]=cap;
    previous=cap;
  }
  return out;
}

// At exactly N:00 the eligible threshold is always sub(N+1).
export function effectiveSportSubMinute(elapsedMs){
  return whole(elapsedMs)&&elapsedMs>0
    ?Math.floor(elapsedMs/60_000)+1:null;
}

// A 400 m sprint is timed to the second instead of the minute.
// The period stays inclusive of pauses; the reward label is strict "sub N s".
export function effectiveSportSubSecond(elapsedMs){
  return whole(elapsedMs)&&elapsedMs>0
    ?Math.floor(elapsedMs/1000)+1:null;
}

export function difficultyForSportCard(distanceCm,subValue){
  if(canonicalSportDistance(distanceCm)===null||
     !Number.isSafeInteger(subValue)||subValue<1)return null;
  if(distanceCm===40_000){
    const found=FOUR_HUNDRED_METER_TIERS.find(
      tier=>subValue<=tier.maxSubSecond);
    return found?Object.freeze({
      difficulty:found.difficulty,
      skin:`difficulty_${found.difficulty}_v1`,
    }):null;
  }
  if(distanceCm>=ULTRA_START_CM){
    // All authenticated 43..200 km performances are "Long-distance legend",
    // irrespective of speed; plausibility and safety are separate checks.
    return Object.freeze({
      difficulty:'legend',skin:'difficulty_legend_v1',
    });
  }
  const caps=maxSubMinuteByTier(distanceCm);
  const found=ANCHORS.find(({tier})=>subValue<=caps[tier]);
  return found?Object.freeze({
    difficulty:found.tier,skin:`difficulty_${found.tier}_v1`,
  }):null;
}

// Runs must be verified BEFORE this pure calculation by an independent,
// authenticated server-side gate. 'evidenceVerified' cannot be trusted if
// supplied directly by a client. Result 'candidate' never means "awarded".
//
// Crossings come from a trusted source with genuine timestamps including
// pauses. Missing final recognized crossing => no interpolation/no fallback.
export function evaluateSportCardCandidate({
  finalized,evidenceVerified,finalDistanceCm,finishedElapsedMs,crossings,
}={}){
  if(finalized!==true||evidenceVerified!==true){
    return {status:'unverified',reason:'run_not_finalized_or_evidence_unverified'};
  }
  if(!whole(finalDistanceCm)||!whole(finishedElapsedMs)||
     finishedElapsedMs===0||!Array.isArray(crossings)||
     crossings.length>SPORT_CARD_DISTANCES.length){
    return {status:'unverified',reason:'invalid_run'};
  }
  const distanceCm=longestSportDistance(finalDistanceCm);
  if(distanceCm===null)return {status:'none',reason:'below_first_distance'};

  const seen=new Set();
  let lastDistance=0,lastElapsed=0,chosenMs=null;
  for(const point of crossings){
    if(!point||canonicalSportDistance(point.distanceCm)===null||
       !whole(point.elapsedMs)||point.elapsedMs===0||
       point.distanceCm>finalDistanceCm||point.distanceCm<=lastDistance||
       point.elapsedMs<=lastElapsed||point.elapsedMs>finishedElapsedMs||
       seen.has(point.distanceCm)){
      return {status:'unverified',reason:'invalid_crossings'};
    }
    seen.add(point.distanceCm);
    lastDistance=point.distanceCm;
    lastElapsed=point.elapsedMs;
    if(point.distanceCm===distanceCm)chosenMs=point.elapsedMs;
  }
  if(chosenMs===null){
    return {status:'unverified',reason:'missing_final_distance_crossing'};
  }
  const isSprint=distanceCm===40_000;
  const timeUnit=isSprint?'second':'minute';
  const subValue=isSprint
    ?effectiveSportSubSecond(chosenMs)
    :effectiveSportSubMinute(chosenMs);
  const tier=difficultyForSportCard(distanceCm,subValue);
  if(!tier){
    return {status:'none',reason:'outside_beginner_qualification_cap',
      distanceCm,elapsedMs:chosenMs,timeUnit,subValue,
      subMinute:isSprint?null:subValue,subSecond:isSprint?subValue:null};
  }
  return Object.freeze({
    status:'candidate',ruleset:SPORT_CARD_RULESET,
    difficultyRuleset:SPORT_CARD_DIFFICULTY_RULESET,
    distanceCm,elapsedMs:chosenMs,timeUnit,subValue,
    subMinute:isSprint?null:subValue,
    subSecond:isSprint?subValue:null,
    ...tier,
    // Eventual D1 identity: UNIQUE(distance_cm,time_unit,sub_value).
    // "400 m sub60 seconds" and "5 km sub60 minutes" stay unambiguous.
    // This is NOT a receipt, proof or entitlement to ownership.
    performanceKey:`${distanceCm}:${timeUnit}:${subValue}`,
  });
}
