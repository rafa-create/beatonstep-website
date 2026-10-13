// #450 — reconcile one FINISHED offline run, never stream GPS while running.
//
// Acceptance is explicitly a good-faith product policy, not cryptographic
// verification by Garmin/Apple. Native watch/phone measurements are trusted
// unless plainly implausible. The caller must be authenticated by account.js.
// The endpoint is FEATURE DISABLED until the offline-first end-to-end tests
// and release gate have passed.
import {evaluateOfflineSportSummary} from './sport-offline-eligibility.js';
import {SPORT_CARD_RULESET} from './sport-card-rules.js';

const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
}});
const digits=value=>Number.isSafeInteger(value)&&value>=0;
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const source=(v)=>v==='phone_gps'?'attested_phone':'verified_import';

export async function reconcileOfflineSportResult(db,userId,body,{now=Date.now()}={}){
  const runId=body?.runId,summary=body?.summary;
  if(typeof runId!=='string'||!/^run-[0-9]{10,13}-[0-9]{10,13}$/.test(runId)||
     !summary||typeof summary!=='object'||Array.isArray(summary)||
     !digits(summary.startedAtMs)||!digits(summary.endedAtMs)||
     runId!=='run-'+summary.startedAtMs+'-'+summary.endedAtMs||
     summary.endedAtMs>now+120000||
     summary.startedAtMs<Date.UTC(2020,0,1))
    return reply({error:'invalid_finished_run'},400);

  // Client-supplied "evidenceVerified" / "won" fields are ignored. The
  // server independently applies the same published game thresholds.
  const candidate=evaluateOfflineSportSummary(summary);
  if(candidate.status!=='candidate')
    return reply({status:'not_eligible',reason:candidate.reason||'invalid_run'},422);

  // A digest tracks exact canonical input; it is NOT a claim that the source
  // has a Garmin cryptographic signature (good-faith policy is documented).
  const canonical=JSON.stringify([
    userId,runId,candidate.performanceKey,summary.distanceSource,
    summary.startedAtMs,summary.endedAtMs,summary.distanceMeters,
  ]);
  const digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(canonical))));

  // One D1 transaction inserts the canonical card, captures the prior
  // owner, records the run (0010 ownership trigger) and reads the owner again.
  // The event type cannot be derived from awarded=true alone.
  const writes=[
    db.prepare(`INSERT INTO sport_world_cards
      (distance_cm,time_unit,sub_value,difficulty,ruleset,created_at)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(distance_cm,time_unit,sub_value) DO NOTHING`)
      .bind(candidate.distanceCm,candidate.timeUnit,candidate.subValue,
        candidate.difficulty,SPORT_CARD_RULESET,now),
    db.prepare(`SELECT c.id,c.current_owner_id,c.owner_epoch
      FROM sport_world_cards c WHERE c.distance_cm=? AND c.time_unit=?
        AND c.sub_value=? AND c.ruleset=?`)
      .bind(candidate.distanceCm,candidate.timeUnit,
        candidate.subValue,SPORT_CARD_RULESET),
    db.prepare(`INSERT INTO sport_verified_runs
      (user_id,run_id,card_id,completed_at,verified_at,
       evidence_digest,evidence_source)
      SELECT ?,?,c.id,?,?,?,?
      FROM sport_world_cards c
      WHERE c.distance_cm=? AND c.time_unit=? AND c.sub_value=?
        AND c.ruleset=?
      ON CONFLICT(user_id,run_id) DO NOTHING RETURNING card_id`)
      .bind(userId,runId,summary.endedAtMs,now,digest,
        source(summary.distanceSource),candidate.distanceCm,
        candidate.timeUnit,candidate.subValue,SPORT_CARD_RULESET),
    db.prepare(`SELECT c.id,c.current_owner_id,c.owner_epoch
      FROM sport_world_cards c WHERE c.distance_cm=? AND c.time_unit=?
        AND c.sub_value=? AND c.ruleset=?`)
      .bind(candidate.distanceCm,candidate.timeUnit,
        candidate.subValue,SPORT_CARD_RULESET),
  ];
  const result=await db.batch(writes);
  const prior=result[1]?.results||[],recorded=result[2]?.results||[],
    current=result[3]?.results||[];
  if(prior.length!==1||current.length!==1||!digits(current[0].id)||
     !digits(prior[0].owner_epoch)||!digits(current[0].owner_epoch)||
     recorded.length>1)throw Error('sport_reconciliation_integrity_failure');

  if(recorded.length===0){
    // An idempotent replay MUST belong to this same exact tier. The PK is
    // per-user run: never turn a previous 5 km run into a second 10 km card.
    const previous=await db.prepare(`SELECT c.distance_cm,c.time_unit,c.sub_value
      FROM sport_verified_runs r JOIN sport_world_cards c ON c.id=r.card_id
      WHERE r.user_id=? AND r.run_id=?`).bind(userId,runId).first();
    if(!previous||previous.distance_cm!==candidate.distanceCm||
       previous.time_unit!==candidate.timeUnit||
       previous.sub_value!==candidate.subValue)
      return reply({error:'run_already_used_for_different_card'},409);
  }
  const owned=current[0].current_owner_id===userId;
  const newRun=recorded.length===1;
  // Keep previous-owner identities private. The caller may celebrate a
  // conquest without identifying an athlete who did not consent.
  const transferred=newRun&&owned&&
    current[0].owner_epoch===prior[0].owner_epoch+1;
  const acquisition=!newRun?'already_processed':!owned?'superseded':
    !transferred?'already_owned':
    prior[0].current_owner_id==null?'created':
    prior[0].current_owner_id!==userId?'stolen':'already_owned';
  return reply({
    runId,performanceKey:candidate.performanceKey,cardId:current[0].id,
    worldStatus:owned?'confirmed':'lost',
    ownerEpoch:current[0].owner_epoch,awarded:newRun,acquisition,
    completedAt:summary.endedAtMs,
  });
}
