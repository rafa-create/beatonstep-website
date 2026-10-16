import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../compte.html',import.meta.url),'utf8');

class Node {
  constructor(tag){
    this.tagName=tag;this.className='';this.children=[];this.attributes={};
    this.href='';this._text='';this.style={};
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this.attributes[name]=String(value);}
}
function render(items){
  const list=new Node('ul');
  const start=page.indexOf('  function renderPublicSessions(items){');
  const end=page.indexOf('  function showPublicDeck(){',start);
  assert.ok(start>0&&end>start,'dedicated public workout card rendering exists');
  const source=page.slice(start,end);
  const effortStart=page.indexOf('  function elEffort(profile){');
  const effortEnd=page.indexOf('  async function reusableGiftLink(',effortStart);
  assert.ok(effortStart>0&&effortEnd>effortStart,'saved graph helper exists');
  const effortSource=page.slice(effortStart,effortEnd);
  const context={
    document:{createElement:tag=>new Node(tag)},
    $:id=>{assert.equal(id,'public-items');return list;},
    currentCardGoal:item=>item?.goalMode==='distance'?'distance':'time',
  };
  const run=vm.runInNewContext(effortSource+'\n'+source+';renderPublicSessions',context);
  run(items);
  return list;
}
function firstClass(parent,name){
  if(parent.className===name)return parent;
  for(const child of parent.children){
    const found=firstClass(child,name);
    if(found)return found;
  }
  return null;
}

test('published sessions display as the same two-column collectible grid as challenges',()=>{
  assert.match(page,/id="public-items" class="public-session-cards"/);
  assert.match(page,/\.public-sport-cards,\.public-session-cards\{display:grid/);
  assert.match(page,/\.public-sport-cards,\.public-session-cards\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(page,/width:157px;max-width:100%;height:218px/);
  assert.doesNotMatch(page,/class="public-sessions-list"/);
  // Regression for Cloudflare Build #b9dacd64: public arrays are optional.
  // Never resurrect the former unconditional filter or omit ghost cards.
  assert.match(page,/renderPublicSessions\(\(data\.items\|\|\[\]\)\.filter\(item=>item\.kind==='workout'\)\)/);
  assert.doesNotMatch(page,/renderPublicSessions\(data\.items\.filter\(item=>item\.kind==='workout'\)\)/);
  assert.match(page,/renderPublicChallenges\(data\.challenges\|\|\[\],data\.ghosts\|\|\[\]\)/);
  assert.doesNotThrow(()=>new vm.Script(page.match(/<script>([\s\S]*?)<\/script>/)[1]));
});

test('published distance and duration sessions become accessible workout cards',()=>{
  const rows=render([
    {id:1000000000002,name:'Endurance fondamentale 5 km',goalMode:'distance',
      distanceMeters:5000,source:'spotify',imports:1},
    {id:1000000000003,name:'Pyramide 40 min',goalMode:'time',
      source:'apple',imports:0},
  ]);
  assert.equal(rows.children.length,2);
  const distance=rows.children[0],duration=rows.children[1];
  assert.equal(firstClass(distance,'bos-workout-goal').textContent,'5 KM');
  assert.equal(firstClass(duration,'bos-workout-goal').textContent,'DURÉE');
  assert.equal(firstClass(distance,'bos-workout-category').textContent,'CARTE SÉANCE');
  assert.equal(firstClass(duration,'bos-workout-name').textContent,'Pyramide 40 min');
  assert.equal(firstClass(distance,'public-session-meta').textContent,'spotify · 1 import');
  assert.equal(firstClass(duration,'public-session-meta').textContent,'apple · 0 imports');
  assert.equal(distance.children.at(-1).href,'/partages.html?id=1000000000002');
  assert.equal(duration.children.at(-1).attributes['aria-label'],
    'Voir la séance : Pyramide 40 min');
  assert.equal(distance.children.at(-1).textContent,'Voir la séance');
});

test('unknown goals, long untrusted names and empty lists remain safe',()=>{
  const title='<img src=x onerror=alert(1)>';
  const rows=render([{id:'a/b?c',name:title,goalMode:'distance',
    source:'custom',imports:null}]);
  assert.equal(firstClass(rows,'bos-workout-goal').textContent,'DISTANCE');
  assert.equal(firstClass(rows,'bos-workout-name').textContent,title);
  assert.equal(rows.children[0].children.at(-1).href,'/partages.html?id=a%2Fb%3Fc');
  assert.doesNotMatch(page.slice(page.indexOf('  function renderPublicSessions('),
    page.indexOf('  function showPublicDeck(')),/innerHTML|insertAdjacentHTML/);
  const empty=render([]);
  assert.equal(empty.children.length,1);
  assert.match(empty.children[0].textContent,/Aucune séance publiée/);
});


test('real saved phase profile draws proportionate effort bars on public cards',()=>{
  const rows=render([{id:1000000000004,name:'Fractionné 20 min',goalMode:'time',
    source:'spotify',imports:2,profile:[[300,120],[240,170],[360,130]]}]);
  const graph=firstClass(rows,'collection-effort');
  assert.ok(graph,'valid saved phase profile is drawn');
  assert.equal(graph.children.length,3);
  assert.equal(graph.children[0].style.flexGrow,'300');
  assert.equal(graph.children[1].style.flexGrow,'240');
  assert.equal(graph.attributes['aria-label'],'Profil d’effort de cette séance');
  assert.equal(firstClass(rows,'bos-workout-disc'),null,'no redundant musical icon');
  assert.equal(firstClass(rows,'bos-workout-goal').textContent,'DURÉE');
});

test('missing or invalid phase profiles retain safe note icon, never invented bars',()=>{
  const rows=render([{id:12,name:'Sans phases',goalMode:'distance',source:'apple',
    profile:[[0,-40]]},{id:13,name:'Ancienne séance',goalMode:'time',source:'spotify'}]);
  assert.equal(firstClass(rows,'collection-effort'),null);
  assert.equal(firstClass(rows.children[0],'bos-workout-disc').textContent,'♫');
  assert.equal(firstClass(rows.children[1],'bos-workout-disc').textContent,'♫');
});
