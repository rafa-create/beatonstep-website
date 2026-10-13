// #445/#450 — server-to-server trusted sport award writer (NOT an HTTP route).
// A client recap, distance meter or boolean "evidenceVerified" is NOT proof.
// Only a separate VM/provider adapter that actually checks the activity may
// HMAC-sign a receipt. The secret must NEVER be shipped to an iOS/Android app,
// browser, SDK, repository, log or public route. The Worker has no award route.
//
// After migration 0010, each NEW verified_run INSERT atomically triggers
// achievement + same-tier worldwide ownership transfer. A replay is a no-op.
import {evaluateSportCardCandidate,SPORT_CARD_RULESET}
  from './sport-card-rules.js';

const te=new TextEncoder();
const safeInt=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(x);
const hexString=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fromHex=x=>new Uint8Array(x.match(/.{2}/g).map(n=>parseInt(n,16)));
const result=(status,extra={})=>({status,...extra});

export async function acceptSignedSportReceipt(db,env,rawBody,signedAt,signature,{
  now=Date.now(),
}={}){
  const secret=env?.SPORT_ATTESTATION_HMAC_SECRET;
  // This is deliberately disabled until a real, independently validating
  // server-to-server adapter and a private secret are provisioned.
  if(typeof secret!=='string'||secret.length<48)
    return result('disabled',{reason:'attestation_not_configured'});
  if(typeof rawBody!=='string'||te.encode(rawBody).length>131072||
     !safeInt(signedAt,1,4102444800000)||
     !safeInt(now,1,4102444800000)||
     Math.abs(now-signedAt)>300000||
     !hexString(signature))
    return result('rejected',{reason:'invalid_signature_envelope'});

  const key=await crypto.subtle.importKey('raw',te.encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['verify']);
  const mac=te.encode('beatonstep-sport-receipt-v1\n'+signedAt+'\n'+rawBody);
  if(!await crypto.subtle.verify('HMAC',key,fromHex(signature),mac))
    return result('rejected',{reason:'invalid_signature'});
  let proof;
  try {proof=JSON.parse(rawBody)} catch {
    return result('rejected',{reason:'invalid_payload'});
  }
  if(!proof||typeof proof!=='object'||Array.isArray(proof)||
     !validId(proof.userId)||!validId(proof.runId)||
     !hexString(proof.evidenceDigest)||
     !['attested_phone','verified_import'].includes(proof.evidenceSource)||
     !safeInt(proof.completedAt,1577836800000,now)||
     !safeInt(proof.finalDistanceCm,0,20000000)||
     !safeInt(proof.finishedElapsedMs,1,604800000)||
     !Array.isArray(proof.crossings))
    return result('rejected',{reason:'invalid_payload'});

  // Only the HMAC-verified adapter can reach this pure eligibility evaluator.
  // Still enforces longest distance, exact timestamp and pause-inclusive clock.
  const candidate=evaluateSportCardCandidate({
    finalized:true,evidenceVerified:true,
    finalDistanceCm:proof.finalDistanceCm,
    finishedElapsedMs:proof.finishedElapsedMs,
    crossings:proof.crossings,
  });
  if(candidate.status!=='candidate')
    return result('no_award',{reason:candidate.reason});

  // D1 db.batch guarantees a transaction. The trigger installed in 0010
  // handles ownership/achievements inside the INSERT statement, so a failure
  // in the trigger rolls back that INSERT and its event changes together.
  const [cardWrite,verification]=await db.batch([
    db.prepare(`INSERT INTO sport_world_cards
      (distance_cm,time_unit,sub_value,difficulty,ruleset,created_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(distance_cm,time_unit,sub_value)
      DO NOTHING`)
      .bind(candidate.distanceCm,candidate.timeUnit,candidate.subValue,
        candidate.difficulty,SPORT_CARD_RULESET,now),
    db.prepare(`INSERT INTO sport_verified_runs
      (user_id,run_id,card_id,completed_at,verified_at,
       evidence_digest,evidence_source)
      SELECT ?,?,c.id,?,?,?,?
      FROM sport_world_cards c
      WHERE c.distance_cm=? AND c.time_unit=? AND c.sub_value=?
        AND c.ruleset=?
      ON CONFLICT(user_id,run_id) DO NOTHING
      RETURNING card_id`)
      .bind(proof.userId,proof.runId,proof.completedAt,now,
        proof.evidenceDigest,proof.evidenceSource,
        candidate.distanceCm,candidate.timeUnit,candidate.subValue,
        SPORT_CARD_RULESET)
  ]);
  const ids=verification?.results||[];
  if(!ids.length){
    if(verification?.meta?.changes!==0)
      throw Error('sport_receipt_integrity_failure');
    return result('replay',{performanceKey:candidate.performanceKey});
  }
  if(ids.length!==1||!safeInt(ids[0].card_id,1,Number.MAX_SAFE_INTEGER)||
     verification?.meta?.changes!==1)
    throw Error('sport_receipt_integrity_failure');
  return result('recorded',{
    cardId:ids[0].card_id,performanceKey:candidate.performanceKey,
    distanceCm:candidate.distanceCm,subValue:candidate.subValue,
    difficulty:candidate.difficulty,
  });
}
