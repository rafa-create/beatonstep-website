import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { existsSync, readFileSync } from 'node:fs';

test('worker reports mode without requiring a D1 binding', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/health'), {
    CATALOG_BACKEND: 'legacy',
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.catalog, 'legacy');
});

test('missing D1 binding never silently creates a new catalogue', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/shared'), {
    CATALOG_BACKEND: 'd1',
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(response.status, 503);
});

test('static site assets are served without backend dependencies', async () => {
  const response = await worker.fetch(new Request('https://example.com/privacy.html'), {
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(await response.text(), 'STATIC');
});

test('wrangler routes API first and excludes private sources from static output', async () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.name, 'beatonstep-website');
  assert.deepEqual(config.assets.run_worker_first, ['/api/*']);
  assert.ok(!existsSync('dist/worker/index.js'));
  assert.ok(!existsSync('dist/migrations/0001_shared_catalog.sql'));
  assert.ok(existsSync('dist/partages.html'));
});

test('public share page uses same-origin API, never a VM hostname', async () => {
  const page = readFileSync('partages.html', 'utf8');
  assert.match(page, /const API='\/api\/shared';/);
  assert.doesNotMatch(page, /beatonstep\.tail09d8d8\.ts\.net/);
});

test('D1 publish fails closed without the publishing salt', async () => {
  const response = await worker.fetch(new Request('https://beatonstep.app/api/shared', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'runmix', payload: {
      v: 1, i: '0123456789abcdef', s: 'spotify', t: [['Song A']], n: 'Test'
    } }),
  }), {
    CATALOG_BACKEND: 'd1',
    DB: { prepare: () => { throw Error('A write was attempted'); } },
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'catalog_write_not_configured');
});
