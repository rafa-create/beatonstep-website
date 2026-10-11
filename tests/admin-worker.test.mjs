import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash } from '../worker/admin.js';
import worker from '../worker/index.js';

const OFFSET = 1_000_000_000_000;
const URL_ROOT = 'https://beatonstep.app';
const EMAIL = 'owner@example.test';
const PASSWORD = 'correct horse battery staple 2026';
const SALT = 'a7'.repeat(16);

function mockDatabase(hash) {
  const sessions = new Map();
  const rates = new Map();
  const cards = new Set([1, 2]);
  const rows = [];
  const db = {
    prepare(sql) {
      rows.push(sql);
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith('SELECT email,password_salt,password_hash FROM admin_users')) {
                return args[0] === EMAIL ? { email: EMAIL, password_salt: SALT, password_hash: hash } : null;
              }
              if (sql.startsWith('INSERT INTO admin_auth_attempts')) {
                const now = args[2], prev = rates.get(args[0]);
                const count = prev && prev.until > now ? prev.count + 1 : 1;
                rates.set(args[0], { count, until: args[1] });
                return { attempts: count };
              }
              if (sql.startsWith('SELECT u.email FROM admin_sessions')) {
                return sessions.has(args[0]) && sessions.get(args[0]) > args[1] ? { email: EMAIL } : null;
              }
              throw Error('unexpected first(): ' + sql);
            },
            async run() {
              if (sql.startsWith('INSERT INTO admin_sessions')) {
                sessions.set(args[0], args[2]);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('DELETE FROM admin_sessions')) {
                sessions.delete(args[0]);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('DELETE FROM shared_items')) {
                return { meta: { changes: cards.delete(args[0]) ? 1 : 0 } };
              }
              throw Error('unexpected run(): ' + sql);
            },
          };
        },
      };
    },
  };
  return { db, cards, rows };
}

const envFor = db => ({
  DB: db, CATALOG_BACKEND: 'd1', CATALOG_RATE_SALT: 'tests-only-unique-salt',
  ASSETS: { fetch: () => new Response('STATIC') },
});
const request = (path, method = 'GET', body, cookie = '', origin = URL_ROOT) => {
  const headers = new Headers({ origin, 'cf-connecting-ip': '192.0.2.1' });
  if (cookie) headers.set('cookie', cookie);
  if (body) headers.set('content-type', 'application/json');
  return new Request(URL_ROOT + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
};

test('admin remains unavailable outside D1; existing public health works', async () => {
  const env = { CATALOG_BACKEND: 'legacy', ASSETS: { fetch: () => new Response('STATIC') } };
  const res = await worker.fetch(request('/api/admin/me'), env);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'admin_unavailable');
  const health = await worker.fetch(request('/api/health'), env);
  assert.equal(health.status, 200);
});

test('unregistered visitors cannot delete a public D1 card', async () => {
  const { db, cards } = mockDatabase('00'.repeat(32));
  const env = envFor(db);
  const me = await worker.fetch(request('/api/admin/me'), env);
  assert.deepEqual(await me.json(), { authenticated: false });
  const del = await worker.fetch(request('/api/admin/shared/' + (OFFSET + 1), 'DELETE'), env);
  assert.equal(del.status, 401);
  assert.deepEqual([...cards], [1, 2]);
});

test('admin login requires matching Origin and valid credentials', async () => {
  const { db } = mockDatabase(await passwordHash(PASSWORD, SALT));
  const env = envFor(db);
  const evil = await worker.fetch(request('/api/admin/login', 'POST',
    { email: EMAIL, password: PASSWORD }, '', 'https://evil.example'), env);
  assert.equal(evil.status, 403);
  const invalid = await worker.fetch(request('/api/admin/login', 'POST',
    { email: EMAIL, password: 'invalid password string' }), env);
  assert.equal(invalid.status, 401);
  assert.equal(invalid.headers.get('set-cookie'), null);
});

test('admin session can delete D1 card only using full public ID, then logs out', async () => {
  const { db, cards } = mockDatabase(await passwordHash(PASSWORD, SALT));
  const env = envFor(db);
  const login = await worker.fetch(request('/api/admin/login', 'POST',
    { email: EMAIL, password: PASSWORD }), env);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).authenticated, true);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /__Host-bos_admin=[a-f0-9]{64}/);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  const sessionCookie = cookie.split(';')[0];
  const me = await worker.fetch(request('/api/admin/me', 'GET', null, sessionCookie), env);
  assert.deepEqual(await me.json(), { authenticated: true, email: EMAIL });

  const oldId = await worker.fetch(request('/api/admin/shared/1', 'DELETE', null, sessionCookie), env);
  assert.equal(oldId.status, 404);
  assert.deepEqual([...cards], [1, 2]);
  const unauthorizedOrigin = await worker.fetch(request('/api/admin/shared/' + (OFFSET + 1),
    'DELETE', null, sessionCookie, 'https://other.example'), env);
  assert.equal(unauthorizedOrigin.status, 403);
  assert.deepEqual([...cards], [1, 2]);
  const deleted = await worker.fetch(request('/api/admin/shared/' + (OFFSET + 1),
    'DELETE', null, sessionCookie), env);
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true, id: OFFSET + 1 });
  assert.deepEqual([...cards], [2]);
  const again = await worker.fetch(request('/api/admin/shared/' + (OFFSET + 1),
    'DELETE', null, sessionCookie), env);
  assert.equal(again.status, 404);
  const logout = await worker.fetch(request('/api/admin/logout', 'POST', null, sessionCookie), env);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  const after = await worker.fetch(request('/api/admin/me', 'GET', null, sessionCookie), env);
  assert.deepEqual(await after.json(), { authenticated: false });
});

test('rate limiting blocks repeated invalid login attempts before password checks', async () => {
  const { db, rows } = mockDatabase(await passwordHash(PASSWORD, SALT));
  const env = envFor(db);
  for (let index = 0; index < 8; index++) {
    const res = await worker.fetch(request('/api/admin/login', 'POST',
      { email: EMAIL, password: 'a deliberately wrong password' }), env);
    assert.equal(res.status, 401);
  }
  const blocked = await worker.fetch(request('/api/admin/login', 'POST',
    { email: EMAIL, password: PASSWORD }), env);
  assert.equal(blocked.status, 429);
  assert.ok(rows.filter(sql => sql.startsWith('SELECT email,password_salt,password_hash')).length === 8);
});
