const assert = require('node:assert/strict');
const card = require('../share-card.js');
const input = {v:1,lang:'fr',ppm:71,cadence:'target',trackBpm:142,steps:3245,title:'A & B <live> 🎵',artist:'Unknown Artist'};
assert.equal(card.variants.length,4);
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

 assert(!card.render({v:1,title:'<script>alert(1)</script>'},v.id).includes('<script>'));
 assert(!card.render({v:2,ppm:170},v.id).includes('>170</text>'));
 assert(!card.render({v:1,title:'Title'},v.id).includes('null'));
}
assert(card.render({...input,lang:'en'},'rhythm').includes('TARGET CADENCE'));
assert(card.render(input,'rhythm','dark').includes('#11140f'));
console.log('4 variants, transparent SVG, BPM vs PPM, empty/invalid data, XML escaping: passed');

assert(card.render(input,'poster').includes('La musique suit tes pas'));
assert(card.render(input,'rhythm').includes('clip-path="url(#brandLogoClip)"'));

assert(card.render(input,'poster','dark').includes('#11140f'));

assert(!card.render(input,'poster').includes('rafa-create.github.io/beatonstep-website'));
assert(card.render(input,'poster').includes('x="330" y="200" width="112" height="112"'));
assert(card.render(input,'compact').includes('x="330" y="70" width="80" height="80"'));
