// OAuth + manual Strava exports; OTA-safe optional workout metrics.
// No raw geographic fixes or native GPS upload in the OTA delivery.
// Requires STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_ENCRYPTION_KEY and D1 migration.
// No client-side Strava secret. Never log access/refresh tokens or authorization codes.
import {claimLatestStravaSport} from './strava-world-award.js';
import {stravaApiEnabled} from './strava-api-config.js';

const PREFIX = '/api/strava';
const SITE = 'https://beatonstep.app';
const CALLBACK = SITE + PREFIX + '/callback';
const encoder = new TextEncoder();

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: {'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff'},
  });
}
function hex(bytes) {
  return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
}
function randomHex(count = 32) { return hex(crypto.getRandomValues(new Uint8Array(count))); }
function bytes(hexString) {
  if (!/^[a-f0-9]{64}$/.test(hexString || '')) throw Error('strava_key_invalid');
  return new Uint8Array(hexString.match(/../g).map(x => Number.parseInt(x, 16)));
}
async function sha256(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function cryptoKey(env) {
  return crypto.subtle.importKey('raw', bytes(env.STRAVA_ENCRYPTION_KEY),
    {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
}
async function seal(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, encoder.encode(value));
  return {nonce: hex(iv), encrypted: hex(new Uint8Array(ciphertext))};
}
async function unseal(key, nonce, encrypted) {
  if (!/^[a-f0-9]{24}$/.test(nonce || '') || !/^(?:[a-f0-9]{2})+$/.test(encrypted || '')) {
    throw Error('strava_cipher_invalid');
  }
  const fromHex = value => new Uint8Array(value.match(/../g).map(x => Number.parseInt(x, 16)));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: fromHex(nonce)},
    key, fromHex(encrypted)));
}
function configured(env) {
  return Boolean(env.DB && /^[0-9]+$/.test(String(env.STRAVA_CLIENT_ID || '')) &&
    env.STRAVA_CLIENT_SECRET && /^[a-f0-9]{64}$/.test(env.STRAVA_ENCRYPTION_KEY || '') &&
    stravaApiEnabled(env));
}
function capacity(env) {
  const n = Number(env.STRAVA_ATHLETE_CAPACITY || 1);
  return Number.isSafeInteger(n) && n >= 1 && n <= 9999 ? n : 1;
}
async function deviceHash(request) {
  const token = request.headers.get('x-bos-strava-key') || '';
  return /^[a-f0-9]{64}$/.test(token) ? sha256('strava-device-v1:' + token) : null;
}
async function jsonBody(request,maxLength=2048) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return null;
  const raw = await request.text();
  if (raw.length > maxLength) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}
