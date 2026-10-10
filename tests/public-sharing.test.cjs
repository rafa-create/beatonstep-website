const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const page = read('partages.html');
assert.match(read('seances-programmees.html'), /href="partages.html"/);
assert.match(read('runmix.html'), /partages.html\?kind=runmix/);
assert.match(page, /data-kind="workout"/);
assert.match(page, /data-kind="runmix"/);
assert.match(page, /data-sort="popular"/);
for (const src of ['spotify','apple','deezer','youtube','amazon']) {
  assert.match(page, new RegExp('option value="' + src + '"'));
}
assert.doesNotMatch(page, /option value="(?:local|server)"/);
assert.match(page, /source=\x27\s*\+/);
assert.match(page, /phaseTree\(content,full\)/);
assert.match(page, /songRows\(content,full\)/);
assert.match(page, /getDetail\(item.id\)/);
assert.match(page, /el\(\x27details\x27,\x27share-tree\x27\)/);
assert.match(page, /imports/);
assert.match(page, /beatonstep:\/\/shared\?id=/);
assert.match(page, /item\.payload\.p/);
assert.match(page, /document\.createElement/);
assert.doesNotMatch(page, /\.innerHTML\s*=/);
console.log('Public sharing page: filters, popularity, phases, deep link and safe DOM OK');
