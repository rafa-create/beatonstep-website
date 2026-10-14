// Sport-card calculation. Official thresholds come ONLY from the public,
// static site asset /sport-card-rules.json; no D1/Worker API round trip.
import sportTierRules from '../sport-card-rules.json' with { type: 'json' };

export const SPORT_CARD_RULESET=sportTierRules.ruleset;
export const SPORT_CARD_DIFFICULTY_RULESET=sportTierRules.difficultyRuleset;
export const SPORT_CARD_TIER_REVISION=sportTierRules.revision;
const ULTRA_START_CM=sportTierRules.ultraStartCm;
const LEVELS=Object.freeze([...sportTierRules.tierOrder]);
export const SPORT_CARD_400M_TIERS=Object.freeze(
  LEVELS.map(difficulty=>Object.freeze({
    difficulty,maxSubSecond:sportTierRules.capsByDistance['40000'][difficulty],
  })),
);
const CATALOG=sportTierRules.distancesCm.map(distanceCm=>({
  distanceCm,
  code:distanceCm===40000?'400m':
    distanceCm===2109750?'half_marathon':
    distanceCm===4219500?'marathon':(distanceCm/100000)+'km',
}));
export const SPORT_CARD_DISTANCES=Object.freeze(
  CATALOG.map(item=>Object.freeze(item)),
);
const recognized=new Set(sportTierRules.distancesCm);
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
     distanceCm===40000||distanceCm>=ULTRA_START_CM)return null;
  // Return a defensive copy; the canonical thresholds are immutable inputs.
  return {...sportTierRules.capsByDistance[String(distanceCm)]};
}

// Public read-only projection of THE SAME functions used to grant cards in D1.
// Contains computed caps, so clients never reimplement the curve or override
// precedence. Nothing here exposes runners, GPS or unpublished results.
export function sportCardRulesManifest(){
  return sportTierRules;
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
    const found=SPORT_CARD_400M_TIERS.find(
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
  const found=LEVELS.find(tier=>subValue<=caps[tier]);
  return found?Object.freeze({
    difficulty:found,skin:`difficulty_${found}_v1`,
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