async function usage(db) {
  const row = await db.prepare('SELECT COUNT(*) AS used FROM strava_connections').first();
  return Number(row?.used || 0);
}
async function connection(db, device) {
  return db.prepare('SELECT * FROM strava_connections WHERE device_hash=?').bind(device).first();
}
function appReturn(result) {
  return Response.redirect('beatonstep://strava-auth?result=' + encodeURIComponent(result), 302);
}
async function oauthToken(env, params) {
  const data = new URLSearchParams({
    client_id: String(env.STRAVA_CLIENT_ID),
    client_secret: env.STRAVA_CLIENT_SECRET,
    ...params,
  });
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST', body: data, headers: {'content-type': 'application/x-www-form-urlencoded'},
  });
  if (!res.ok) {
    // Report only the HTTP status, never Strava's response body or credentials.
    // 401/403 may indicate a disabled/unapproved developer API, invalid
    // credentials or another upstream access refusal; do not claim payment
    // is definitively the cause.
    console.warn('Strava OAuth token response','http_status='+res.status);
    throw Error(res.status===401||res.status===403
      ?'strava_api_access_denied':'strava_oauth_failed');
  }
  const body = await res.json();
  if (!body || !body.refresh_token || !body.access_token ||
    !Number.isFinite(Number(body.expires_at))) throw Error('strava_oauth_invalid');
  return body;
}
async function callback(request, env, url) {
  const state = url.searchParams.get('state') || '';
  if (!/^[a-f0-9]{64}$/.test(state)) return appReturn('invalid_state');
  const now = Date.now();
  const claimed = await env.DB.prepare(
    'DELETE FROM strava_oauth_pending WHERE state_hash=? AND expires_at>? RETURNING device_hash'
  ).bind(await sha256(state), now).first();
  if (!claimed) return appReturn('expired');
  if (url.searchParams.get('error')) return appReturn('cancelled');
  const code = url.searchParams.get('code') || '';
  const scopes = (url.searchParams.get('scope') || '').split(/[,\s]+/);
  if (!code) return appReturn('permission_required');
  try {
    const token = await oauthToken(env, {code, grant_type: 'authorization_code'});
    if (!scopes.includes('activity:write') || !scopes.includes('activity:read')) {
      // A grant without activity:write is not useful and may still consume capacity.
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method:'POST', headers:{authorization:'Bearer '+token.access_token},
      }).catch(() => {});
      return appReturn('permission_required');
    }
    const athleteId = String(token.athlete?.id || '');
    if (!/^[0-9]+$/.test(athleteId)) return appReturn('invalid_athlete');
    const key = await cryptoKey(env);
    const refresh = await seal(key, token.refresh_token);
    const access = await seal(key, token.access_token);
    // This single D1 statement serializes admission. Two simultaneous callbacks
    // cannot insert an 11th athlete. Reauthorization of an existing athlete is allowed.
    const insert = await env.DB.prepare(
      'INSERT INTO strava_connections ' +
      '(device_hash,athlete_id,refresh_nonce,refresh_cipher,access_nonce,access_cipher,expires_at,updated_at) ' +
      'SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM strava_connections) < ? ' +
      'OR EXISTS (SELECT 1 FROM strava_connections WHERE athlete_id=?) ' +
      'ON CONFLICT(athlete_id) DO UPDATE SET device_hash=excluded.device_hash, ' +
      'refresh_nonce=excluded.refresh_nonce,refresh_cipher=excluded.refresh_cipher, ' +
      'access_nonce=excluded.access_nonce,access_cipher=excluded.access_cipher, ' +
      'expires_at=excluded.expires_at,updated_at=excluded.updated_at'
    ).bind(claimed.device_hash, athleteId, refresh.nonce, refresh.encrypted,
      access.nonce, access.encrypted, Number(token.expires_at), now,
      capacity(env), athleteId).run();
    if (!insert.meta?.changes) {
      // Reject rather than knowingly retain an extra authorization.
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method:'POST', headers:{authorization:'Bearer ' + token.access_token},
      }).catch(() => {});
      return appReturn('full');
    }
    return appReturn('connected');
  } catch (error) {
    const reason=error instanceof Error?error.message:'unknown';
    console.error('Strava OAuth callback unsuccessful',
      reason==='strava_api_access_denied'?'upstream_access_denied':'exchange_failed');
    return appReturn(reason==='strava_api_access_denied'?'api_access_unavailable':'failed');
  }
}
async function accessToken(env, row) {
  const key = await cryptoKey(env);
  if (Number(row.expires_at) > Math.floor(Date.now()/1000) + 60) {
    return unseal(key, row.access_nonce, row.access_cipher);
  }
  const oldRefresh = row.refresh_cipher;
  const refreshToken = await unseal(key, row.refresh_nonce, oldRefresh);
  const next = await oauthToken(env, {grant_type: 'refresh_token', refresh_token: refreshToken});
  const newRefresh = await seal(key, next.refresh_token);
  const newAccess = await seal(key, next.access_token);
  const change = await env.DB.prepare(
    'UPDATE strava_connections SET refresh_nonce=?,refresh_cipher=?,access_nonce=?,access_cipher=?, ' +
    'expires_at=?,updated_at=? WHERE device_hash=? AND refresh_cipher=?'
  ).bind(newRefresh.nonce, newRefresh.encrypted, newAccess.nonce, newAccess.encrypted,
    Number(next.expires_at), Date.now(), row.device_hash, oldRefresh).run();
  if (!change.meta?.changes) {
    // Another request refreshed the token first: use the last persisted token.
    const latest = await connection(env.DB, row.device_hash);
    if (!latest) throw Error('strava_not_connected');
    return unseal(key, latest.access_nonce, latest.access_cipher);
  }
  return next.access_token;
}
function optionalMetric(value,min,max){
  if(value==null)return null;
  return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max
    ?value:NaN;
}
function metricDescription({pace,averageHeartRate,maxHeartRate,cadence}){
  const fields=['Course avec BeatOnStep — la musique au rythme des pas.'];
  if(pace!==null){
    const seconds=Math.round(pace);
    fields.push('Allure moyenne : '+Math.floor(seconds/60)+':' +
      String(seconds%60).padStart(2,'0')+'/km');
  }
  if(averageHeartRate!==null)fields.push('FC moyenne : '+Math.round(averageHeartRate)+' bpm');
  if(maxHeartRate!==null)fields.push('FC max : '+Math.round(maxHeartRate)+' bpm');
  if(cadence!==null)fields.push('Cadence moyenne : '+Math.round(cadence)+' pas/min');
  return fields.join(' | ');
}
const metric=(value,min,max)=>
  value==null ? null : typeof value==='number'&&Number.isFinite(value)&&
  value>=min&&value<=max?value:NaN;

