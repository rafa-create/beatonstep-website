const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const home = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../app-update.json'), 'utf8'));
const start = home.indexOf('(function storeVersionNote() {');
const end = home.indexOf('</script>', start);
assert(start > 0 && end > start, 'Version note script must be present');

async function render(manifestValue, options = {}) {
  const fr = { textContent: '' };
  const en = { textContent: '' };
  const urls = [];
  const document = {
    querySelector(selector) {
      if (selector === '[data-version-note-fr]') return fr;
      if (selector === '[data-version-note-en]') return en;
      return null;
    },
  };
  const fetch = (url, opts) => {
    urls.push({ url, opts });
    if (options.unavailable) return Promise.reject(new Error('offline'));
    return Promise.resolve({
      ok: !options.httpError,
      json: () => Promise.resolve(manifestValue),
    });
  };
  vm.runInNewContext(home.slice(start, end), { document, fetch });
  // Wait for both promises in the fetch/json chain, including its catch.
  await new Promise(resolve => setImmediate(resolve));
  return { fr: fr.textContent, en: en.textContent, urls };
}

test('Show the actual app version from the public JSON on both language notes', async () => {
  assert.equal(manifest.schemaVersion, 1);
  const { fr, en, urls } = await render(manifest);
  assert.deepEqual([fr, en], [' · version 1.7.1', ' · version 1.7.1']);
  assert.equal(urls.length, 1);
  assert.equal(urls[0].url, 'app-update.json');
  assert.equal(urls[0].opts.cache, 'no-store');
});

test('Render both platform versions when they differ, regardless of Android build', async () => {
  const { fr, en } = await render({
    schemaVersion: 1,
    ios: { latestVersion: '1.8.0', latestBuild: 24 },
    android: { latestVersion: '1.7.1', latestBuild: 34 },
  });
  assert.equal(fr, ' · iOS 1.8.0 · Android 1.7.1');
  assert.equal(en, fr);
});

test('Invalid version in manifest is not displayed', async () => {
  const r = await render({
    schemaVersion: 1,
    ios: { latestVersion: '1.7.1-alpha' },
    android: { latestVersion: '1.7.1' },
  });
  assert.equal(r.fr, '');
  assert.equal(r.en, '');
});

test('Fetch failure leaves base availability message untouched', async () => {
  for (const opts of [{ unavailable: true }, { httpError: true }]) {
    const { fr, en } = await render(manifest, opts);
    assert.equal(fr, '');
    assert.equal(en, '');
  }
});
