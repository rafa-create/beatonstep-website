const assert = require('node:assert/strict');
const card = require('../share-card.js');

const input = {
  v:1,
  lang:'fr',
  ppm:71,
  cadence:'target',
  trackBpm:142,
  steps:3245,
  title:'A & B <live> 🎵',
  artist:'Unknown Artist'
};

assert.equal(card.variants.length,4);
const compactVariant = card.variants.find(v => v.id === 'compact');
assert.equal(compactVariant.width,1200);
assert.equal(compactVariant.height,630);
assert.equal(card.variants.find(v => v.id === 'music').en,'Now playing');
assert.equal(card.variants.find(v => v.id === 'soundtrack').fr,'Morceau de la course');
assert.equal(card.variants.find(v => v.id === 'soundtrack').en,'Track of the run');
assert.equal(card.variants.find(v => v.id === 'rhythm').fr,'Ma cadence');
assert.equal(card.variants.find(v => v.id === 'rhythm').en,'My cadence');

assert.equal(card.normalize(input).artist,'');
assert.equal(card.normalize({...input,trackBpm:Infinity}).trackBpm,null);
assert.equal(card.normalize({v:1,ppm:'170',steps:Infinity}).ppm,null);
assert.equal(card.normalize({...input,trackBpm:401}).trackBpm,null);

for(const v of card.variants){
  const svg=card.render(input,v.id);
  assert(svg.includes('142'));
  assert(!svg.includes('Unknown Artist'));
  assert(!svg.includes('<live>'));
  assert(svg.includes('&amp;'));
  assert(svg.includes('71'));
  assert(svg.includes(`viewBox="0 0 ${v.width} ${v.height}"`));
  assert(!svg.includes('<rect width="1080" height="1920"'));
  assert(svg.includes('#fcea07'));

  assert(!card.render({v:1,title:'<script>alert(1)</script>'},v.id).includes('<script>'));
  assert(!card.render({v:2,ppm:170},v.id).includes('>170</text>'));
  assert(!card.render({v:1,title:'Title'},v.id).includes('null'));
}

const run = {
  ...input,
  lang:'en',
  cadence:'measured',
  avgPpm:63,
  avgMusicBpm:173,
  runCadence:'measured',
  trackOfRunTitle:'Air',
  trackOfRunArtist:'Scott Buckley',
  trackOfRunBpm:199,
  sessionSec:60,
  runSteps:21,
  trackCount:3
};

assert(card.render({...input,lang:'en'},'rhythm').includes('TARGET CADENCE'));
assert(card.render({...input,lang:'en',cadence:'measured'},'rhythm').includes('CURRENT TRACK'));
assert(card.render({...input,lang:'fr',cadence:'measured'},'rhythm').includes('MORCEAU EN COURS'));
assert(card.render({...input,lang:'en',cadence:'measured'},'music').includes('CURRENT CADENCE'));
assert(card.render({...input,lang:'fr',cadence:'measured'},'music').includes('CADENCE ACTUELLE'));

const soundtrack = card.render(run,'soundtrack');
assert(soundtrack.includes('TRACK OF THE RUN'));
assert(soundtrack.includes('199 BPM'));
assert(soundtrack.includes('AVERAGE MUSIC'));
assert(soundtrack.includes('AVERAGE CADENCE'));

const shortRun = {
  v:1,
  lang:'fr',
  ppm:108,
  cadence:'measured',
  trackBpm:118,
  steps:13,
  title:'Alien',
  artist:'Dennis Lloyd',
  avgPpm:108,
  avgMusicBpm:118,
  runCadence:'measured',
  trackOfRunTitle:'Alien',
  trackOfRunArtist:'Dennis Lloyd',
  trackOfRunBpm:118,
  sessionSec:60,
  runSteps:13,
  trackCount:1
};

const shortRhythm = card.render(shortRun,'rhythm');
assert(!shortRhythm.includes('pas / minute'));
assert(!shortRhythm.includes('RYTHME DU MORCEAU'));
assert(shortRhythm.includes('>118 BPM</text>'));

const shortMusic = card.render(shortRun,'music');
assert(!shortMusic.includes('RYTHME DU MORCEAU'));
assert(shortMusic.includes('108 PPM · CADENCE ACTUELLE'));

const shortSoundtrack = card.render(shortRun,'soundtrack');
assert.equal((shortSoundtrack.match(/118 BPM/g) || []).length,1);
assert(!shortSoundtrack.includes('MUSIQUE MOYENNE'));
assert(!shortSoundtrack.includes('BPM MOYENS'));
assert(shortSoundtrack.includes('108 PPM · CADENCE MOYENNE'));

const oneLineMusic = card.render(shortRun,'music');
assert(oneLineMusic.includes('x="540" y="410"'));
assert(oneLineMusic.includes('x="540" y="482"'));

const twoLineRun = {...shortRun,title:'A very long title that wraps cleanly',artist:'Artist'};
const twoLineMusic = card.render(twoLineRun,'music');
assert(twoLineMusic.includes('x="540" y="410"'));
assert(twoLineMusic.includes('x="540" y="486"'));
assert(twoLineMusic.includes('x="540" y="558"'));

const compact = card.render(run,'compact');
assert(compact.includes('TRACK TEMPO'));
assert(compact.includes('SPM'));
assert(!compact.includes('63 SPM / 199 BPM'));

assert(card.render(input,'rhythm','dark').includes('#11140f'));
assert(card.render(input,'rhythm').includes('clip-path="url(#brandLogoClip)"'));
assert(card.render(input,'compact').includes('x="390" y="50" width="80" height="80"'));

console.log('4 variants, 1200x630 compact, FR/EN hierarchy, BPM vs PPM, escaping: passed');
