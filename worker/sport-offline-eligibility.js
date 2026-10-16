// #450 Option A: OFFLINE-FIRST, watch and phone are accepted at face value
// unless their completed summaries are obviously inconsistent.
// No continuous network connection, route upload or mandatory pauses.
// This is a NON-AWARDING eligibility preview. A future authenticated,
// once-per-run post-finish transfer must still handle server anti-replay.
import {SPORT_CARD_DISTANCES,evaluateSportCardCandidate,longestSportDistance}
  from './sport-card-rules.js';

const allowedSources=new Set([
  'garmin_watch_saved','garmin_mobile_stop','garmin_live_recap',
  'phone_gps','strava_import',
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

  // Sporting plausibility is advisory; keep identity and base measurements
  // mandatory, but do not withhold a usable card for telemetry anomalies.
  const warningReasons=[];
  if(summary.distanceSource==='strava_import'&&summary.stravaFlagged===true)
    warningReasons.push('strava_flagged');
  if(summary.pausedDurationMs!=null&&
     !finite(summary.pausedDurationMs,0,elapsedMs))
    warningReasons.push('invalid_pause_duration');
  // A GPS peak is evidence for the existing advisory pipeline, never an
  // eligibility gate. Unknown/older mobile binaries omit this field.
  const peakSpeedKmh=finite(summary.peakSpeedKmh,0,10000)
    ?Math.round(summary.peakSpeedKmh*10)/10:null;
  if(summary.distanceMeters/(elapsedMs/1000)>12.5 ||
     (peakSpeedKmh!==null&&peakSpeedKmh>45))
    warningReasons.push('implausible_speed');

  // Downward only: floating-point noise must never manufacture an extra cm.
  const distanceCm=Math.floor(summary.distanceMeters*100+0.00001);
  const maxDistance=longestSportDistance(distanceCm);
  if(maxDistance===null)
    return {status:'none',reason:'below_first_distance'};

  let crossings=[{distanceCm:maxDistance,elapsedMs}];
  let hasRecordedSplit=false;
  if(Array.isArray(summary.sportCrossings)&&summary.sportCrossings.length){
    let previousDistance=0,previousTime=0,valid=true;
    const verified=[];
    if(summary.sportCrossings.length>SPORT_CARD_DISTANCES.length)valid=false;
    if(valid)for(const crossing of summary.sportCrossings){
      if(!crossing||!Number.isSafeInteger(crossing.distanceCm)||
         !Number.isSafeInteger(crossing.elapsedMs)||
         crossing.distanceCm<=previousDistance||
         crossing.elapsedMs<=previousTime||
         crossing.elapsedMs>elapsedMs||
         crossing.distanceCm>distanceCm){
        valid=false;break;
      }
      previousDistance=crossing.distanceCm;
      previousTime=crossing.elapsedMs;
      verified.push({distanceCm:crossing.distanceCm,elapsedMs:crossing.elapsedMs});
    }
    if(valid&&verified.at(-1).distanceCm===maxDistance){
      crossings=verified;hasRecordedSplit=true;
    }else warningReasons.push('inconsistent_crossings');
  }
  const eligibility=evaluateSportCardCandidate({
    finalized:true,evidenceVerified:true,
    finalDistanceCm:distanceCm,finishedElapsedMs:elapsedMs,crossings,
  });
  if(eligibility.status!=='candidate')return eligibility;
  return {...eligibility,source:summary.distanceSource,
    elapsedIncludesPauses:true,
    splitTiming:hasRecordedSplit?'recorded':'conservative_finish',
    // Advisory and internal; never a gate on the D1 transfer.
    needsReviewWarning:warningReasons.length>0,warningReasons,
    peakSpeedKmh,autoAwarded:false};
}
