// #450 Option A — server-observed progressive GPS telemetry, never raw coordinates.
// A client can spoof distance/elapsed: this checks continuity, clock, GPS quality,
// pauses and replay, NOT cryptographic Garmin or iPhone GPS attestation.
// Pilot accepts data only with an authenticated BEATONSTEP device bearer.
// World ownership changes remain explicitly OFF until field-test release gates.
import {SPORT_CARD_DISTANCES,evaluateSportCardCandidate}
  from './sport-card-rules.js';
import {acceptSignedSportReceipt} from './sport-awards.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
}});
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const key=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{16,128}$/.test(x);
const id=x=>typeof x==='string'&&/^[0-9a-f]{32}$/.test(x);
const bytes=new TextEncoder();
const hex=b=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(16)));

export function validateSportTelemetryPoints(rows,startedAt,finishedAt){
  if(!Array.isArray(rows)||rows.length<5||rows.length>5000||
     !integer(startedAt,1,4102444800000)||
     !integer(finishedAt,startedAt,4102444800000))
    return {ok:false,reason:'incomplete_telemetry'};
  if(finishedAt-startedAt<45000||finishedAt-startedAt>86400000)
    return {ok:false,reason:'invalid_duration'};
  let lastDistance=0,lastElapsed=0,lastReceived=startedAt,lastFixes=0,
      lastRejected=0,lastPaused=false;
  const crossings=[],seen=new Set();
  for(let i=0;i<rows.length;i++){
    const p=rows[i],dist=p.distance_cm,elapsed=p.elapsed_ms,at=p.received_at;
    const paused=p.paused===1||p.paused===true;
    const signal=p.signal,fixes=p.accepted_fixes,rejected=p.rejected_fixes;
    if(!integer(dist,0,20_000_000)||!integer(elapsed,0,86_400_000)||
       !integer(at,startedAt,finishedAt)||!integer(fixes,0,500000)||
       !integer(rejected,0,500000)||rejected>30||
       fixes<lastFixes||rejected<lastRejected||dist<lastDistance||
       elapsed<lastElapsed||at<lastReceived||
       (i>0&&(elapsed===lastElapsed||at===lastReceived))||
       Math.abs((at-startedAt)-elapsed)>20000)
      return {ok:false,reason:'clock_or_distance_inconsistent'};
    const deltaElapsed=elapsed-lastElapsed,deltaDistance=dist-lastDistance,
      gap=at-lastReceived;
    if(deltaDistance>0&&(paused||signal!=='good'||fixes<2))
      return {ok:false,reason:'distance_without_good_gps'};
    if(paused&&signal!=='paused')
      return {ok:false,reason:'invalid_pause_signal'};
    if(i>0&&gap>35000&&!lastPaused)
      return {ok:false,reason:'missing_live_samples'};
    if(i>0&&gap>12*3600000)
      return {ok:false,reason:'overlong_pause'};
    if(deltaDistance>0&&(deltaElapsed===0||
       deltaDistance/deltaElapsed>1.15))
      return {ok:false,reason:'implausible_speed'};
    if(p.seq!==i+1)return {ok:false,reason:'invalid_sequence'};
    let crossed=0;
    for(const family of SPORT_CARD_DISTANCES){
      if(family.distanceCm>lastDistance&&family.distanceCm<=dist){
        crossed++;
        if(seen.has(family.distanceCm))
          return {ok:false,reason:'repeated_crossing'};
        seen.add(family.distanceCm);
        crossings.push({distanceCm:family.distanceCm,elapsedMs:elapsed});
      }
    }
    // Two distinct canonical thresholds must not be "measured" at the same
    // instant. The next sample must actually observe the later threshold.
    if(crossed>1)return {ok:false,reason:'missing_split_timestamps'};
    lastDistance=dist;lastElapsed=elapsed;lastReceived=at;
    lastFixes=fixes;lastRejected=rejected;lastPaused=paused;
  }
  if(finishedAt-lastReceived>20000||lastFixes<5)
    return {ok:false,reason:'incomplete_finish'};
  const candidate=evaluateSportCardCandidate({
    finalized:true,evidenceVerified:true,
    finalDistanceCm:lastDistance,finishedElapsedMs:lastElapsed,crossings,
  });
  return {ok:true,candidate,finalDistanceCm:lastDistance,
    finishedElapsedMs:lastElapsed,crossings};
}
const getSession=(db,user,sessionId)=>db.prepare(`SELECT * FROM sport_telemetry_sessions
  WHERE id=? AND user_id=?`).bind(sessionId,user).first();
