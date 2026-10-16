import { backfillWorkoutCards, requireCardSchema } from './cards.js';
import { hashGiftToken } from './pack.js';
import { readSportWarningReasons } from './sport-card-telemetry.js';

// Restricted catalogue moderation, modelled on the D1/session design in rafa-create/saas.
// No public registration and no access to music-provider credentials.
const COOKIE = '__Host-bos_admin';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 8;
const D1_OFFSET = 1_000_000_000_000;
const encoder = new TextEncoder();

function respond(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

function hex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value) {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw Error('invalid_hash_format');
  }
  return new Uint8Array(value.match(/../g).map(pair => parseInt(pair, 16)));
}

async function sha256(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function passwordHash(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt: fromHex(saltHex), iterations: 100_000, hash: 'SHA-256',
  }, key, 256);
  return hex(new Uint8Array(derived));
}

function equalHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function sessionCookie(value, maxAge) {
  // __Host- requires Secure, Path=/ and no Domain; only HTTPS can set the cookie.
  return COOKIE + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge;
}

function tokenFromRequest(request) {
  const entry = (request.headers.get('cookie') || '').split(';').map(x => x.trim())
    .find(x => x.startsWith(COOKIE + '='));
  const token = entry ? entry.slice(COOKIE.length + 1) : '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}

function verifyOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}

async function parseBody(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return null;
  }
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4096) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function currentAdmin(db, request) {
  const token = tokenFromRequest(request);
  if (!token) return null;
  return db.prepare(
    'SELECT u.email FROM admin_sessions s JOIN admin_users u ON u.email = s.email ' +
    'WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0'
  ).bind(await sha256(token), Date.now()).first();
}

async function permitLogin(db, env, request) {
  // Mandatory salt: rate limits must never quietly turn off in production.
  if (!env.CATALOG_RATE_SALT) return false;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const bucket = await sha256(env.CATALOG_RATE_SALT + ':admin-login:' + ip);
  const now = Date.now();
  const row = await db.prepare(
    'INSERT INTO admin_auth_attempts (bucket, attempts, expires_at) VALUES (?, 1, ?) ' +
    'ON CONFLICT(bucket) DO UPDATE SET ' +
    'attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END, ' +
    'expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END ' +
    'RETURNING attempts'
  ).bind(bucket, now + LOGIN_WINDOW_MS, now, now).first();
  return Boolean(row && row.attempts <= LOGIN_ATTEMPTS);
}

async function login(db, env, request) {
  if (!verifyOrigin(request)) return respond({ error: 'origin_forbidden' }, 403);
  const input = await parseBody(request);
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = input?.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return respond({ error: 'invalid_credentials' }, 401);
  }
  if (!(await permitLogin(db, env, request))) return respond({ error: 'retry_later' }, 429);
  const admin = await db.prepare(
    'SELECT email,password_salt,password_hash FROM admin_users WHERE email = ? AND disabled = 0'
  ).bind(email).first();
  // Perform equivalent password work even for an unknown email.
  const computed = await passwordHash(password, admin?.password_salt || '00000000000000000000000000000000');
  if (!admin || !equalHex(computed, admin.password_hash)) {
    return respond({ error: 'invalid_credentials' }, 401);
  }
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare(
    'INSERT INTO admin_sessions (token_hash,email,expires_at) VALUES (?,?,?)'
  ).bind(await sha256(token), admin.email, Date.now() + SESSION_MS).run();
  return respond({ authenticated: true, email: admin.email }, 200, {
    'set-cookie': sessionCookie(token, Math.round(SESSION_MS / 1000)),
  });
}

async function logout(db, request) {
  if (!verifyOrigin(request)) return respond({ error: 'origin_forbidden' }, 403);
  const token = tokenFromRequest(request);
  if (token) await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
    .bind(await sha256(token)).run();
  return respond({ authenticated: false }, 200, {
    'set-cookie': sessionCookie('', 0),
  });
}

