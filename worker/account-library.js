// #460: private account library. Never feeds the competitive card/ownership
// ledger: client snapshots are useful memories, not proof of a run.
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
}});
const clean=(x,n)=>typeof x==='string'
  ?[...x.replace(/[\u0000-\u001f\u007f]/g,' ').trim()].slice(0,n).join(''):'';
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const textEncoder=new TextEncoder();
const SOURCES=new Set(['local','server','spotify','deezer','youtube','apple','amazon']);
const TRACK_KEYS=['id','title','artist','album','bpm','duration','source','spotifyUri',
  'spotifyPlaylistId','deezerTrackId','deezerPlaylistId','youtubeVideoId',
  'youtubePlaylistId','youtubePlaylistIndex','appleCatalogSongId','appleLibrarySongId',
  'applePlaylistId','amazonTrackId','amazonAlbumId','amazonPlaylistId'];
async function inputJson(request,max=262144) {
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return null;
  if(Number(request.headers.get('content-length')||'0')>max)return null;
  const source=await request.text();
  if(textEncoder.encode(source).length>max)return null;
  try{
    const result=JSON.parse(source);
    return result&&typeof result==='object'&&!Array.isArray(result)?result:null;
  }catch{return null;}
}
const identity=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(x);
function safeTrack(track){
  if(!track||typeof track!=='object'||Array.isArray(track))return null;
  const item={};
  for(const field of TRACK_KEYS){
    const value=track[field];
    if(typeof value==='string')item[field]=clean(value,field==='title'?160:200);
    else if(typeof value==='number'&&Number.isFinite(value))item[field]=value;
    else if(value===null&&field==='bpm')item[field]=null;
  }
  // Never send device-local file paths or OAuth secrets to Cloudflare.
  return typeof item.title==='string'&&item.title?item:null;
}
function safeWorkout(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!identity(raw.id)||
      !clean(raw.name,80)||!SOURCES.has(raw.source)||
      !Array.isArray(raw.segments)||raw.segments.length<1||raw.segments.length>32||
      !Array.isArray(raw.playlistIds)||raw.playlistIds.length>100||
      raw.playlistIds.some(x=>typeof x!=='string'||x.length<1||x.length>256||
        /[\u0000-\u001f\u007f]/.test(x)))return null;
  const segments=[];
  for(const s of raw.segments){
    if(!s||!identity(s.id)||!clean(s.name,80)||!int(s.durationSec,30,14400)||
       !int(s.targetPpm,30,300)||
       (s.distanceMeters!=null&&!int(s.distanceMeters,50,100000)))return null;
    segments.push({id:s.id,name:clean(s.name,80),durationSec:s.durationSec,
      targetPpm:s.targetPpm,...(s.distanceMeters!=null?{distanceMeters:s.distanceMeters}:{})});
  }
  if(raw.goalMode!=null&&!['time','distance'].includes(raw.goalMode))return null;
  if(raw.deadlineSec!=null&&!int(raw.deadlineSec,60,86400))return null;
  const tracks=raw.selectedTracks;
  if(tracks!=null&&(!Array.isArray(tracks)||tracks.length>600))return null;
  const safeSelected=[];
  for(const s of tracks||[]){
    if(!s||!identity(s.segmentId)||!segments.some(x=>x.id===s.segmentId))return null;
    const track=safeTrack(s.track);if(!track)return null;
    safeSelected.push({segmentId:s.segmentId,track});
  }
  return {id:raw.id,name:clean(raw.name,80),source:raw.source,
    segments,playlistIds:raw.playlistIds,
    ...(raw.goalMode?{goalMode:raw.goalMode}:{}),
    ...(raw.deadlineSec!=null?{deadlineSec:raw.deadlineSec}:{}),
    ...(int(raw.publicCardId,1,999999999999999)?{publicCardId:raw.publicCardId}:{}),
    ...(tracks?{selectedTracks:safeSelected}:{})};
}
function safeRun(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!identity(raw.runId)||
     !raw.summary||typeof raw.summary!=='object')return null;
  const s=raw.summary;
  if(!int(s.startedAtMs,1577836800000,4102444800000)||
     !int(s.endedAtMs,s.startedAtMs,s.startedAtMs+604800000)||
     !int(s.durationSeconds,0,604800)||
     !['measured','target'].includes(s.cadence)||
     !Array.isArray(s.tracks)||s.tracks.length>300)return null;
  const trackList=[];
  for(const item of s.tracks){
    if(!item||!clean(item.title,160)||!int(item.listenedSeconds,1,604800))return null;
    trackList.push({
      title:clean(item.title,160),artist:clean(item.artist,100),
      bpm:typeof item.bpm==='number'&&Number.isFinite(item.bpm)?item.bpm:null,
      listenedSeconds:item.listenedSeconds,
      avgRunnerPpm:int(item.avgRunnerPpm,1,300)?item.avgRunnerPpm:null,
      stepCount:int(item.stepCount,1,10000000)?item.stepCount:null
    });
  }
  // A route is a relative 0..1000 shape, never raw lat/long coordinates.
  const route=Array.isArray(s.runRoute)&&s.runRoute.length>=2&&s.runRoute.length<=100&&
    s.runRoute.every(p=>Array.isArray(p)&&p.length===2&&
      int(p[0],0,1000)&&int(p[1],0,1000))?s.runRoute:null;
  const num=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&
    value>=min&&value<=max?value:null;
  const summary={
    cadence:s.cadence,startedAtMs:s.startedAtMs,endedAtMs:s.endedAtMs,
    durationSeconds:s.durationSeconds,
    workoutName:clean(s.workoutName,80)||null,
    avgRunnerPpm:num(s.avgRunnerPpm,1,300),
    avgMusicBpm:num(s.avgMusicBpm,1,400),
    avgGapBpm:num(s.avgGapBpm,0,400),
    stepCount:num(s.stepCount,1,10000000),
    distanceMeters:num(s.distanceMeters,0,10000000),
    averagePaceSecPerKm:num(s.averagePaceSecPerKm,1,86400),
    averageHeartRateBpm:num(s.averageHeartRateBpm,20,300),
    maxHeartRateBpm:num(s.maxHeartRateBpm,20,300),
    distanceSource:['garmin_mobile_stop','garmin_watch_saved','garmin_live_recap',
      'phone_gps'].includes(s.distanceSource)?s.distanceSource:null,
    runRoute:route,trackCount:trackList.length,tracks:trackList,
    trackOfRun:null,
  };
  if(s.trackOfRun&&typeof s.trackOfRun==='object'&&clean(s.trackOfRun.title,160)){
    summary.trackOfRun=trackList.find(x=>x.title===clean(s.trackOfRun.title,160))||null;
  }
  return {runId:raw.runId,sourceWorkoutId:identity(raw.sourceWorkoutId)
    ?raw.sourceWorkoutId:null,summary};
}
export async function accountLibraryRequest(request,db,url,userId){
  const path=url.pathname,method=request.method;
  const workouts=path.endsWith('/workouts');
  const runs=path.endsWith('/runs');
  const deleting=/\/workouts\/([a-zA-Z0-9_.:-]{1,128})$/.exec(path);
  if(!workouts&&!runs&&!deleting)return reply({error:'not_found'},404);
  if(method==='GET'&&(workouts||runs)){
    if(workouts){
      const cursor=clean(url.searchParams.get('after'),128);
      if(cursor&&!identity(cursor))return reply({error:'invalid_cursor'},400);
      const rows=await db.prepare(`SELECT workout_id,snapshot_json,revision,updated_at,deleted_at
        FROM account_workouts WHERE user_id=? AND workout_id>? ORDER BY workout_id ASC LIMIT 51`)
        .bind(userId,cursor).all();
      const list=(rows.results||[]), page=list.slice(0,50);
      return reply({items:page.map(x=>({workoutId:x.workout_id,
        workout:x.deleted_at?null:JSON.parse(x.snapshot_json),
        revision:x.revision,updatedAt:x.updated_at,deletedAt:x.deleted_at})),
        nextCursor:list.length>50?page.at(-1).workout_id:null});
    }
    const before=Number(url.searchParams.get('before')||0);
    const beforeId=url.searchParams.get('beforeId')||'';
    if(before!==0&&(!int(before,1,4102444800000)||!identity(beforeId)))
      return reply({error:'invalid_cursor'},400);
    const rows=await db.prepare(`SELECT run_id,snapshot_json,source_workout_id,ended_at
      FROM account_run_records WHERE user_id=? AND
        (?=0 OR ended_at<? OR (ended_at=? AND run_id<?))
      ORDER BY ended_at DESC,run_id DESC LIMIT 51`)
      .bind(userId,before,before,before,beforeId).all();
    const list=rows.results||[],page=list.slice(0,50),last=page.at(-1);
    return reply({items:page.map(x=>({runId:x.run_id,
      summary:JSON.parse(x.snapshot_json),sourceWorkoutId:x.source_workout_id})),
      nextCursor:list.length>50?{before:last.ended_at,beforeId:last.run_id}:null});
  }
  if(workouts&&method==='PUT'){
    const input=await inputJson(request);
    const workout=safeWorkout(input?.workout);
    const revision=input?.expectedRevision;
    if(!workout||!int(revision,0,2147483647))return reply({error:'invalid_workout'},400);
    const now=Date.now();
    // Creation requires revision 0. Updates require the exact server revision.
    // A stale device must never resurrect a tombstoned workout.
    const changed=revision===0
      ?await db.prepare(`INSERT INTO account_workouts
        (user_id,workout_id,snapshot_json,revision,created_at,updated_at,deleted_at)
        VALUES(?,?,?,1,?,?,NULL)
        ON CONFLICT(user_id,workout_id) DO NOTHING RETURNING revision`)
        .bind(userId,workout.id,JSON.stringify(workout),now,now).first()
      :await db.prepare(`UPDATE account_workouts
        SET snapshot_json=?,revision=revision+1,updated_at=?
        WHERE user_id=? AND workout_id=? AND revision=? AND deleted_at IS NULL
        RETURNING revision`)
        .bind(JSON.stringify(workout),now,userId,workout.id,revision).first();
    return changed?reply({saved:true,revision:changed.revision})
      :reply({error:'revision_conflict'},409);
  }
  if(deleting&&method==='DELETE'){
    const data=await inputJson(request,4096),rev=data?.expectedRevision;
    if(!int(rev,1,2147483647))return reply({error:'invalid_revision'},400);
    const row=await db.prepare(`UPDATE account_workouts SET deleted_at=?,updated_at=?,
      revision=revision+1 WHERE user_id=? AND workout_id=? AND revision=?
      AND deleted_at IS NULL RETURNING revision`)
      .bind(Date.now(),Date.now(),userId,deleting[1],rev).first();
    return row?reply({deleted:true,revision:row.revision})
      :reply({error:'revision_conflict'},409);
  }
  if(runs&&method==='POST'){
    const input=await inputJson(request),run=safeRun(input?.run);
    if(!run)return reply({error:'invalid_run'},400);
    const s=run.summary;
    const result=await db.prepare(`INSERT INTO account_run_records
      (user_id,run_id,snapshot_json,source_workout_id,started_at,ended_at,recorded_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,run_id) DO NOTHING`)
      .bind(userId,run.runId,JSON.stringify(s),run.sourceWorkoutId,
        s.startedAtMs,s.endedAtMs,Date.now()).run();
    return reply({recorded:true,created:result.meta?.changes===1},result.meta?.changes===1?201:200);
  }
  return reply({error:'method_not_allowed'},405);
}
