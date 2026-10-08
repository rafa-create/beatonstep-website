const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(base, name), 'utf8');
const home = read('index.html');
const page = read('seances-programmees.html');
const css = read('site.css');

assert(home.includes('id="seances-programmees"'), 'Homepage workout section');
assert(home.includes('Une playlist pour chaque phase de ta course.'), 'Homepage updated copy');
assert(home.includes('A playlist for every phase of your run.'), 'Homepage English translation');

for (const src of ['assets/workouts/playlists-sur-mesure.webp', 'assets/workouts/course-en-musique.webp']) {
  assert(page.includes(src), 'Workout page must display ' + src);
  assert(fs.statSync(path.join(base, src)).size > 10000, 'Real image exists: ' + src);
}
assert(page.includes('La playlist se crée'), 'Smart phase selection described');
assert(page.includes('Your playlist comes together'), 'English copy is present');
assert(page.includes('durée musicale réelle'), 'True playable track duration explained');
assert(page.includes('Known BPM values are preferred'), 'Fallback behavior explained');
assert(page.includes('Tu ajustes, tu lances, tu cours.'), 'Product feature described');
assert(css.includes('@media (max-width: 700px)'), 'Responsive layout');
assert(css.includes('.workouts-showcase'), 'Feature art layout');
console.log('Workout page: FR/EN + copy + image assets + responsive rules OK.');