async function deleteShare(db, request, idText) {
  if (!verifyOrigin(request)) return respond({ error: 'origin_forbidden' }, 403);
  const admin = await currentAdmin(db, request);
  if (!admin) return respond({ error: 'admin_required' }, 401);
  const publicId = Number(idText);
  if (!Number.isSafeInteger(publicId) || publicId <= D1_OFFSET) {
    return respond({ error: 'not_found' }, 404);
  }
  const rowId = publicId - D1_OFFSET;
  const result = await db.prepare('DELETE FROM shared_items WHERE id = ?').bind(rowId).run();
  if (result.meta?.changes !== 1) return respond({ error: 'not_found' }, 404);
  return respond({ deleted: true, id: publicId });
}


// Read-only management tools reuse current D1 tables, never sporting awards.
const ADMIN_PAGE_SIZE=25;
const adminPage=value=>{
  const page=Number(value||'1');
  return Number.isSafeInteger(page)&&page>=1&&page<=10000?page:null;
};
async function overview(db,request){
  if(!await currentAdmin(db,request))return respond({error:'admin_required'},401);
  const result=await db.prepare(`SELECT
    (SELECT COUNT(*) FROM shared_items) AS shares,
    (SELECT COUNT(*) FROM sport_world_cards) AS sport_cards,
    (SELECT COUNT(*) FROM sport_card_ownership_events) AS ownership_events,
    (SELECT COUNT(*) FROM sport_verified_runs) AS verified_runs,
    (SELECT COUNT(*) FROM community_users) AS accounts`).first();
  const count=key=>Math.max(0,Number(result?.[key])||0);
  return respond({shares:count('shares'),sportCards:count('sport_cards'),
    ownershipEvents:count('ownership_events'),verifiedRuns:count('verified_runs'),
    accounts:count('accounts')});
}
async function sportCards(db,request,url){
  if(!await currentAdmin(db,request))return respond({error:'admin_required'},401);
  const page=adminPage(url.searchParams.get('page'));
  const sort=url.searchParams.get('sort')||'recent';
  if(page===null||!['recent','holders'].includes(sort)||
    [...url.searchParams.keys()].some(k=>!['page','sort'].includes(k)))
    return respond({error:'invalid_filter'},400);
  const count=await db.prepare('SELECT COUNT(*) AS total FROM sport_world_cards').first();
  const order=sort==='holders'?'holder_count DESC,c.id ASC':'c.id DESC';
  const rows=await db.prepare(`SELECT
      c.id,c.distance_cm,c.time_unit,c.sub_value,c.owner_epoch,
      CASE WHEN c.current_owner_id IS NOT NULL THEN 1 ELSE 0 END AS has_owner,
      CASE WHEN COALESCE(preferences.show_challenges,1)=1
        THEN owner.handle ELSE NULL END AS owner_handle,
      (SELECT COUNT(DISTINCT e.new_owner_id)
        FROM sport_card_ownership_events e
        WHERE e.card_id=c.id AND e.reason IN ('sport_win','gift_claim'))
        AS holder_count
    FROM sport_world_cards c
    LEFT JOIN community_users owner ON owner.id=c.current_owner_id
    LEFT JOIN community_profile_settings preferences ON preferences.user_id=owner.id
    ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(ADMIN_PAGE_SIZE,(page-1)*ADMIN_PAGE_SIZE).all();
  return respond({page,pageSize:ADMIN_PAGE_SIZE,total:Number(count?.total)||0,
    items:(rows.results||[]).map(row=>({
      id:row.id,distanceCm:row.distance_cm,timeUnit:row.time_unit,
      subValue:row.sub_value,ownerEpoch:row.owner_epoch,
      hasOwner:row.has_owner===1,
      owner:typeof row.owner_handle==='string'?row.owner_handle:null,
      holderCount:Number(row.holder_count)||0,
    }))});
}

// Review EVERY historical warning by its original card + owner epoch, not only
// warnings of current owners. This endpoint is strictly read-only; removing
// an attested run would break linked achievements and immutable ownership events.
async function sportWarnings(db,request,url){
  if(!await currentAdmin(db,request))return respond({error:'admin_required'},401);
  const page=adminPage(url.searchParams.get('page'));
  if(page===null||[...url.searchParams.keys()].some(key=>key!=='page'))
    return respond({error:'invalid_filter'},400);
  try{
    const total=await db.prepare(
      "SELECT COUNT(*) AS total FROM sport_card_telemetry_reviews WHERE state='warning'"
    ).first();
    const rows=await db.prepare(`SELECT tr.card_id,tr.owner_epoch,tr.created_at,
        tr.reviewed_at,rd.reason_codes,c.distance_cm,c.time_unit,c.sub_value,
        CASE WHEN COALESCE(pref.show_challenges,1)=1
          THEN athlete.handle ELSE NULL END AS athlete_handle,
        e.changed_at AS earned_at,
        CASE WHEN c.owner_epoch=tr.owner_epoch THEN 1 ELSE 0 END AS current_epoch
      FROM sport_card_telemetry_reviews tr
      JOIN sport_world_cards c ON c.id=tr.card_id
      LEFT JOIN sport_card_telemetry_reason_details rd
        ON rd.card_id=tr.card_id AND rd.owner_epoch=tr.owner_epoch
      LEFT JOIN sport_card_ownership_events e
        ON e.card_id=tr.card_id AND e.new_epoch=tr.owner_epoch
        AND e.reason='sport_win'
      LEFT JOIN community_users athlete ON athlete.id=e.new_owner_id
      LEFT JOIN community_profile_settings pref ON pref.user_id=athlete.id
      WHERE tr.state='warning'
      ORDER BY tr.created_at DESC,tr.card_id DESC,tr.owner_epoch DESC
      LIMIT ? OFFSET ?`).bind(ADMIN_PAGE_SIZE,(page-1)*ADMIN_PAGE_SIZE).all();
    return respond({page,pageSize:ADMIN_PAGE_SIZE,total:Number(total?.total)||0,
      items:(rows.results||[]).map(row=>({
        cardId:row.card_id,ownerEpoch:row.owner_epoch,
        distanceCm:row.distance_cm,timeUnit:row.time_unit,
        subValue:row.sub_value,owner:typeof row.athlete_handle==='string'
          ?row.athlete_handle:null,
        earnedAt:Number.isSafeInteger(row.earned_at)?row.earned_at:null,
        reviewedAt:Number.isSafeInteger(row.reviewed_at)?row.reviewed_at:null,
        reasons:readSportWarningReasons(row.reason_codes),
        currentEpoch:row.current_epoch===1,
      }))});
  }catch(error){
    // Telemetry is optional; do not CREATE tables or change the sporting ledger.
    console.error('sport warnings read unavailable',String(error?.name||'unknown'));
    return respond({error:'telemetry_unavailable'},503);
  }
}

// Protected account inventory: public handles and aggregate counts only,
// without email, password hashes, tokens, routes or full private run snapshots.
async function accounts(db,request,url){
  if(!await currentAdmin(db,request))return respond({error:'admin_required'},401);
  const page=adminPage(url.searchParams.get('page'));
  const handle=(url.searchParams.get('handle')||'').trim().toLowerCase();
  if(page===null||(handle&&!/^[a-z0-9][a-z0-9_.-]{0,23}$/.test(handle))||
    [...url.searchParams.keys()].some(k=>!['page','handle'].includes(k)))
    return respond({error:'invalid_filter'},400);
  const filter=handle?' WHERE u.handle GLOB ?':'';
  const params=handle?[handle+'*']:[];
  const count=await db.prepare('SELECT COUNT(*) AS total FROM community_users u'+filter)
    .bind(...params).first();
  const rows=await db.prepare(`SELECT u.handle,u.created_at,
      COALESCE(settings.show_challenges,1) AS is_public,
      (SELECT COUNT(*) FROM sport_world_cards c WHERE c.current_owner_id=u.id)
        AS cards,
      (SELECT COUNT(*) FROM account_run_records r WHERE r.user_id=u.id)
        AS runs
    FROM community_users u
    LEFT JOIN community_profile_settings settings ON settings.user_id=u.id
    ${filter}
    ORDER BY u.created_at DESC,u.handle ASC LIMIT ? OFFSET ?`)
    .bind(...params,ADMIN_PAGE_SIZE,(page-1)*ADMIN_PAGE_SIZE).all();
  return respond({page,pageSize:ADMIN_PAGE_SIZE,total:Number(count?.total)||0,
    items:(rows.results||[]).map(x=>({
      handle:x.handle,createdAt:x.created_at,
      public:Number(x.is_public)===1,cards:Number(x.cards)||0,
      runs:Number(x.runs)||0,
    }))});
}

export async function adminRequest(request, env, url) {
  if (!env.DB || env.CATALOG_BACKEND !== 'd1') {
    return respond({ error: 'admin_unavailable' }, 503);
  }
  try {
    const path = url.pathname;
    const method = request.method;
    if (path === '/api/admin/me' && method === 'GET') {
      const admin = await currentAdmin(env.DB, request);
      return respond(admin
        ? { authenticated: true, email: admin.email }
        : { authenticated: false });
    }
    if (path === '/api/admin/overview' && method === 'GET')
      return overview(env.DB,request);
    if (path === '/api/admin/sport/cards' && method === 'GET')
      return sportCards(env.DB,request,url);
    if (path === '/api/admin/sport/warnings' && method === 'GET')
      return sportWarnings(env.DB,request,url);
    if (path === '/api/admin/accounts' && method === 'GET')
      return accounts(env.DB,request,url);
    if (path === '/api/admin/login' && method === 'POST') return await login(env.DB, env, request);
    if (path === '/api/admin/logout' && method === 'POST') return await logout(env.DB, request);
    if (path==='/api/admin/cards/backfill' && method==='POST') {
      if (!verifyOrigin(request)) return respond({error:'origin_forbidden'},403);
      if (!await currentAdmin(env.DB,request)) return respond({error:'admin_required'},401);
      const body=await parseBody(request);
      const cursor=body?.afterId??0;
      if (!Number.isSafeInteger(cursor)||cursor<0) return respond({error:'invalid_cursor'},400);
      await requireCardSchema(env.DB);
      return respond(await backfillWorkoutCards(env.DB,cursor));
    }
    if (path==='/api/admin/cards/gift' && method==='POST') {
      if (!verifyOrigin(request)) return respond({error:'origin_forbidden'},403);
      if (!await currentAdmin(env.DB,request)) return respond({error:'admin_required'},401);
      const body=await parseBody(request);
      const id=Number(body?.id);
      if (!Number.isSafeInteger(id)||id<=D1_OFFSET) return respond({error:'invalid_card'},400);
      await requireCardSchema(env.DB);
      const row=await env.DB.prepare('SELECT owner_user_id FROM workout_cards WHERE share_id=?')
        .bind(id-D1_OFFSET).first();
      if (!row) return respond({error:'card_not_found'},404);
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const token=hex(bytes);
      const now=Date.now();
      await env.DB.prepare(`INSERT INTO workout_card_gifts
        (token_hash,share_id,expected_owner_id,expires_at)
        VALUES(?,?,?,?)`).bind(await hashGiftToken(token),id-D1_OFFSET,
          row.owner_user_id,now+7*86400000).run();
      return respond({url:'https://beatonstep.app/cadeau.html#gift='+token,
        expiresAt:now+7*86400000});
    }
    const match = /^\/api\/admin\/shared\/([1-9][0-9]{0,14})$/.exec(path);
    if (match && method === 'DELETE') return await deleteShare(env.DB, request, match[1]);
    return respond({ error: 'not_found' }, 404);
  } catch (error) {
    console.error('catalogue admin unavailable', String(error?.message || error).slice(0, 90));
    return respond({ error: 'admin_unavailable' }, 503);
  }
}
