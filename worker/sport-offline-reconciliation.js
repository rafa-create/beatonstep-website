// #450 — reconcile one FINISHED offline run, never stream GPS while running.
//
// Acceptance is explicitly a good-faith product policy, not cryptographic
// verification by Garmin/Apple. Native watch/phone measurements are trusted
// unless plainly implausible. The caller must be authenticated by account.js.
// The endpoint is FEATURE DISABLED until the offline-first end-to-end tests
// and release gate have passed.
import {evaluateOfflineSportSummary} from './sport-offline-eligibility.js';
import {SPORT_CARD_RULESET,SPORT_CARD_DISTANCES,sportCardRulesManifest} from './sport-card-rules.js';

const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
}});
const digits=value=>Number.isSafeInteger(value)&&value>=0;
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const source=(v)=>v==='phone_gps'?'attested_phone':'verified_import';
// Compatibility with existing 1.7.2 cards, which cannot know the newly
// activated 800m/1500m/mile families. Never trust arbitrary client tiers.
const NEW_TRACK_CM=new Set([80000,150000,160934]);
const LEGACY_1KM_MINUTE_CAPS=Object.freeze(sportCardRulesManifest().legacyCapsByDistanceAndUnit?.['100000']?.minute||{world_elite:3,legend:5,expert:6,intermediate:7,regular:8,amateur:10,beginner:11});
const legacySportCard=(summary,current)=>{
  const actualCm=Math.floor(summary.distanceMeters*100+0.00001);
  const tier=[...SPORT_CARD_DISTANCES].reverse().find(c=>
    !NEW_TRACK_CM.has(c.distanceCm)&&c.distanceCm<=actualCm);
  if(!tier)return null;

  // 1.7.2 stored 1 km as whole minutes. Keep its original minute thresholds
  // and key even though the current canonical 1 km family now uses seconds.
  let old;
  if(tier.distanceCm===100000){
    const elapsedMs=summary.endedAtMs-summary.startedAtMs;
    if(!Number.isSafeInteger(elapsedMs)||elapsedMs<=0)return null;
    const subValue=Math.floor(elapsedMs/60000)+1;
    const difficulty=Object.keys(LEGACY_1KM_MINUTE_CAPS)
      .find(level=>subValue<=LEGACY_1KM_MINUTE_CAPS[level]);
    if(!difficulty)return null;
    old={
      status:'candidate',distanceCm:100000,timeUnit:'minute',subValue,
      subMinute:subValue,subSecond:null,
      difficulty,skin:'difficulty_'+difficulty+'_v1',
      performanceKey:'100000:minute:'+subValue,
      warningReasons:[],
    };
  }else{
    old=evaluateOfflineSportSummary({
      ...summary,distanceMeters:tier.distanceCm/100,
    });
    if(old.status!=='candidate')return null;
  }

  // Preserve speed warnings from the original measured distance, without
  // generating a false "inconsistent crossings" for a valid old 1km split.
  const reasons=[...new Set([
    ...(old.warningReasons||[]),
    ...(current.warningReasons||[]).filter(r=>r!=='inconsistent_crossings'),
  ])];
  return {...old,peakSpeedKmh:current.peakSpeedKmh,
    warningReasons:reasons,needsReviewWarning:reasons.length>0};
};

export async function reconcileOfflineSportResult(db,userId,body,{now=Date.now(),onAward=null}={}){
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
  const canonicalCandidate=evaluateOfflineSportSummary(summary);
  if(canonicalCandidate.status!=='candidate')
    return reply({status:'not_eligible',reason:canonicalCandidate.reason||'invalid_run'},422);
  const requested=body?.clientPerformanceKey;
  let candidate=canonicalCandidate;
  if((requested==null||requested!==canonicalCandidate.performanceKey)&&
     NEW_TRACK_CM.has(canonicalCandidate.distanceCm)){
    const legacy=legacySportCard(summary,canonicalCandidate);
    if(legacy&&(requested==null||requested===legacy.performanceKey))
      candidate=legacy;
  }
  // The client cannot demand a different, unverified distance or SUB tier.
  if(requested!=null&&requested!==candidate.performanceKey)
    return reply({error:'performance_key_mismatch'},409);

  // A digest tracks exact canonical input; it is NOT a claim that the source
  // has a Garmin cryptographic signature (good-faith policy is documented).
  const canonical=JSON.stringify([
    userId,runId,candidate.performanceKey,summary.distanceSource,
    summary.startedAtMs,summary.endedAtMs,summary.distanceMeters,
    // Legacy receipts used exactly seven fields. Preserve their digest when
    // no native GPS peak exists, including for repeated offline retries.
    ...(candidate.peakSpeedKmh===null?[]:[candidate.peakSpeedKmh]),
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
    db.prepare(`SELECT c.id,c.current_owner_id,c.owner_epoch,c.difficulty
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
    db.prepare(`SELECT c.id,c.current_owner_id,c.owner_epoch,c.difficulty
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
    const previous=await db.prepare(`SELECT c.distance_cm,c.time_unit,c.sub_value,
        r.evidence_digest
      FROM sport_verified_runs r JOIN sport_world_cards c ON c.id=r.card_id
      WHERE r.user_id=? AND r.run_id=?`).bind(userId,runId).first();
    // The run ID alone is not enough: reject a replay that changes the
    // measurement, source or timestamps while retaining the same tier.
    // The first committed evidence is immutable; no second ownership event.
    if(!previous||previous.distance_cm!==candidate.distanceCm||
       previous.time_unit!==candidate.timeUnit||
       previous.sub_value!==candidate.subValue||
       previous.evidence_digest!==digest)
      return reply({error:'run_already_used_for_different_evidence'},409);
  }
  const owned=current[0].current_owner_id===userId;
  const newRun=recorded.length===1;
  // Keep previous-owner identities private. The caller may celebrate a
  // conquest without identifying an athlete who did not consent.
  const transferred=newRun&&owned&&
    current[0].owner_epoch===prior[0].owner_epoch+1;
  // A previously existing card can become unowned after account deletion.
  // Claiming it is not its first-ever creation.
  // Review is enqueued only AFTER the successful world transfer, completely
  // independently of the database award transaction and its HTTP response.
  // A failure or delay in telemetry never revokes or prevents ownership.
  if(transferred&&typeof onAward==='function'){
    try{onAward({cardId:current[0].id,ownerEpoch:current[0].owner_epoch,
      needsWarning:candidate.needsReviewWarning===true,
      warningReasons:candidate.warningReasons||[],
      peakSpeedKmh:candidate.peakSpeedKmh,now});}
    catch{ /* optional telemetry is non-blocking */ }
  }
  const acquisition=!newRun?'already_processed':!owned?'superseded':
    !transferred?'already_owned':
    prior[0].current_owner_id==null
      ?result[0]?.meta?.changes===1?'created':'unclaimed'
      :prior[0].current_owner_id!==userId?'stolen':'already_owned';
  return reply({
    runId,performanceKey:candidate.performanceKey,cardId:current[0].id,
    worldStatus:owned?'confirmed':'lost',
    ownerEpoch:current[0].owner_epoch,awarded:newRun,acquisition,
    // Existing worldwide card keeps its stored historical classification.
    // Newly created cards use the CURRENT canonical rule manifest.
    difficulty:current[0].difficulty,
    completedAt:summary.endedAtMs,
  });
}
