// OAuth + manual Strava exports; OTA-safe optional workout metrics.
// No raw geographic fixes or native GPS upload in the OTA delivery.
// Requires STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_ENCRYPTION_KEY and D1 migration.
// No client-side Strava secret. Never log access/refresh tokens or authorization codes.
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
    env.STRAVA_EXPORT_ENABLED === 'true');
}
function capacity(env) {
  const n = Number(env.STRAVA_ATHLETE_CAPACITY || 1);
  return Number.isSafeInteger(n) && n >= 1 && n <= 9999 ? n : 1;
}
async function deviceHash(request) {
  const token = request.headers.get('x-bos-strava-key') || '';
  return /^[a-f0-9]{64}$/.test(token) ? sha256('strava-device-v1:' + token) : null;
}
async function jsonBody(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return null;
  const raw = await request.text();
  if (raw.length > 2048) return null;
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
  if (!res.ok) throw Error('strava_oauth_failed');
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
    console.error('Strava OAuth callback unsuccessful', error instanceof Error ? error.name : 'unknown');
    return appReturn('failed');
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
async function publish(request, env, device, row) {
  if (!row) return reply({error:'not_connected'}, 401);
  const b = await jsonBody(request);
  const runId = typeof b?.runId === 'string' ? b.runId : '';
  const startedAt = Number(b?.startedAtMs);
  const elapsedTime = Number(b?.elapsedTime);
  const distance = b?.distanceMeters == null ? null : Number(b.distanceMeters);
  const pace = optionalMetric(b?.paceSecPerKm,1,86400);
  const averageHeartRate = optionalMetric(b?.heartRateBpm,20,300);
  const maxHeartRate = optionalMetric(b?.maxHeartRateBpm,20,300);
  const cadence = optionalMetric(b?.cadencePpm,20,300);
  if (!/^bos-[0-9]{12,14}$/.test(runId) || !Number.isSafeInteger(startedAt) ||
    startedAt < Date.UTC(2020,0,1) || startedAt > Date.now()+300000 ||
    !Number.isSafeInteger(elapsedTime) || elapsedTime < 1 || elapsedTime > 604800 ||
    (distance !== null && (!Number.isFinite(distance) || distance <= 0 || distance > 500000)) ||
    [pace,averageHeartRate,maxHeartRate,cadence].some(Number.isNaN)) {
    return reply({error:'invalid_run'}, 400);
  }
  // The mobile app's runId comes from the original session start time.
  if (runId !== 'bos-' + startedAt) return reply({error:'invalid_run_id'}, 400);
  const previous = await env.DB.prepare(
    'SELECT status,activity_id FROM strava_exports WHERE athlete_id=? AND run_id=?'
  ).bind(row.athlete_id,runId).first();
  if (previous) return previous.status === 'complete'
    ? reply({ok:true,alreadyPublished:true,url:'https://www.strava.com/activities/'+previous.activity_id})
    : reply({error:'publication_pending_verify_strava'},409);
  let token;
  try {
    // Refresh/auth failure is safe to retry: no activity POST has happened yet.
    token = await accessToken(env,row);
  } catch {
    return reply({error:'strava_token_unavailable'},503);
  }
  const inserted = await env.DB.prepare(
    "INSERT INTO strava_exports (athlete_id,run_id,status,created_at) VALUES (?,?,'pending',?) " +
    'ON CONFLICT(athlete_id,run_id) DO NOTHING'
  ).bind(row.athlete_id,runId,Date.now()).run();
  if (!inserted.meta?.changes) return reply({error:'publication_pending_verify_strava'},409);
  try {
    const form = new URLSearchParams({
      name: 'Course BeatOnStep',
      sport_type: 'Run',
      start_date_local: new Date(startedAt).toISOString(),
      elapsed_time: String(elapsedTime),
      description: metricDescription({pace,averageHeartRate,maxHeartRate,cadence}),
    });
    if (distance !== null) form.set('distance', String(distance));
    const res = await fetch('https://www.strava.com/api/v3/activities', {
      method:'POST', headers:{authorization:'Bearer '+token,
        'content-type':'application/x-www-form-urlencoded'}, body:form,
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
      console.warn('Strava manual activity response',
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
    const id = String(data?.id || '');
    if (!/^[0-9]+$/.test(id)) return reply({error:'publication_pending_verify_strava'},502);
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
export async function stravaRequest(request, env, url) {
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
