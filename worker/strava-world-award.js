// Server-only award of a single Strava activity. No mobile-supplied
// distance, speed, timestamps, or GPS position can mint a world card.
import {devicePublisher} from './account.js';
import {evaluateOfflineSportSummary} from './sport-offline-eligibility.js';
import {reconcileOfflineSportResult} from './sport-offline-reconciliation.js';
import {classifyStravaSportImport} from './strava-import-eligibility.js';
import {ensureSportTelemetrySchema,enqueueSportTelemetryReview,
  processPendingSportTelemetryReviews} from './sport-card-telemetry.js';
import {processPendingSportWarningEmails} from './sport-warning-email.js';

const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
}});
const runs=new Set(['Run','TrailRun','VirtualRun']);
const idPattern=/^[1-9][0-9]{0,19}$/;
async function stravaGet(token,url){
  let res;
  try{res=await fetch(url,{headers:{authorization:'Bearer '+token,accept:'application/json'}});}
  catch{return {error:'strava_unavailable',status:503};}
  if(res.status===429)return {error:'strava_rate_limited',status:429};
  if(res.status===404)return {error:'strava_not_found',status:404};
  if(res.status===401||res.status===403)
    return {error:'strava_read_permission_required',status:403};
  if(!res.ok)return {error:'strava_unavailable',status:502};
  try{return {data:await res.json()};}
  catch{return {error:'strava_invalid_response',status:502};}
}

/**
 * Caller authenticates BOTH the existing Strava installation (row, decrypted
 * token) and a live BeatOnStep device session. The new gate stays off by
 * default until D1 migration, privacy review and device testing.
 */
