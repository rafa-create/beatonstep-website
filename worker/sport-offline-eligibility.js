// #450 Option A: OFFLINE-FIRST, watch and phone are accepted at face value
// unless their completed summaries are obviously inconsistent.
// No continuous network connection, route upload or mandatory pauses.
// This is a NON-AWARDING eligibility preview. A future authenticated,
// once-per-run post-finish transfer must still handle server anti-replay.
import {evaluateSportCardCandidate,longestSportDistance}
  from './sport-card-rules.js';

const allowedSources=new Set([
  'garmin_watch_saved','garmin_mobile_stop','garmin_live_recap',
  'phone_gps',
]);
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)
  &&n>=min&&n<=max;
const failure=(reason)=>({status:'unverified',reason});

/**
 * Accept one ordinary completed run from a wearable or phone.
 * A runner who did not pause is completely ordinary and needs NO pause data.
 * Native/watch elapsed time is represented conservatively by finished-start;
 * if the watch's active timer omits pauses, that timer is not used to make
 * their sporting result faster.
 *
 * We do not invent an exact intermediate crossing from the final route.
 * If the source lacks split timestamps, use elapsed time at the run FINISH
 * for the furthest completed canonical distance. This may produce a slower
 * tier, but never awards a falsely faster split.
 */
export function evaluateOfflineSportSummary(summary){
  if(!summary||typeof summary!=='object'||Array.isArray(summary)||
     !allowedSources.has(summary.distanceSource)||
     !finite(summary.distanceMeters,0,200000)||
     !Number.isSafeInteger(summary.startedAtMs)||
     !Number.isSafeInteger(summary.endedAtMs)||
     summary.startedAtMs<=0||summary.endedAtMs<=summary.startedAtMs)
    return failure('invalid_summary');

  const elapsedMs=summary.endedAtMs-summary.startedAtMs;
  if(!finite(elapsedMs,1,7*86400000))
    return failure('invalid_elapsed_time');

  // Pauses are optional information. Missing or zero pauses are NOT a
  // negative signal; if present, they cannot exceed wall-clock elapsed.
  if(summary.pausedDurationMs!=null&&
    !finite(summary.pausedDurationMs,0,elapsedMs))
    return failure('invalid_pause_duration');

  // Use reasonably generous upper speed for plausibility only: GPS error
  // and short running intervals occur, but 10 km in two minutes is invalid.
  // Do not require a location trace, manual split, pause, or provider API.
  if(summary.distanceMeters/(elapsedMs/1000)>12.5)
    return failure('implausible_average_speed');

  // Downward only: floating-point noise must never manufacture an extra cm.
  const distanceCm=Math.floor(summary.distanceMeters*100+0.00001);
  const maxDistance=longestSportDistance(distanceCm);
  if(maxDistance===null)
    return {status:'none',reason:'below_first_distance'};

  let crossings=[{distanceCm:maxDistance,elapsedMs}];
  if(Array.isArray(summary.sportCrossings)&&summary.sportCrossings.length){
    let previousDistance=0,previousTime=0;
    const verified=[];
    for(const crossing of summary.sportCrossings){
      if(!crossing||!Number.isSafeInteger(crossing.distanceCm)||
         !Number.isSafeInteger(crossing.elapsedMs)||
         crossing.distanceCm<=previousDistance||
         crossing.elapsedMs<=previousTime||
         crossing.elapsedMs>elapsedMs||
         crossing.distanceCm>distanceCm)
        return failure('invalid_splits');
      previousDistance=crossing.distanceCm;
      previousTime=crossing.elapsedMs;
      verified.push({
        distanceCm:crossing.distanceCm,elapsedMs:crossing.elapsedMs,
      });
    }
    // Never backfill a claimed exact crossing from arithmetic or BPM. If the
    // source actually recorded splits, they must include the furthest tier.
    if(verified.at(-1).distanceCm!==maxDistance)
      return failure('missing_final_split');
    crossings=verified;
  }
  const eligibility=evaluateSportCardCandidate({
    finalized:true,evidenceVerified:true,
    finalDistanceCm:distanceCm,finishedElapsedMs:elapsedMs,crossings,
  });
  if(eligibility.status!=='candidate')return eligibility;
  return {...eligibility,source:summary.distanceSource,
    elapsedIncludesPauses:true,splitTiming:
      summary.sportCrossings?.length?'recorded':'conservative_finish',
    autoAwarded:false};
}