function validGpsTrack(track,start,elapsed){
  if(track==null)return null;
  if(!Array.isArray(track)||track.length<2||track.length>768)return false;
  const points=[];
  let prev=0;
  for(const p of track){
    if(!Array.isArray(p)||(p.length!==3&&p.length!==4)||
       p.some(v=>typeof v!=='number'||!Number.isFinite(v))||
       (p.length===4&&(p[3]<-500||p[3]>9000))||
       p[0]<-90||p[0]>90||p[1]<-180||p[1]>180||
       !Number.isSafeInteger(p[2])||p[2]<=prev||
       p[2]<start-300000||p[2]>start+elapsed*1000+300000)return false;
    points.push(p);
    prev=p[2];
  }
  return points;
}
function validCadenceSamples(samples,start,elapsed){
  if(samples==null)return null;
  if(!Array.isArray(samples)||samples.length<1||samples.length>2048)return false;
  const valid=[];
  let previousTime=0;
  for(const sample of samples){
    if(!Array.isArray(sample)||sample.length!==2||
       !Number.isSafeInteger(sample[0])||sample[0]<=previousTime||
       sample[0]<start-300000||sample[0]>start+elapsed*1000+300000||
       typeof sample[1]!=='number'||!Number.isFinite(sample[1])||
       sample[1]<35||sample[1]>260)return false;
    valid.push(sample);
    previousTime=sample[0];
  }
  return valid;
}
function descriptionForMetrics({pace,heart,maxHeart,cadence}){
  const description=['Course avec BeatOnStep — la musique au rythme des pas.'];
  if(pace!==null){
    const rounded=Math.round(pace);
    description.push('Allure moyenne : '+Math.floor(rounded/60)+':'+String(rounded%60).padStart(2,'0')+'/km');
  }
  if(heart!==null)description.push('FC moyenne : '+Math.round(heart)+' bpm');
  if(maxHeart!==null)description.push('FC max : '+Math.round(maxHeart)+' bpm');
  if(cadence!==null)description.push('Cadence moyenne : '+Math.round(cadence)+' pas/min');
  return description.join(' | ');
}
// TCX preserves real geolocated, timestamped points. Aggregate HR/cadence/pace
// remain Lap summaries: never duplicate them into imaginary per-fix samples.
export function buildStravaTcx({start,elapsed,distance,gps,heart,maxHeart,cadence,pace,cadenceSamples=null}){
  const iso=ms=>new Date(ms).toISOString();
  const samples=cadenceSamples||[];
  let cadenceIndex=0;
  const trackPoint=([lat,lon,time,alt])=>{
    // Both sequences are chronological: match measured sensor PPM in O(N+M).
    // TCX RunCadence is strides/min, while BeatOnStep measures steps/min.
    while(cadenceIndex+1<samples.length && samples[cadenceIndex+1][0]<=time)
      cadenceIndex++;
    const left=samples[cadenceIndex]||null;
    const right=samples[cadenceIndex+1]||null;
    let nearest=left;
    if(right&&(!nearest||Math.abs(right[0]-time)<Math.abs(nearest[0]-time)))
      nearest=right;
    if(nearest&&Math.abs(nearest[0]-time)>3000)nearest=null;
    const cadenceXml=nearest
      ?'<Extensions><ns3:TPX><ns3:RunCadence>'+Math.round(nearest[1]/2)+
        '</ns3:RunCadence></ns3:TPX></Extensions>'
      :'';
    const altitude=alt===undefined?'':'<AltitudeMeters>'+alt+'</AltitudeMeters>';
    return '<Trackpoint><Time>'+iso(time)+'</Time><Position>'+
      '<LatitudeDegrees>'+lat+'</LatitudeDegrees><LongitudeDegrees>'+lon+
      '</LongitudeDegrees></Position>'+altitude+cadenceXml+'</Trackpoint>';
  };
  const lap=[
    '<Lap StartTime="'+iso(start)+'">',
    '<TotalTimeSeconds>'+elapsed+'</TotalTimeSeconds>',
    '<DistanceMeters>'+(distance??0)+'</DistanceMeters>',
    // Required by the TCX v2 schema; zero indicates no measured calorie estimate.
    '<Calories>0</Calories>',
    ...(heart!==null?['<AverageHeartRateBpm><Value>'+Math.round(heart)+'</Value></AverageHeartRateBpm>']:[]),
    ...(maxHeart!==null?['<MaximumHeartRateBpm><Value>'+Math.round(maxHeart)+'</Value></MaximumHeartRateBpm>']:[]),
    '<Intensity>Active</Intensity>',
    ...(cadence!==null?['<Cadence>'+Math.round(cadence)+'</Cadence>']:[]),
    '<TriggerMethod>Manual</TriggerMethod>',
    '<Track>',
    ...gps.map(trackPoint),
    '</Track>',
    ...(pace!==null?['<Extensions><ns3:LX><ns3:AvgSpeed>'+(1000/pace)+
      '</ns3:AvgSpeed></ns3:LX></Extensions>']:[]),
    '</Lap>',
  ].join('');
  return '<?xml version="1.0" encoding="UTF-8"?>'+
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" '+
    'xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">'+
    '<Activities><Activity Sport="Running"><Id>'+iso(start)+'</Id>'+
    lap+'</Activity></Activities></TrainingCenterDatabase>';
}
async function resolveUpload(env,athleteId,runId,uploadId,token){
  // Upload is async at Strava. Only the returned activity ID confirms success.
  for(let attempt=0;attempt<3;attempt++){
    if(attempt>0)await new Promise(resolve=>setTimeout(resolve,700));
    let res;
    try{
      res=await fetch('https://www.strava.com/api/v3/uploads/'+uploadId,{
        headers:{authorization:'Bearer '+token},
      });
    }catch{return reply({error:'publication_pending_verify_strava'},503);}
    if(!res.ok)return reply({error:'publication_pending_verify_strava'},503);
    const data=await res.json();
    const activityId=String(data?.activity_id||'');
    if(/^[0-9]+$/.test(activityId)){
      await env.DB.prepare(
        "UPDATE strava_exports SET status='complete',activity_id=?,published_at=? "+
        "WHERE athlete_id=? AND run_id=?"
      ).bind(activityId,Date.now(),athleteId,runId).run();
      return reply({ok:true,url:'https://www.strava.com/activities/'+activityId});
    }
    if(typeof data?.error==='string'&&data.error.trim()){
      // Preserve the idempotency record: a duplicate/error is not permission
      // to blindly repost geographical data.
      return reply({error:'strava_upload_failed'},422);
    }
  }
  return reply({pending:true,error:'publication_pending_verify_strava'},202);
}

