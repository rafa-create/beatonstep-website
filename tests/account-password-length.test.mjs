import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountRequest } from '../worker/account.js';

const BASE = 'https://beatonstep.app';
const page = readFileSync('compte.html', 'utf8');

function database() {
  const writes = [];
  const DB = {
    prepare(sql) {
      const statement = (args = []) => ({
        bind(...values) { return statement(values); },
        async first() {
          if (sql.startsWith('INSERT INTO community_auth_limits')) return {count:1};
          if (sql.startsWith('SELECT id FROM community_users')) return null;
          throw Error('Unexpected query: ' + sql);
        },
        async run() {
          writes.push({sql,args});
          return {meta:{changes:1}};
        },
      });
      return statement();
    },
  };
  return {DB,writes};
}

async function register(password) {
  const {DB,writes} = database();
  const url = new URL(BASE + '/api/account/signup');
  const request = new Request(url, {
    method: 'POST',
    headers: {
      origin: BASE,
      'content-type': 'application/json',
      'cf-connecting-ip': '192.0.2.17',
    },
    body: JSON.stringify({
      email:'tester@example.test', handle:'runner', password, accept_terms:true,
    }),
  });
  const response = await accountRequest(request, {
    DB, CATALOG_BACKEND:'d1', CATALOG_RATE_SALT:'test-only',
    COMMUNITY_SIGNUPS_ENABLED:'true',
  }, url);
  return {response,writes};
}

test('signup form documents six characters without parentheses', () => {
  assert.match(page, /id="signup-password"[^>]+minlength="6"/);
  assert.match(page, /<label for="signup-password">Mot de passe<\/label>/);
  assert.match(page, /6 caractères minimum\./);
  assert.doesNotMatch(page, /Mot de passe \(/);
  assert.doesNotMatch(page, /minlength="12"/);
});

test('password shorter than six characters is still rejected', async () => {
  const {response,writes} = await register('abcde');
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'invalid_registration');
  assert.equal(writes.length,0);
});

test('exactly six characters registers and stores a password hash, not plain text', async () => {
  const {response,writes} = await register('abc123');
  assert.equal(response.status,200);
  assert.equal((await response.json()).handle,'runner');
  assert.match(response.headers.get('set-cookie') || '', /^__Host-bos_community=/);
  assert.equal(writes.length,2);
  assert.match(writes[0].sql,/INSERT INTO community_users/);
  assert.notEqual(writes[0].args[4],'abc123');
  assert.match(writes[0].args[4],/^[a-f0-9]{64}$/);
  assert.match(writes[1].sql,/INSERT INTO community_sessions/);
});

test('longer passwords remain supported', async () => {
  const {response} = await register('correct-horse-battery-staple');
  assert.equal(response.status,200);
});
