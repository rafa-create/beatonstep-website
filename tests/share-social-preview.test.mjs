import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';
import { validD1ShareId, renderSharePreview, sharePreview } from '../worker/share-preview.js';

const PAGE = readFileSync('partages.html', 'utf8');
const PUBLIC_ID = 1_000_000_000_001;
const card = {
  kind: 'workout', name: 'Course progressive 40 min',
  source: 'spotify', duration_sec: 2400, phases: 3, tracks: 11, bpm: null,
};

function environment(row = card) {
  const queries = [];
  const assetsCalls = [];
  const env = {
    CATALOG_BACKEND: 'd1',
    DB: {
      prepare(sql) {
        queries.push(sql);
        return {
          bind(id) {
            assert.equal(id, 1, 'public ID translates to the D1 row ID');
            return { first: async () => row };
          },
        };
      },
    },
    ASSETS: {
      fetch(request) {
        assetsCalls.push(request.url);
        return new Response(PAGE, {
          headers: { 'content-type': 'text/html', etag: '"fake-asset-etag"' },
        });
      },
    },
  };
  return { env, queries, assetsCalls };
}

test('share OG tags are already personalized in initial HTML for social robots', async () => {
  const { env, queries } = environment();
  const url = 'https://beatonstep.app/partages.html?id=' + PUBLIC_ID;
  const response = await worker.fetch(new Request(url, {
    headers: { 'user-agent': 'WhatsApp/2.24' },
  }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('etag'), null);
  const html = await response.text();
  assert.match(html, /<title>Course progressive 40 min — BeatOnStep<\/title>/);
  assert.match(html, /<meta property="og:title" content="Course progressive 40 min — BeatOnStep">/);
  assert.match(html, /<meta property="og:description" content="Séance musicale · 40 min · 3 phases · 11 titres · Spotify\. À découvrir et importer dans BeatOnStep\.">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/beatonstep\.app\/partages\.html\?id=1000000000001">/);
  assert.match(html, /<meta name="twitter:card" content="summary">/);
  assert.match(html, /<meta name="twitter:title" content="Course progressive 40 min — BeatOnStep">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/beatonstep\.app\/assets\/brand\/logo-400\.jpg">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/beatonstep\.app\/partages\.html\?id=1000000000001">/);
  assert.match(html, /const API='\/api\/shared';/, 'native client-side catalogue remains intact');
  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT kind,source,name,duration_sec,bpm,tracks,phases FROM shared_items WHERE id = \?/);
  assert.doesNotMatch(queries[0], /payload_json|UPDATE|INSERT/);
});

test('Run Mix preview displays song count and BPM but no private tracks', async () => {
  const { env } = environment({
    kind: 'runmix', name: 'Mon Run Mix', duration_sec: 1800, bpm: 174,
    tracks: 9, phases: 0, source: 'deezer',
  });
  const response = await worker.fetch(new Request(
    'https://beatonstep.app/partages.html?id=' + PUBLIC_ID,
  ), env);
  const html = await response.text();
  assert.match(html, /Run Mix · 30 min · 9 titres · 174 BPM · Deezer/);
  assert.doesNotMatch(html, /<meta[^>]*?user_id|<meta[^>]*?payload_json/);
});

test('malformed and legacy IDs keep generic metadata without D1 queries', async () => {
  for (const id of ['not-a-number', '3', '1000000000000', '9007199254740991']) {
    const { env, queries } = environment();
    const response = await worker.fetch(new Request(
      'https://beatonstep.app/partages.html?id=' + id,
    ), env);
    assert.equal(await response.text(), PAGE);
    assert.deepEqual(queries, [], id);
  }
  assert.equal(validD1ShareId(String(PUBLIC_ID)), 1);
  assert.equal(validD1ShareId('1'), null);
});

test('deleted and nonexistent shares retain honest generic preview', async () => {
  const { env, queries } = environment(null);
  const response = await worker.fetch(new Request(
    'https://beatonstep.app/partages.html?id=' + PUBLIC_ID,
  ), env);
  const html = await response.text();
  assert.equal(html, PAGE);
  assert.match(html, /Partages BeatOnStep — Séances et playlists/);
  assert.equal(queries.length, 1);
});

test('catalogue without ID and other asset routes stay static', async () => {
  const { env, queries } = environment();
  const catalog = await worker.fetch(new Request('https://beatonstep.app/partages.html'), env);
  assert.equal(await catalog.text(), PAGE);
  const privacy = await worker.fetch(new Request('https://beatonstep.app/privacy.html'), env);
  assert.equal(await privacy.text(), PAGE);
  assert.deepEqual(queries, []);
});

test('D1 failures do not break existing browser share links', async () => {
  const { env } = environment();
  env.DB.prepare = () => { throw Error('temporarily unavailable'); };
  const response = await worker.fetch(new Request(
    'https://beatonstep.app/partages.html?id=' + PUBLIC_ID,
  ), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), PAGE);
});

test('social tags escape unsafe titles rather than allowing HTML injections', () => {
  const malicious = { ...card, name: 'A & "B" <script>alert(1)</script>' };
  const html = renderSharePreview(PAGE, sharePreview(malicious, PUBLIC_ID));
  assert.match(html, /<title>A &amp; &quot;B&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt; — BeatOnStep<\/title>/);
  assert.match(html, /<meta property="og:title" content="A &amp; &quot;B&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt; — BeatOnStep">/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
