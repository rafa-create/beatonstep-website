const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(base, name), 'utf8');
const home = read('index.html');
const page = read('seances-programmees.html');
const css = read('site.css');

assert(home.includes('id="seances-programmees"'), 'Homepage workout section');
assert(home.includes('Trois façons de courir en musique'), 'Three experience paths on home');
assert(home.includes('Three ways to run with music'), 'English experience title');
assert(home.includes('Tu programmes l’effort, la musique suit chaque phase'), 'Planned workout on the home mode choices');
assert(home.includes('You plan the effort, music follows each phase'), 'Third choice translated');

assert(!home.includes('class="first-run'), 'Remove redundant first-run block from homepage');
assert(!home.includes('Tu peux courir tout de suite'), 'Remove redundant FR first-run heading');
assert(!home.includes('You can run right away'), 'Remove redundant EN first-run heading');

const teaser = home.split('<article class="split-card pace-workout-card" id="seances-programmees">')[1]?.split('</article>')[0];
assert(teaser, 'Find third running mode on homepage');
assert(teaser.includes('data-href="seances-programmees.html"'), 'Keep dedicated workout page link');
assert(!teaser.includes('<img'), 'Planned workout mode must stay legible without a promo image');
assert(teaser.includes('120 <small>BPM</small>'), 'Readable phase tempo example');
assert(!css.includes('.workouts-home-teaser'), 'Remove orphaned teaser layout');
assert(!css.includes('.first-run'), 'Remove obsolete first-run styling');

assert(page.includes('À chaque séance, <span>sa playlist.</span>'), 'Concise French headline');
assert(page.includes('A playlist for <span>every workout.</span>'), 'Concise English headline');
assert(page.includes('importe celles qui te plaisent dans BeatOnStep'), 'Import path explained');
assert(page.includes('play them with your music source'), 'Music source explained in English');
assert(page.includes('href="partages.html"'), 'Catalogue link retained');
assert.equal((page.match(/class="workouts-catalogue"/g) || []).length, 2, 'One primary catalogue link per language');
assert(!page.includes('workouts-main-visual'), 'No giant promotional images');
assert(!page.includes('<figure'), 'No promotional artwork');
assert(!page.includes('workouts-benefits'), 'No repetitive cards');
assert(!page.includes('workouts-steps'), 'No redundant walkthrough');
assert(!page.includes('class="app-bar"'), 'No oversized store badge banner');
assert(css.includes('.workouts-catalogue'), 'Catalogue button has dedicated compact styling');
assert(css.includes('@media (max-width: 600px)'), 'Mobile styling');
assert(!css.includes('.workouts-showcase'), 'Remove now-orphaned feature art layout');
console.log('Workout landing: concise FR/EN copy, catalogue CTA, no artwork, responsive styling OK.');
