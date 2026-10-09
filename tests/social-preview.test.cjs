const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

function meta(name, key) {
  return home.match(new RegExp('<meta ' + name + '="' + key + '" content="([^"]+)"'))?.[1];
}

test('The homepage shares the official logo rather than an outdated promotional image', () => {
  const image = 'https://beatonstep.app/assets/brand/logo-400.jpg';
  assert.equal(meta('property', 'og:image'), image);
  assert.equal(meta('property', 'og:image:secure_url'), image);
  assert.equal(meta('property', 'og:image:width'), '400');
  assert.equal(meta('property', 'og:image:height'), '400');
  assert.equal(meta('name', 'twitter:image'), image);
  assert.equal(meta('name', 'twitter:card'), 'summary');
  assert.ok(meta('property', 'og:image:alt'));
  assert.ok(fs.existsSync(path.resolve(__dirname, '../assets/brand/logo-400.jpg')));
});
