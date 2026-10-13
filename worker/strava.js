// OAuth + manual Strava exports. Isolated from community identity and catalogue.
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
  if (!code || !scopes.includes('activity:write')) return appReturn('permission_required');
  try {
    const token = await oauthToken(env, {code, grant_type: 'authorization_code'});
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
async function publish(request, env, device, row) {
  if (!row) return reply({error:'not_connected'}, 401);
  const b = await jsonBody(request);
  const runId = typeof b?.runId === 'string' ? b.runId : '';
  const startedAt = Number(b?.startedAtMs);
  const elapsedTime = Number(b?.elapsedTime);
  const distance = b?.distanceMeters == null ? null : Number(b.distanceMeters);
  if (!/^bos-[0-9]{12,14}$/.test(runId) || !Number.isSafeInteger(startedAt) ||
    startedAt < Date.UTC(2020,0,1) || startedAt > Date.now()+300000 ||
    !Number.isSafeInteger(elapsedTime) || elapsedTime < 1 || elapsedTime > 604800 ||
    (distance !== null && (!Number.isFinite(distance) || distance <= 0 || distance > 500000))) {
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
  const inserted = await env.DB.prepare(
    "INSERT INTO strava_exports (athlete_id,run_id,status,created_at) VALUES (?,?,'pending',?) " +
    'ON CONFLICT(athlete_id,run_id) DO NOTHING'
  ).bind(row.athlete_id,runId,Date.now()).run();
  if (!inserted.meta?.changes) return reply({error:'publication_pending_verify_strava'},409);
  try {
    const token = await accessToken(env,row);
    const form = new URLSearchParams({
      name: 'Course BeatOnStep',
      sport_type: 'Run',
      start_date_local: new Date(startedAt).toISOString(),
      elapsed_time: String(elapsedTime),
      description: 'Course avec BeatOnStep — la musique au rythme des pas.',
    });
    if (distance !== null) form.set('distance', String(distance));
    const res = await fetch('https://www.strava.com/api/v3/activities', {
      method:'POST', headers:{authorization:'Bearer '+token,
        'content-type':'application/x-www-form-urlencoded'}, body:form,
    });
    if (!res.ok) {
      console.warn('Strava manual activity response',res.status);
      return reply({error:res.status===429?'strava_rate_limited':'strava_publication_failed_verify'},502);
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
export async function stravaRequest(request, env, url) {
  if (!configured(env)) return reply({enabled:false,error:'strava_unavailable'},503);
  const path = url.pathname;
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
      if (existing) return reply({error:'already_connected'},409);
      if (await usage(env.DB) >= capacity(env)) return reply({error:'capacity_reached'},409);
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
        approval_prompt:'auto',scope:'activity:write',state,
      }).toString();
      return reply({url:authorize.toString()});
    }
    if (path === PREFIX+'/publish' && request.method === 'POST') {
      return publish(request,env,device,await connection(env.DB,device));
    }
    if (path === PREFIX+'/disconnect' && request.method === 'POST') {
      const row=await connection(env.DB,device);
      if (!row) return reply({ok:true});
      const token=await accessToken(env,row);
      const deauth=await fetch('https://www.strava.com/oauth/deauthorize', {
        method:'POST',headers:{authorization:'Bearer '+token},
      });
      if (!deauth.ok) return reply({error:'strava_disconnect_failed'},502);
      // The runner is opting out: drop export metadata together with credentials.
      await env.DB.batch([
        env.DB.prepare('DELETE FROM strava_exports WHERE athlete_id=?').bind(row.athlete_id),
        env.DB.prepare('DELETE FROM strava_connections WHERE device_hash=?').bind(device),
      ]);
      return reply({ok:true});
    }
    return reply({error:'not_found'},404);
  } catch (error) {
    console.error('Strava route failure', error instanceof Error ? error.name : 'unknown');
    return reply({error:'strava_unavailable'},503);
  }
}