async function publish(request, env, device, row) {
  if (!row) return reply({error:'not_connected'}, 401);
  const b = await jsonBody(request,131072);
  const runId = typeof b?.runId === 'string' ? b.runId : '';
  const startedAt = Number(b?.startedAtMs);
  const elapsedTime = Number(b?.elapsedTime);
  const distance = b?.distanceMeters == null ? null : Number(b.distanceMeters);
  const heart=metric(b?.heartRateBpm,20,300);
  const maxHeart=metric(b?.maxHeartRateBpm,20,300);
  const cadence=metric(b?.cadencePpm,20,300);
  const pace=metric(b?.paceSecPerKm,1,86400);
  const gps=validGpsTrack(b?.gpsTrack,startedAt,elapsedTime);
  const cadenceSamples=validCadenceSamples(b?.cadenceSamples,startedAt,elapsedTime);
  if (!/^bos-[0-9]{12,14}$/.test(runId) || !Number.isSafeInteger(startedAt) ||
    startedAt < Date.UTC(2020,0,1) || startedAt > Date.now()+300000 ||
    !Number.isSafeInteger(elapsedTime) || elapsedTime < 1 || elapsedTime > 604800 ||
    (distance !== null && (!Number.isFinite(distance) || distance <= 0 || distance > 500000)) ||
    [heart,maxHeart,cadence,pace].some(Number.isNaN) || gps===false || cadenceSamples===false) {
    return reply({error:'invalid_run'}, 400);
  }
  // The mobile app's runId comes from the original session start time.
  if (runId !== 'bos-' + startedAt) return reply({error:'invalid_run_id'}, 400);
  const previous = await env.DB.prepare(
    'SELECT status,activity_id,upload_id FROM strava_exports WHERE athlete_id=? AND run_id=?'
  ).bind(row.athlete_id,runId).first();
  if(previous?.status==='complete')
    return reply({ok:true,alreadyPublished:true,url:'https://www.strava.com/activities/'+previous.activity_id});
  if(previous && !previous.upload_id)return reply({error:'publication_pending_verify_strava'},409);
  let token;
  try {
    // Refresh/auth failure is safe to retry: no activity POST has happened yet.
    token = await accessToken(env,row);
  } catch {
    return reply({error:'strava_token_unavailable'},503);
  }
  if(previous?.upload_id) {
    return resolveUpload(env,row.athlete_id,runId,String(previous.upload_id),token);
  }
  const inserted = await env.DB.prepare(
    "INSERT INTO strava_exports (athlete_id,run_id,status,created_at) VALUES (?,?,'pending',?) " +
    'ON CONFLICT(athlete_id,run_id) DO NOTHING'
  ).bind(row.athlete_id,runId,Date.now()).run();
  if (!inserted.meta?.changes) return reply({error:'publication_pending_verify_strava'},409);
  try {
    const description=descriptionForMetrics({pace,heart,maxHeart,cadence});
    let form,endpoint,headers={authorization:'Bearer '+token};
    if(gps){
      const tcx=buildStravaTcx({start:startedAt,elapsed:elapsedTime,distance,
        gps,heart,maxHeart,cadence,pace,cadenceSamples});
      form=new FormData();
      form.set('name','Course BeatOnStep');
      form.set('description',description);
      form.set('data_type','tcx');
      form.set('external_id',runId+'.tcx');
      form.set('file',new Blob([tcx],{type:'application/vnd.garmin.tcx+xml'}),runId+'.tcx');
      endpoint='https://www.strava.com/api/v3/uploads';
    }else{
      form=new URLSearchParams({
        name:'Course BeatOnStep',sport_type:'Run',
        start_date_local:new Date(startedAt).toISOString(),
        elapsed_time:String(elapsedTime),description,
      });
      if(distance!==null)form.set('distance',String(distance));
      headers={...headers,'content-type':'application/x-www-form-urlencoded'};
      endpoint='https://www.strava.com/api/v3/activities';
    }
    const res=await fetch(endpoint,{
      method:'POST',headers,body:form,
    });
    if (!res.ok) {
      // A definitive 4xx refusal means Strava did not create an activity.
      // Release ONLY that rejected attempt; retain pending for ambiguous
      // 5xx responses/network failures, which might have created an activity.
      // Strava Faults expose resource/field/code. Log only a small allowlisted
      // field and code, never the raw response body or human-readable message.
      let faultField = 'none', faultCode = 'none';
      try {
        const fault = await res.json();
        const entry = Array.isArray(fault?.errors) ? fault.errors[0] : null;
        if (/^[a-z_]{1,36}$/.test(entry?.field || '')) faultField = entry.field;
        if (/^[a-z_]{1,36}$/.test(entry?.code || '')) faultCode = entry.code;
      } catch { /* Upstream may return a non-JSON error */ }
      console.warn('Strava activity response',
        'http_status=' + res.status + ';field=' + faultField + ';code=' + faultCode);
      if (res.status >= 400 && res.status < 500) {
        await env.DB.prepare(
          "DELETE FROM strava_exports WHERE athlete_id=? AND run_id=? AND status='pending'"
        ).bind(row.athlete_id, runId).run();
        const error = res.status === 429 ? 'strava_rate_limited'
          : res.status === 401 || res.status === 403 ? 'strava_permission_denied'
          : 'strava_activity_rejected';
        return reply({error, upstreamStatus: res.status}, 502);
      }
      return reply({error:'strava_publication_failed_verify'},502);
    }
    const data = await res.json();
    const id=String(data?.id||'');
    if(!/^[0-9]+$/.test(id))return reply({error:'publication_pending_verify_strava'},502);
    if(gps){
      await env.DB.prepare(
        "UPDATE strava_exports SET upload_id=? WHERE athlete_id=? AND run_id=? AND status='pending'"
      ).bind(id,row.athlete_id,runId).run();
      return resolveUpload(env,row.athlete_id,runId,id,token);
    }
    await env.DB.prepare(
      "UPDATE strava_exports SET status='complete',activity_id=?,published_at=? WHERE athlete_id=? AND run_id=?"
    ).bind(id,Date.now(),row.athlete_id,runId).run();
    return reply({ok:true,url:'https://www.strava.com/activities/'+id});
  } catch (error) {
    console.error('Strava publishing uncertain',error instanceof Error?error.name:'unknown');
    // Never retry blindly after a potentially successful POST. This avoids double publishing.
    return reply({error:'publication_pending_verify_strava'},503);
  }
}
// The import tap explicitly requests geographic samples; they are returned
// only to this connected athlete's phone and NEVER persisted on Cloudflare.
async function importActivityRoute(env,row,activityId){
  if(!row)return reply({error:'not_connected'},401);
  if(!/^[1-9][0-9]{0,19}$/.test(activityId))
    return reply({error:'invalid_activity_id'},400);
  let token;
  try{token=await accessToken(env,row);}
  catch{return reply({error:'strava_token_unavailable'},503);}
  const headers={authorization:'Bearer '+token,accept:'application/json'};
  const read=async path=>{
    let response;
    try{response=await fetch('https://www.strava.com/api/v3/'+path,{headers});}
    catch{return {error:'strava_unavailable',status:503};}
    if(response.status===429)return {error:'strava_rate_limited',status:429};
    if(response.status===401||response.status===403)
      return {error:'strava_read_permission_required',status:403};
    if(response.status===404)return {error:'strava_not_found',status:404};
    if(!response.ok)return {error:'strava_unavailable',status:502};
    try{return {data:await response.json()};}
    catch{return {error:'strava_invalid_response',status:502};}
  };
  const activity=await read('activities/'+activityId);
  if(activity.error)return reply({error:activity.error},activity.status);
  const detail=activity.data;
  if(!detail||String(detail.id)!==activityId||
     String(detail.athlete?.id||'')!==String(row.athlete_id))
    return reply({error:'strava_invalid_response'},502);
  const gain=optionalMetric(detail.total_elevation_gain,0,30000);
  const response=await read('activities/'+activityId+
    '/streams?keys=latlng,time,altitude&key_by_type=true');
  // Missing/hidden route must never prevent importing the summary.
  if(response.error)return reply({
    geoRoute:null,
    elevationGainMeters:Number.isFinite(gain)?gain:null,
    routeUnavailableReason:response.error,
  });
  const geo=response.data?.latlng?.data;
  const time=response.data?.time?.data;
  let points=null;
  if(Array.isArray(geo)&&geo.length>=2&&geo.length<=100000&&
     Array.isArray(time)&&time.length===geo.length){
    const sampled=[];
    const limit=Math.min(120,geo.length);
    let valid=true,lastT=-1;
    for(let i=0;i<geo.length;i++){
      const a=geo[i],t=time[i];
      if(!Array.isArray(a)||a.length!==2||
         !Number.isFinite(a[0])||!Number.isFinite(a[1])||
         Math.abs(a[0])>85||Math.abs(a[1])>180||
         !Number.isFinite(t)||t<0||t<=lastT){valid=false;break;}
      lastT=t;
    }
    if(valid)for(let i=0;i<limit;i++){
      const n=Math.floor(i*(geo.length-1)/(limit-1));
      sampled.push(geo[n]);
    }
    if(valid&&Math.max(...sampled.map(a=>a[1]))-
       Math.min(...sampled.map(a=>a[1]))<=180)points=sampled;
  }
  return reply({
    geoRoute:points,
    elevationGainMeters:Number.isFinite(gain)?gain:null,
  });
}

