const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const page = read('partages.html');
assert.match(page, /const API='\/api\/shared';/, 'catalog must use the same-origin Worker');
assert.match(read('seances-programmees.html'), /href="partages.html"/);
assert.match(read('runmix.html'), /partages.html\?kind=runmix/);
assert.match(page, /<select id="kind-filter"/);
assert.match(page, /<select id="sort-filter"/);
assert.match(page, /<select id="source-filter"/);
assert.match(page, /<option value="workout">Séances<\/option>/);
assert.match(page, /<option value="runmix">Playlists<\/option>/);
assert.match(page, /<option value="popular">Populaires<\/option>/);
assert.match(page, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
  'mobile filters must share one compact row');
for (const src of ['spotify','apple','deezer','youtube','amazon']) {
  assert.match(page, new RegExp('option value="' + src + '"'));
}
assert.doesNotMatch(page, /option value="(?:local|server)"/);
assert.match(page, /source=\x27\s*\+/);
assert.match(page, /phaseTree\(content,full\)/);
assert.match(page, /songRows\(content,full\)/);
assert.match(page, /getDetail\(item.id\)/);
assert.match(page, /el\(\x27details\x27,\x27share-tree\x27\)/);
assert.match(page, /stat-duration/);
assert.match(page, /stat-tracks/);
assert.match(page, /collection-number/);
assert.match(page, /drawEffortProfile\(art,full\)/);
assert.match(page, /collection-art--music/);
assert.doesNotMatch(page, /Créer un compte|Create an account/);
assert.match(page, /number\(item\.imports\)/);
assert.match(page, /stat-imports/);
assert.match(page, /share-source-logo/);
assert.match(page, /assets\/music-services\//);
assert.match(page, /\.primary\{width:auto\}/);
for (const icon of ['spotify','apple','deezer','youtube','amazon']) {
  const svg=read('assets/music-services/'+icon+'.svg');
  assert.match(svg, /<svg /,icon+' must be a local SVG asset');
  assert.match(svg, /viewBox="0 0 24 24"/,icon+' must be a usable icon');
}
assert.doesNotMatch(page, /Voir la fiche et importer/);
assert.match(page, /beatonstep:\/\/shared\?id=/);
assert.match(page, /item\.payload\.p/);
assert.match(page, /document\.createElement/);
assert.doesNotMatch(page, /\.innerHTML\s*=/);
console.log('Public sharing page: filters, popularity, phases, deep link and safe DOM OK');