const reject=async(db,sessionId,user,reason)=>{
  await db.prepare(`UPDATE sport_telemetry_sessions SET
    status='rejected',reject_reason=?,ended_at=?
    WHERE id=? AND user_id=? AND status='tracking'`)
    .bind(reason,Date.now(),sessionId,user).run();
};
const pointValues=p=>{
  if(!p||typeof p!=='object'||Array.isArray(p)||
     !integer(p.seq,1,5000)||!integer(p.elapsedMs,0,86_400_000)||
     !integer(p.distanceCm,0,20_000_000)||
     !integer(p.acceptedFixes,0,500000)||
     !integer(p.rejectedFixes,0,500000)||
     typeof p.paused!=='boolean'||p.gpsGapSeen!==false||
     !['good','waiting','paused'].includes(p.signal)||
     (p.paused&&p.signal!=='paused')||
     (!p.paused&&p.signal==='paused'))
    return null;
  return p;
};
export async function sportTelemetryRequest(db,env,user,action,body,{
  now=Date.now(),
}={}){
  if(env.SPORT_TELEMETRY_ENABLED!=='true')
    return json({error:'telemetry_not_ready'},503);
  if(action==='start'){
    if(!key(body?.clientRunKey))return json({error:'invalid_run_key'},400);
    const sessionId=random();
    const existing=await db.prepare(`SELECT id,status FROM sport_telemetry_sessions
      WHERE user_id=? AND client_run_key=?`)
      .bind(user,body.clientRunKey).first();
    if(existing)return json({error:'already_started'},409);
    const active=await db.prepare(`SELECT id FROM sport_telemetry_sessions
      WHERE user_id=? AND status='tracking' LIMIT 1`).bind(user).first();
    if(active)return json({error:'already_tracking'},409);
    const r=await db.prepare(`INSERT INTO sport_telemetry_sessions
      (id,user_id,client_run_key,started_at,last_received_at)
      VALUES(?,?,?,?,?) ON CONFLICT(user_id,client_run_key) DO NOTHING
      RETURNING id`)
      .bind(sessionId,user,body.clientRunKey,now,now).first();
    return r?json({sessionId,startedAt:now,status:'tracking'},201)
      :json({error:'already_started'},409);
  }
  if(!id(body?.sessionId))return json({error:'invalid_session'},400);
  const current=await getSession(db,user,body.sessionId);
  if(!current)return json({error:'not_found'},404);
  if(action==='abandon'){
    if(current.status==='tracking')
      await reject(db,current.id,user,'abandoned_by_runner');
    return json({status:'not_awarded'});
  }
  if(current.status!=='tracking')
    return json({error:'session_closed',reason:current.reject_reason||null},409);
  if(action!=='point'&&action!=='finish')
    return json({error:'not_found'},404);
  const p=pointValues(body?.point);
  if(!p||p.seq!==current.last_seq+1){
    await reject(db,current.id,user,'invalid_or_missing_sequence');
    return json({error:'invalid_sequence'},409);
  }
  const deltaTime=now-current.last_received_at,
    deltaElapsed=p.elapsedMs-current.last_elapsed_ms,
    deltaDist=p.distanceCm-current.last_distance_cm;
  const impossible=
    now<current.started_at||now-current.started_at>86400000||
    Math.abs((now-current.started_at)-p.elapsedMs)>20000||
    p.elapsedMs<=current.last_elapsed_ms&&p.seq>1||
    p.distanceCm<current.last_distance_cm||
    p.acceptedFixes<current.last_accepted_fixes||
    deltaTime<0||(p.seq>1&&deltaTime===0)||
    (p.seq>1&&deltaTime>35000&&current.last_signal!=='paused')||
    (deltaDist>0&&(deltaElapsed<=0||
      deltaDist/deltaElapsed>1.15))||
    (deltaDist>0&&(p.paused||p.signal!=='good'||p.acceptedFixes<2));
  if(impossible){
    await reject(db,current.id,user,'gps_clock_or_speed_inconsistent');
    return json({error:'gps_inconsistent'},409);
  }
  const statements=[
    db.prepare(`INSERT INTO sport_telemetry_points
    (session_id,seq,received_at,elapsed_ms,distance_cm,
     paused,signal,accepted_fixes,rejected_fixes)
    SELECT id,?,?,?,?,?,?,?,?
    FROM sport_telemetry_sessions
    WHERE id=? AND user_id=? AND status='tracking' AND last_seq=?
    RETURNING seq`)
    .bind(p.seq,now,p.elapsedMs,p.distanceCm,p.paused?1:0,p.signal,
      p.acceptedFixes,p.rejectedFixes,current.id,user,current.last_seq),
    db.prepare(`UPDATE sport_telemetry_sessions SET
     last_seq=?,last_received_at=?,last_elapsed_ms=?,
     last_distance_cm=?,last_accepted_fixes=?,last_signal=?
    WHERE id=? AND user_id=? AND last_seq=? AND status='tracking'
    RETURNING id`)
    .bind(p.seq,now,p.elapsedMs,p.distanceCm,p.acceptedFixes,p.signal,
      current.id,user,current.last_seq),
  ];
  // Single D1 transaction prevents an orphaned sample if competing
  // requests race on the same sequence number.
  const [sampleWrite,sessionWrite]=await db.batch(statements);
  if((sampleWrite?.results||[]).length!==1||
     (sessionWrite?.results||[]).length!==1)
    return json({error:'concurrent_sample'},409);
  if(action==='point')return json({status:'observed',seq:p.seq});
  const points=await db.prepare(`SELECT * FROM sport_telemetry_points
    WHERE session_id=? ORDER BY seq ASC LIMIT 5001`)
    .bind(current.id).all();
  const validated=validateSportTelemetryPoints(points.results||[],
    current.started_at,now);
  if(!validated.ok){
    await reject(db,current.id,user,validated.reason);
    return json({status:'not_awarded',reason:validated.reason});
  }
  await db.prepare(`UPDATE sport_telemetry_sessions SET status='completed',
    ended_at=? WHERE id=? AND user_id=? AND status='tracking'`)
    .bind(now,current.id,user).run();
  // Audit first, award later. The current pilot is intentionally safe:
  // a distance-only feed can be spoofed by a modified client. Until field
  // tests and the fraud policy pass, not even valid telemetry triggers
  // sport_verified_runs or a world ownership theft.
  return json({status:'telemetry_recorded',
    eligible:validated.candidate.status==='candidate',
    reason:validated.candidate.reason||null,awarded:false});
}
