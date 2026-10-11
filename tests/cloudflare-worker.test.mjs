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