async function recentRuns(env,row){
  if(!row)return reply({error:'not_connected'},401);
  let token;
  try{token=await accessToken(env,row);}
  catch{return reply({error:'strava_token_unavailable'},503);}
  let response;
  try{
    // Only the connecting athlete's recent activities; no public or social
    // feed and no route/position streams. No caching or D1 import ledger.
    response=await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30&page=1',{
      headers:{authorization:'Bearer '+token,accept:'application/json'},
    });
  }catch{return reply({error:'strava_unavailable'},503);}
  if(response.status===401||response.status===403)
    return reply({error:'strava_read_permission_required'},403);
  if(response.status===429)return reply({error:'strava_rate_limited'},429);
  if(!response.ok)return reply({error:'strava_unavailable'},502);
  let raw;
  try{raw=await response.json();}
  catch{return reply({error:'strava_invalid_response'},502);}
  if(!Array.isArray(raw))return reply({error:'strava_invalid_response'},502);
  const items=[];
  for(const a of raw){
    if(!a||!['Run','TrailRun','VirtualRun'].includes(a.sport_type||a.type))
      continue;
    const id=String(a.id||'');
    const startedAtMs=Date.parse(a.start_date||'');
    const durationSeconds=Number(a.elapsed_time);
    if(!/^[1-9][0-9]{0,19}$/.test(id)||
      !Number.isSafeInteger(startedAtMs)||
      startedAtMs<Date.UTC(2020,0,1)||startedAtMs>Date.now()+300000||
      !Number.isSafeInteger(durationSeconds)||durationSeconds<1||
      durationSeconds>604800)continue;
    const distance=optionalMetric(a.distance,0,500000);
    const moving=optionalMetric(a.moving_time,1,604800);
    const pace=distance&&moving?Math.round(moving*1000/distance):null;
    const averageHeartRate=optionalMetric(a.average_heartrate,20,300);
    const maxHeartRate=optionalMetric(a.max_heartrate,20,300);
    items.push({
      id,startedAtMs,durationSeconds,
      name:typeof a.name==='string'
        ?[...a.name.replace(/[\u0000-\u001f\u007f]/g,' ').trim()].slice(0,60).join('')
        :'Course',
      distanceMeters:distance===null?null:Math.round(distance),
      averagePaceSecPerKm:pace&&pace>0&&pace<=86400?pace:null,
      averageHeartRateBpm:averageHeartRate,
      maxHeartRateBpm:maxHeartRate,
    });
    if(items.length>=10)break;
  }
  return reply({items});
}
// Pont privé à usage strictement personnel : Voyage ne reçoit jamais les jetons,
// et les données ne sont consultables que par son administrateur authentifié.
export async function voyageStravaInternal(request,env,url){
  const path=url.pathname;
  const secret=String(env.VOYAGE_BRIDGE_KEY||"");
  const provided=request.headers.get("X-Voyage-Bridge-Key")||"";
  if(request.method!=="GET")return reply({error:"method_not_allowed"},405);
  if(secret.length<40 || provided.length!==secret.length){
    return reply({error:"not_found"},404);
  }
  let difference=0;
  for(let i=0;i<secret.length;i++)difference|=secret.charCodeAt(i)^provided.charCodeAt(i);
  if(difference!==0)return reply({error:"not_found"},404);
  if(!configured(env)||!env.DB)return reply({error:"strava_unavailable"},503);
  // L'identité est celle du propriétaire du carnet Voyage.
  const athlete=String(env.VOYAGE_STRAVA_ATHLETE_ID||"149399419");
  if(!/^[1-9][0-9]{0,19}$/.test(athlete))return reply({error:"invalid_config"},503);
  const row=await env.DB.prepare(
    "SELECT * FROM strava_connections WHERE athlete_id=?"
  ).bind(athlete).first();
  if(!row)return reply({error:"strava_not_connected"},404);
  if(path==="/api/voyage/strava/activities"){
    return recentRuns(env,row);
  }
  const match=/^\/api\/voyage\/strava\/activities\/([1-9][0-9]{0,19})\/route$/.exec(path);
  if(match)return importActivityRoute(env,row,match[1]);
  return reply({error:"not_found"},404);
}

