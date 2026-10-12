import { backfillWorkoutCards, requireCardSchema } from './cards.js';
import { hashGiftToken } from './pack.js';

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
      return respond({url:'https://beatonstep.app/compte.html#gift='+token,
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
