const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const workouts = fs.readFileSync(path.join(__dirname, '..', 'seances-programmees.html'), 'utf8');

assert.match(home, /<section class="app-preview" id="source-settings" hidden>/, 'Settings initially hidden');
assert(home.includes('Commun à toutes les sources'), 'Settings copy preserved');
assert(home.includes('Shared across every source'), 'Settings translation preserved');
for (const page of [home, workouts]) {
  assert(!page.includes('Nouveau · Playlists de séance'), 'Avoid new-flag in FR');
  assert(!page.includes('New · Workout playlists'), 'Avoid new-flag in EN');
  assert.match(page, /<p class="tag" data-fr>Playlists de séance<\/p>/);
  assert.match(page, /<p class="tag" data-en>Workout playlists<\/p>/);
}

const ids = ['spotify', 'apple-music', 'ytm', 'amazon-music', 'deezer', 'mp3', 'mix', 'qqmusic'];
const makeNode = id => ({
  id,
  attributes: { 'data-src': id, 'aria-pressed': 'false' },
  parentElement: { classList: { add() {}, remove() {} } },
  classList: { add() {}, remove() {} },
  events: {},
  getAttribute(name) { return this.attributes[name] ?? null; },
  setAttribute(name, val) { this.attributes[name] = val; },
  addEventListener(name, fn) { this.events[name] = fn; },
});
const cards = ids.map(makeNode);
const rows = ids.map(makeNode);
const root = {
  attributes: {},
  querySelectorAll(s) {
    if (s === '.source-card') return cards;
    if (s === '.source-matrix tbody tr[data-src]') return rows;
    throw new Error(s);
  },
  getAttribute(n) { return this.attributes[n] ?? null; },
  setAttribute(n, v) { this.attributes[n] = v; },
  removeAttribute(n) { delete this.attributes[n]; },
};
const settings = { hidden: true };
const document = {
  querySelector(s) { return s === '.sources' ? root : null; },
  getElementById(id) { return id === 'source-settings' ? settings : null; },
};
const start = home.indexOf('      (function sources() {');
const end = home.indexOf('      (function faqFormule()', start);
assert(start > 0 && end > start, 'Source handler exists');
vm.runInNewContext(home.slice(start, end), { document });

assert.equal(settings.hidden, true, 'Initially hidden');
cards[0].events.click();
assert.equal(root.getAttribute('data-src'), 'spotify');
assert.equal(settings.hidden, false, 'Settings open after source card click');
assert.equal(cards[0].getAttribute('aria-pressed'), 'true');

rows[4].events.click();
assert.equal(root.getAttribute('data-src'), 'deezer');
assert.equal(settings.hidden, false, 'Settings stay open switching source via table');
assert.equal(cards[0].getAttribute('aria-pressed'), 'false');

rows[4].events.click();
assert.equal(root.getAttribute('data-src'), null);
assert.equal(settings.hidden, true, 'Settings close after reselecting source');

let prevented = false;
rows[7].events.keydown({ key: 'Enter', preventDefault() { prevented = true; } });
assert(prevented, 'Keyboard activates row');
assert.equal(settings.hidden, false);
assert.equal(root.getAttribute('data-src'), 'qqmusic');

rows[7].events.keydown({ key: ' ', preventDefault() {} });
assert.equal(settings.hidden, true, 'Space closes same source');
console.log('Source settings: hidden/default, card click, table click, keyboard, re-click + FR/EN labels OK.');
