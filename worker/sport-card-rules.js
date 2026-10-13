// #444/#448/#450/#451 — pure performance-card business rules, version 1.
// Intentionally disconnected from Worker routes, authentication and D1.
// A "candidate" is NOT a verified win and must never change global ownership.
// Published cards for musical workouts and the old distance+deadline V2 are
// separate, historical formats; neither is migrated or overwritten here.

export const SPORT_CARD_RULESET='sport-cards-v1';
export const SPORT_CARD_DIFFICULTY_RULESET='v1';

// Centimeters are exact keys for catalog identity; GPS precision is NOT 1 cm.
// Only these 10 distances can create a sporting card in the initial catalog.
// Expanding the catalog requires a reviewed, explicitly versioned change.
const CATALOG=[
  [40_000,'400m'],
  [100_000,'1km'],
  [500_000,'5km'],
  [1_000_000,'10km'],
  [1_500_000,'15km'],
  [2_000_000,'20km'],
  [2_109_750,'half_marathon'],
  [3_000_000,'30km'],
  [4_000_000,'40km'],
  [4_219_500,'marathon'],
];
export const SPORT_CARD_DISTANCES=Object.freeze(
  CATALOG.map(([distanceCm,code])=>Object.freeze({distanceCm,code})),
);
const recognized=new Set(SPORT_CARD_DISTANCES.map(item=>item.distanceCm));
const MARATHON_CM=4_219_500;
const ANCHORS=Object.freeze([
  ['world_elite',150],
  ['legend',180],
  ['expert',210],
  ['intermediate',240],
  ['regular',270],
  ['amateur',300],
  ['beginner',330],
].map(([tier,limit])=>Object.freeze({tier,limit})));

const whole=(value)=>Number.isSafeInteger(value)&&value>=0;

export function canonicalSportDistance(distanceCm){
  return recognized.has(distanceCm)?distanceCm:null;
}

export function longestSportDistance(finalDistanceCm){
  if(!whole(finalDistanceCm))return null;
  for(let i=SPORT_CARD_DISTANCES.length-1;i>=0;i--){
    const distance=SPORT_CARD_DISTANCES[i].distanceCm;
    if(finalDistanceCm>=distance)return distance;
  }
  return null;
}

export function maxSubMinuteByTier(distanceCm){
  if(canonicalSportDistance(distanceCm)===null || distanceCm===40_000)return null;
  const factor=(distanceCm/MARATHON_CM)**1.06;
  const caps={};
  let previous=0;
  for(const {tier,limit} of ANCHORS){
    const value=Math.max(1,Math.round(limit*factor),previous+1);
    caps[tier]=value;
    previous=value;
  }
  return caps;
}

// Strict: 24:59.999 -> sub25, 25:00.000 -> sub26.
export function effectiveSportSubMinute(elapsedMs){
  return whole(elapsedMs)&&elapsedMs>0
    ?Math.floor(elapsedMs/60_000)+1:null;
}

export function difficultyForSportCard(distanceCm,subMinute){
  if(canonicalSportDistance(distanceCm)===null||
     !Number.isSafeInteger(subMinute)||subMinute<1)return null;
  if(distanceCm===40_000){
    return subMinute===1?Object.freeze({
      difficulty:'expert',skin:'difficulty_expert_v1',
    }):null;
  }
  const caps=maxSubMinuteByTier(distanceCm);
  const found=ANCHORS.find(({tier})=>subMinute<=caps[tier]);
  return found?Object.freeze({
    difficulty:found.tier,skin:`difficulty_${found.tier}_v1`,
  }):null;
}

// Accept only finalized runs whose evidence was already authenticated and
// verified by a distinct server-side gate. "evidenceVerified" is a TRUSTED
// server flag, never a claim from the phone/HealthKit DTO. No GPS coordinates,
// music duration, target BPM, user account, proof of signature or D1 access.
//
// Crossing events must come from trusted, monotonic distance and sporting
// elapsed time (all pauses INCLUDED). Never interpolate a missing crossing
// from final distance or fall back to a shorter, faster interim checkpoint.
export function evaluateSportCardCandidate({
  finalized,evidenceVerified,finalDistanceCm,finishedElapsedMs,crossings,
}={}){
  if(finalized!==true||evidenceVerified!==true){
    return {status:'unverified',reason:'run_not_finalized_or_evidence_unverified'};
  }
  if(!whole(finalDistanceCm)||!whole(finishedElapsedMs)||
     finishedElapsedMs===0||!Array.isArray(crossings)||crossings.length>10){
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

  const subMinute=effectiveSportSubMinute(chosenMs);
  const tier=difficultyForSportCard(distanceCm,subMinute);
  if(!tier){
    return {status:'none',reason:'outside_beginner_qualification_cap',
      distanceCm,elapsedMs:chosenMs,subMinute};
  }
  return Object.freeze({
    status:'candidate',ruleset:SPORT_CARD_RULESET,
    difficultyRuleset:SPORT_CARD_DIFFICULTY_RULESET,
    distanceCm,elapsedMs:chosenMs,subMinute,
    ...tier,
    // Identity key for the eventual D1 UNIQUE(distance_cm,sub_minute).
    // Does not identify a session and cannot be used as an entitlement.
    performanceKey:`${distanceCm}:${subMinute}`,
  });
}
