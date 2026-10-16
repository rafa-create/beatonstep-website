const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const workouts = fs.readFileSync(path.join(__dirname, '..', 'seances-programmees.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'site.css'), 'utf8');

assert.doesNotMatch(home,/id="source-settings"/,'Redundant settings presentation removed');
assert.doesNotMatch(home,/Dans Réglages : quelques secondes \(défaut 15 s\)/,
  'Redundant French track-change paragraph removed');
assert.doesNotMatch(home,/In Settings: a few seconds \(default 15 s\)/,
  'Redundant English track-change paragraph removed');
assert(home.includes('QQ Music · Chine uniquement'), 'Desktop and mobile QQ source labeled China only');
assert(home.includes('QQ Music · China only'), 'English QQ source labeled China only');
assert(home.includes('<strong>Disponible uniquement en Chine continentale.</strong>'), 'Explicit QQ regional availability after selection (FR)');
assert(home.includes('<strong>Available only in mainland China.</strong>'), 'Explicit QQ regional availability after selection (EN)');
assert(css.includes('.source-explain,\n.source-play { display: none; }'), 'Source descriptions default hidden');
assert(css.includes('.sources[data-src="qqmusic"] .source-explain[data-src="qqmusic"] {'), 'QQ detail revealed on source selection');
assert(!home.includes('Commun à toutes les sources'), 'Redundant settings text removed');
assert(!home.includes('Shared across every source'), 'Redundant settings translation removed');
for (const page of [home, workouts]) {
  assert(!page.includes('Nouveau · Playlists de séance'), 'Avoid new-flag in FR');
  assert(!page.includes('New · Workout playlists'), 'Avoid new-flag in EN');
  assert(
    page.includes('<p class="tag" data-fr>Playlists de séance</p>') ||
    page.includes('<p class="pace-kicker" data-fr>Séance programmée</p>'),
    'Workouts labeled in FR'
  );
  assert(
    page.includes('<p class="tag" data-en>Workout playlists</p>') ||
    page.includes('<p class="pace-kicker" data-en>Planned workout</p>'),
    'Workouts labeled in EN'
  );
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
const document = {
  querySelector(s) { return s === '.sources' ? root : null; },
};
const start = home.indexOf('      (function sources() {');
const end = home.indexOf('      (function faqFormule()', start);
assert(start > 0 && end > start, 'Source handler exists');
vm.runInNewContext(home.slice(start, end), { document });

cards[0].events.click();
assert.equal(root.getAttribute('data-src'), 'spotify');
assert.equal(cards[0].getAttribute('aria-pressed'), 'true');

rows[4].events.click();
assert.equal(root.getAttribute('data-src'), 'deezer');
assert.equal(cards[0].getAttribute('aria-pressed'), 'false');

rows[4].events.click();
assert.equal(root.getAttribute('data-src'), null);

let prevented = false;
rows[7].events.keydown({ key: 'Enter', preventDefault() { prevented = true; } });
assert(prevented, 'Keyboard activates row');
assert.equal(root.getAttribute('data-src'), 'qqmusic');

rows[7].events.keydown({ key: ' ', preventDefault() {} });
console.log('Source selection: card/table/keyboard toggles preserved; redundant settings section and text removed.');