export async function stravaRequest(request, env, url, ctx=null) {
  const path = url.pathname;
  // One server-side boolean controls both mobile surfaces and every Strava
  // endpoint. The app can ask for this safely without contacting Strava.
  if (!configured(env)){
    if(path===PREFIX+'/status'&&request.method==='GET')
      return reply({enabled:false,connected:false,canConnect:false,used:0,capacity:0});
    return reply({enabled:false,error:'strava_unavailable'},503);
  }
  try {
    if (path === PREFIX+'/callback' && request.method === 'GET') return callback(request,env,url);
    if (!env.DB) return reply({error:'database_unavailable'},503);
    const device = await deviceHash(request);
    if (!device) return reply({error:'invalid_device'},401);
    if (path === PREFIX+'/status' && request.method === 'GET') {
      const [used,row] = await Promise.all([usage(env.DB),connection(env.DB,device)]);
      const max = capacity(env);
      return reply({enabled:true,used,capacity:max,connected:Boolean(row),
        canConnect:Boolean(row) || used < max});
    }
    if (path === PREFIX+'/start' && request.method === 'POST') {
      const existing = await connection(env.DB,device);
      // Reauthorization upgrades older export-only grants with activity:read,
      // while keeping the current grant intact if the user declines.
      const options=await jsonBody(request);
      const reauthorize=options?.reauthorize===true;
      if (existing&&!reauthorize) return reply({error:'already_connected'},409);
      if (!existing && await usage(env.DB) >= capacity(env)) return reply({error:'capacity_reached'},409);
      const state=randomHex(), now=Date.now();
      await env.DB.prepare('DELETE FROM strava_oauth_pending WHERE expires_at<=?')
        .bind(now).run();
      await env.DB.prepare(
        'INSERT INTO strava_oauth_pending(device_hash,state_hash,expires_at) VALUES (?,?,?) ' +
        'ON CONFLICT(device_hash) DO UPDATE SET state_hash=excluded.state_hash,expires_at=excluded.expires_at'
      ).bind(device,await sha256(state),now+300000).run();
      const authorize = new URL('https://www.strava.com/oauth/authorize');
      authorize.search = new URLSearchParams({
        client_id:String(env.STRAVA_CLIENT_ID),redirect_uri:CALLBACK,response_type:'code',
        approval_prompt:reauthorize?'force':'auto',scope:'activity:write,activity:read',state,
      }).toString();
      return reply({url:authorize.toString()});
    }
    if (path === PREFIX+'/activities' && request.method === 'GET') {
      return recentRuns(env,await connection(env.DB,device));
    }
    const route=/^\/api\/strava\/activities\/([1-9][0-9]{0,19})\/route$/.exec(path);
    if(route&&request.method==='GET')
      return importActivityRoute(env,await connection(env.DB,device),route[1]);
    if(path===PREFIX+'/claim-latest'&&request.method==='POST'){
      const row=await connection(env.DB,device);
      if(!row)return reply({error:'not_connected'},401);
      const token=stravaApiEnabled(env)
        ?await accessToken(env,row):null;
      return claimLatestStravaSport(request,env,row,token,ctx);
    }
    if (path === PREFIX+'/publish' && request.method === 'POST') {
      return publish(request,env,device,await connection(env.DB,device));
    }
    if (path === PREFIX+'/disconnect' && request.method === 'POST') {
      const body=await jsonBody(request);
      const localOnly=body?.localOnly === true;
      const row=await connection(env.DB,device);
      if (!row) return reply({ok:true,remoteRevoked:false,manualRevocationRequired:localOnly});
      if (!localOnly) {
        // Since 2026-06-01 Strava recommends /oauth/revoke (Basic application
        // auth + form token) over the legacy /oauth/deauthorize endpoint.
        // Use the encrypted refresh token directly; refreshing it first could
        // fail for inactive Strava applications and block account removal.
        const key=await cryptoKey(env);
        const token=await unseal(key,row.refresh_nonce,row.refresh_cipher);
        const basic=btoa(String(env.STRAVA_CLIENT_ID)+':'+env.STRAVA_CLIENT_SECRET);
        let revoked;
        try {
          revoked=await fetch('https://www.strava.com/oauth/revoke', {
            method:'POST',
            headers:{authorization:'Basic '+basic,
              'content-type':'application/x-www-form-urlencoded'},
            body:new URLSearchParams({token,token_type_hint:'refresh_token'}),
          });
        } catch {
          return reply({error:'strava_disconnect_remote_failed'},503);
        }
        if (!revoked.ok) {
          console.warn('Strava revoke response', 'http_status=' + revoked.status);
          return reply({error:'strava_disconnect_remote_failed'},502);
        }
      }
      // Delete access/refresh credentials in both paths. Retain only the
      // minimal export idempotency ledger: otherwise reconnecting this same
      // athlete would permit duplicate publication, including pending runs.
      await env.DB.prepare(
        'DELETE FROM strava_connections WHERE device_hash=?'
      ).bind(device).run();
      return reply({ok:true,remoteRevoked:!localOnly,
        manualRevocationRequired:localOnly});
    }
    return reply({error:'not_found'},404);
  } catch (error) {
    console.error('Strava route failure', error instanceof Error ? error.name : 'unknown');
    return reply({error:'strava_unavailable'},503);
  }
}
