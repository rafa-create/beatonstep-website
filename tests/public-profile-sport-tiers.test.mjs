import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../compte.html',import.meta.url),'utf8');
const percentileSource=readFileSync(
  new URL('../sport-card-percentile.js',import.meta.url),'utf8');
const faceSource=readFileSync(
  new URL('../dist/sport-card-face.js',import.meta.url),'utf8');
const officialRules=JSON.parse(readFileSync(
  new URL('../sport-card-rules.json',import.meta.url),'utf8'));

// npm run build generates the seven card skins before running browser tests.
// The source template deliberately contains an empty placeholder and cannot
// render real cards without the official JSON-derived compiled levels.
assert.doesNotMatch(faceSource,/__SPORT_CARD_LEVELS__/);

class Node {
  constructor(tag){
    this.tagName=tag;this.className='';this.children=[];this.attributes={};
    this.href='';this._text='';
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this.attributes[name]=String(value);}
}
const start=page.indexOf('  const sportPublicName=card=>{');
const end=page.indexOf('  // Public sessions',start);
assert.ok(start>0&&end>start,'public cards must have a dedicated renderer');
const publicRenderer=page.slice(start,end);
const card=(difficulty='amateur')=>({
  id:42,distanceCm:500000,timeUnit:'minute',subValue:29,difficulty,
});

async function render({rules=officialRules,available=true,cards=[card()],ghosts=[]}={}){
  const list=new Node('ul');
  const context={
    fetch:async()=>available
      ?{ok:true,json:async()=>rules}:{ok:false},
    document:{createElement:tag=>new Node(tag)},
    $:id=>{assert.equal(id,'public-challenge-cards');return list;},
  };
  vm.runInNewContext(percentileSource,context);
  vm.runInNewContext(faceSource,context);
  const renderCards=vm.runInNewContext(
    publicRenderer+';renderPublicChallenges',context);
  await context.BeatOnStepSportPercentiles.ready();
  renderCards(cards,ghosts);
  return list;
}

function firstNode(parent,needle){
  if(parent.className.split(' ').includes(needle))return parent;
  for(const child of parent.children){
    const found=firstNode(child,needle);
    if(found)return found;
  }
  return null;
}

test('public profile loads the same centralized rules as the authenticated deck',()=>{
  const profile=page.slice(page.indexOf("  (async()=>{",page.indexOf('function showPublicDeck()')));
  assert.match(page,/<script src="\/sport-card-percentile\.js"><\/script>/);
  assert.match(publicRenderer,/difficulty:BeatOnStepSportPercentiles\.visibleTier\(card\)/);
  assert.match(publicRenderer,/BeatOnStepSportPercentiles\.label\(card,'fr'\)/);
  assert.doesNotMatch(publicRenderer,/difficulty:card\.difficulty/);
  assert.doesNotMatch(publicRenderer,/capsByDistance|percentileCalibration/);
  assert.match(profile,/if\(data\.showChallenges===true\)[\s\S]*?await BeatOnStepSportPercentiles\.ready\(\);[\s\S]*?renderPublicChallenges\(data\.challenges\|\|\[\],data\.ghosts\|\|\[\]\)/);
  assert.doesNotThrow(()=>new vm.Script(page.match(/<script>([\s\S]*?)<\/script>/)[1]));
});

test('outdated D1 difficulty is not used for public card face or world top label',async()=>{
  const list=await render();
  assert.equal(list.children.length,1);
  const tile=list.children[0];
  const faceLink=tile.children[0];
  assert.equal(faceLink.tagName,'a');
  assert.equal(faceLink.href,'/partages.html?kind=challenge&sport=42');
  const face=faceLink.children[0];
  assert.match(face.className,/sport-skin--intermediate/);
  assert.equal(face.attributes.role,'img');
  assert.match(face.attributes['aria-label'],/Intermédiaire, 4 étoiles sur 7/);
  assert.equal(firstNode(tile,'public-challenge-rank').textContent,
    'Intermédiaire');
  assert.equal(tile.children[2].href,
    '/partages.html?kind=challenge&sport=42');
  assert.equal(tile.children[2].textContent,'Voir la fiche');
});

test('a future official JSON revision automatically changes the public card',async()=>{
  const future=structuredClone(officialRules);
  future.revision='future-tier-test';
  future.capsByDistance['500000'].expert=28;
  const list=await render({rules:future});
  assert.match(list.children[0].children[0].children[0].className,
    /sport-skin--intermediate/);
  assert.equal(firstNode(list,'public-challenge-rank').textContent,
    'Top ≈ 24 % mondial');
});

test('unavailable official rules fall back to the stored tier, never invent a percentile',async()=>{
  const list=await render({available:false});
  assert.match(list.children[0].children[0].children[0].className,/sport-skin--amateur/);
  assert.equal(firstNode(list,'public-challenge-rank').textContent,'Amateur');
});

test('empty public challenge list is unchanged',async()=>{
  const list=await render({cards:[]});
  assert.equal(list.children.length,1);
  assert.match(list.children[0].textContent,/Aucune carte Défi/);
});

test('ghosts on a public profile reuse the true card face and previous-ownership label',async()=>{
  const list=await render({cards:[],ghosts:[{...card(),id:61,ghost:true}]});
  assert.equal(list.children.length,1);
  const tile=list.children[0];
  assert.match(tile.children[0].children[0].className,/is-ghost/);
  assert.equal(tile.children[0].href,'/partages.html?kind=challenge&sport=61');
  assert.match(tile.children[0].attributes['aria-label'],/carte fantôme/);
  assert.match(tile.textContent,/Carte fantôme · Ancienne possession validée/);
  assert.equal(tile.children[2].href,'/partages.html?kind=challenge&sport=61');
});