export async function claimLatestStravaSport(request,env,row,token,ctx){
  if(env.STRAVA_IMPORT_AWARDS_ENABLED!=='true'||
     env.SPORT_WORLD_CARDS_ENABLED!=='true'||
     env.SPORT_AUTO_AWARDS_ENABLED!=='true')
    return reply({status:'not_enabled'});
  if(!row||!token)return reply({error:'not_connected'},401);
  const member=await devicePublisher(env.DB,request);
  if(!member)return reply({status:'account_required'});
  const previouslyBound=await env.DB.prepare(
    'SELECT user_id FROM strava_athlete_award_bindings WHERE athlete_id=?')
    .bind(row.athlete_id).first();
  if(previouslyBound&&previouslyBound.user_id!==member.id)
    return reply({status:'history_only',reason:'strava_account_linked_elsewhere'});
  const listings=await stravaGet(token,
    'https://www.strava.com/api/v3/athlete/activities?per_page=30&page=1');
  if(listings.error)return reply({error:listings.error},listings.status);
  if(!Array.isArray(listings.data))return reply({error:'strava_invalid_response'},502);
  const latest=listings.data.find(a=>a&&runs.has(a.sport_type||a.type));
  if(!latest)return reply({status:'history_only',reason:'no_recent_run'});
  const activityId=String(latest.id||'');
  if(!idPattern.test(activityId))return reply({error:'strava_invalid_response'},502);
  let requested;
  try{requested=await request.json();}catch{return reply({error:'invalid_payload'},400);}
  if(!requested||typeof requested!=='object'||String(requested.activityId)!==activityId)
    return reply({status:'history_only',reason:'latest_activity_changed'});
  // One athlete/activity worldwide, even after reinstallation or account switch.
  const old=await env.DB.prepare('SELECT user_id,state,result_json,created_at FROM strava_activity_award_claims WHERE athlete_id=? AND activity_id=?')
    .bind(row.athlete_id,activityId).first();
  if(old?.user_id!==undefined && old.user_id!==member.id)
    return reply({status:'history_only',reason:'already_claimed'});
  if(old?.state==='complete'&&old.result_json){
    let details=null;try{details=JSON.parse(old.result_json);}catch{}
    return reply({status:'already_claimed',...details});
  }
  if(old?.state==='history_only')return reply({status:'history_only',reason:'already_processed'});
  if(old?.state==='pending'&&Date.now()-old.created_at<60000)
    return reply({status:'pending',reason:'claim_in_progress'});
  // If the activity was exported by BeatOnStep, it is the SAME run.
  const exported=await env.DB.prepare(
    'SELECT 1 AS match FROM strava_exports WHERE athlete_id=? AND activity_id=? LIMIT 1')
    .bind(row.athlete_id,activityId).first();
  if(exported)return reply({status:'history_only',reason:'already_recorded_beatonstep'});

  const detail=await stravaGet(token,'https://www.strava.com/api/v3/activities/'+activityId);
  if(detail.error)return reply({error:detail.error},detail.status);
  const activity=detail.data;
  if(!activity||String(activity.id||'')!==activityId||
     (activity.athlete?.id!=null&&String(activity.athlete.id)!==String(row.athlete_id)))
    return reply({error:'strava_invalid_response'},502);
  // Coordinates are inspected in memory only; never returned to the caller or D1.
  const streams=await stravaGet(token,'https://www.strava.com/api/v3/activities/'+activityId+
    '/streams?keys=time,latlng,distance,cadence,heartrate&key_by_type=true');
  if(streams.error&&streams.error!=='strava_read_permission_required'&&
     streams.error!=='strava_not_found')
    return reply({error:streams.error},streams.status);
  const evidence=classifyStravaSportImport(activity,streams.data||null);
  if(!evidence.eligible)
    return reply({status:'history_only',reason:evidence.reason});
  const duplicate=await env.DB.prepare(
    'SELECT 1 AS match FROM sport_verified_runs WHERE user_id=? AND completed_at BETWEEN ? AND ? LIMIT 1')
    .bind(member.id,evidence.endedAtMs-30000,evidence.endedAtMs+30000).first();
  if(duplicate)return reply({status:'history_only',reason:'already_recorded_beatonstep'});
  const summary={
    startedAtMs:evidence.startedAtMs,endedAtMs:evidence.endedAtMs,
    distanceMeters:evidence.distanceMeters,distanceSource:'strava_import',
    ...(evidence.peakSpeedKmh!==null?{peakSpeedKmh:evidence.peakSpeedKmh}:{}),
    stravaFlagged:evidence.warningReasons.includes('strava_flagged'),
  };
  const candidate=evaluateOfflineSportSummary(summary);
  if(candidate.status!=='candidate')
    return reply({status:'history_only',reason:candidate.reason||'below_threshold'});
  const runId='run-'+evidence.startedAtMs+'-'+evidence.endedAtMs;
  // First valid trophy attempt binds the Strava athlete to one BeatOnStep
  // account. Reinstalls and account switches do NOT reset that relationship.
  await env.DB.prepare(
    'INSERT INTO strava_athlete_award_bindings (athlete_id,user_id,linked_at) '+
    'VALUES (?,?,?) ON CONFLICT DO NOTHING'
  ).bind(row.athlete_id,member.id,Date.now()).run();
  const bound=await env.DB.prepare(
    'SELECT user_id FROM strava_athlete_award_bindings WHERE athlete_id=?')
    .bind(row.athlete_id).first();
  if(!bound||bound.user_id!==member.id)
    return reply({status:'history_only',reason:'strava_account_linked_elsewhere'});
  if(!old){
    const inserted=await env.DB.prepare(
      "INSERT INTO strava_activity_award_claims (athlete_id,activity_id,user_id,run_id,state,created_at) "+
      "VALUES (?,?,?,?,'pending',?) ON CONFLICT DO NOTHING"
    ).bind(row.athlete_id,activityId,member.id,runId,Date.now()).run();
    if(!inserted.meta?.changes)return reply({status:'pending',reason:'claim_in_progress'});
  }else{
    await env.DB.prepare(
      "UPDATE strava_activity_award_claims SET created_at=? "+
      "WHERE athlete_id=? AND activity_id=? AND user_id=? AND state='pending'"
    ).bind(Date.now(),row.athlete_id,activityId,member.id).run();
  }
  const response=await reconcileOfflineSportResult(env.DB,member.id,{
    runId,summary,clientPerformanceKey:candidate.performanceKey,
  },{
    onAward:env.SPORT_ASYNC_TELEMETRY_ENABLED==='true'?review=>{
      const task=(async()=>{
        await ensureSportTelemetrySchema(env.DB);
        await enqueueSportTelemetryReview(env.DB,review.cardId,review.ownerEpoch,
          review.needsWarning,{now:review.now,reasonCodes:review.warningReasons,
            peakSpeedKmh:review.peakSpeedKmh});
        await processPendingSportTelemetryReviews(env.DB);
        await processPendingSportWarningEmails(env.DB,env);
      })().catch(()=>console.warn('Strava award telemetry deferred'));
      if(ctx?.waitUntil)ctx.waitUntil(task);
      else void task;
    }:null,
  });
  if(!response.ok){
    const failed=await response.json().catch(()=>({}));
    // Pending reservation is retryable by the SAME user after 60 s.
    return reply({status:'pending',reason:failed.error||'claim_not_confirmed'},202);
  }
  const result=await response.json();
  const safe={
    performanceKey:result.performanceKey,worldStatus:result.worldStatus,
    cardId:result.cardId,awarded:result.awarded,
    acquisition:result.acquisition,difficulty:result.difficulty,
  };
  await env.DB.prepare(
    "UPDATE strava_activity_award_claims SET state='complete',completed_at=?,result_json=? "+
    "WHERE athlete_id=? AND activity_id=? AND user_id=?"
  ).bind(Date.now(),JSON.stringify(safe),row.athlete_id,activityId,member.id).run();
  return reply({status:'awarded',...safe});
}
