// #421 — v2 sporting challenge identity and conservative, pure proof checks.
// No D1 mutations, GPS coordinates, account IDs or raw route data in this module.
// This is NOT an anti-spoof attestation. Server ownership changes need a
// separately authenticated, rate-limited and transactional acceptance flow.
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;

// Shared card v2 identity is the SPORTING RULE, not the musical arrangement.
// 5 km/20 min and 5 km/25 min differ; two playlists for 5 km/20 min do not.
// Treat all values as SI integer meters/seconds; never round inconsistent input.
export function challengeRule(payload) {
  if (!payload || typeof payload!=='object' || Array.isArray(payload) ||
      payload.v!==2 || payload.goalMode!=='distance' ||
      !integer(payload.targetMeters,100,200000) ||
      !integer(payload.deadlineSec,60,86400)) return null;
  return Object.freeze({
    goalMode:'distance',targetMeters:payload.targetMeters,deadlineSec:payload.deadlineSec,
  });
}

export async function distanceChallengeFingerprint(payload) {
  const rule=challengeRule(payload);
  if (!rule) return null;
  const bytes=new TextEncoder().encode(JSON.stringify([
    'beatonstep-distance-challenge-v2',rule.targetMeters,rule.deadlineSec,
  ]));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// This verdict checks consistency, not authenticity. Never grant or move a
// collectible solely from client-submitted samples. A trusted evidence
// transport/anti-replay gate must be applied separately before any D1 write.
export function assessDistanceEvidence(ruleInput,evidence) {
  const rule=challengeRule(ruleInput);
  if(!rule) return {status:'unverified',reason:'invalid_rule'};
  if(!evidence || !Array.isArray(evidence.samples) ||
      evidence.samples.length<3 || evidence.samples.length>3600 ||
      evidence.gpsGapSeen===true || evidence.locationSource!=='phone_gps') {
    return {status:'unverified',reason:'insufficient_evidence'};
  }
  let previous=null,winAt=null;
  let paused=false;
  for(const sample of evidence.samples){
    if(!sample || !integer(sample.elapsedSec,0,172800) ||
        !integer(sample.distanceMeters,0,500000) ||
        !['good','paused'].includes(sample.quality)) {
      return {status:'unverified',reason:'invalid_sample'};
    }
    if(previous){
      const deltaTime=sample.elapsedSec-previous.elapsedSec;
      const deltaDistance=sample.distanceMeters-previous.distanceMeters;
      if(deltaTime<=0 || deltaDistance<0){
        return {status:'unverified',reason:'implausible_progress'};
      }
      if(sample.quality==='paused'){
        // A pause event must begin while a live GPS reading is fresh.
        // All distance is frozen while the runner is paused.
        if(deltaDistance!==0 || (!paused && deltaTime>120)){
          return {status:'unverified',reason:'paused_distance_or_missing_start'};
        }
        paused=true;
      } else if(paused){
        // The FIRST reading after resume establishes a new native anchor.
        // No movement through the paused interval can be credited.
        if(deltaDistance!==0){
          return {status:'unverified',reason:'distance_during_pause'};
        }
        paused=false;
      } else if(deltaTime>120 || deltaDistance/deltaTime>11){
        return {status:'unverified',reason:'implausible_progress'};
      }
    } else if(sample.elapsedSec!==0 || sample.distanceMeters!==0 ||
        sample.quality!=='good'){
      return {status:'unverified',reason:'missing_start'};
    }
    if(sample.quality==='good' && winAt===null &&
        sample.distanceMeters>=rule.targetMeters){
      // Never infer a crossing during a pause or fill missing GPS points.
      winAt=sample.elapsedSec;
    }
    previous=sample;
  }
  if(winAt!==null && winAt<=rule.deadlineSec){
    return {status:'plausible_win',reason:'within_limit',elapsedSec:winAt};
  }
  if(previous.elapsedSec>=rule.deadlineSec){
    return {status:'lost',reason:'deadline_reached',elapsedSec:previous.elapsedSec};
  }
  return {status:'unverified',reason:'incomplete_attempt'};
}
