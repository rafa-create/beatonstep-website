'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../partages.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const example={
  id:1,kind:'workout',source:'spotify',name:'Course progressive 40 min',
  durationSec:2400,tracks:2,phases:2,imports:3,views:4,
  payload:{v:1,n:'Course progressive 40 min',s:'spotify',
    p:[['Échauffement',600,130,128],['Course',1800,160,157]],
    t:[{p:0,n:'Music A',a:'Artist A',b:128},{p:1,n:'Music B',a:'Artist B',b:157}]},
};
class Node {
  constructor(tag='div') {
    this.tagName=tag;this.children=[];this.attributes={};this.events={};
    this.dataset={};this.open=false;this.hidden=false;this.value='all';
    this._text='';this.className='';this.onclick=null;this.onchange=null;
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=[...nodes];this._text=''}
  setAttribute(name,value){this.attributes[name]=value}
  addEventListener(name,fn){this.events[name]=fn}
}
const walk=(n,predicate)=>[...(predicate(n)?[n]:[]),...n.children.flatMap(c=>walk(c,predicate))];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(search){
  const elements={};
  for(const name of ['fr','en','back','title','intro','notice','catalog','detail','results','pages','source-label','source-filter'])
    elements[name]=new Node(name);
  const kinds=['all','workout','runmix'].map(k=>{
    const n=new Node('button');n.dataset.kind=k;return n;
  });
  const sorts=['recent','popular'].map(k=>{
    const n=new Node('button');n.dataset.sort=k;return n;
  });
  const selectAll=new Node('option');
  const apiCalls=[];
  const document={
    hidden:false,documentElement:{lang:'fr'},
    createElement(tag){return new Node(tag)},
    getElementById(name){return elements[name]},
    querySelectorAll(selector){
      if(selector==='[data-kind]')return kinds;
      if(selector==='[data-sort]')return sorts;
      throw Error('unexpected querySelectorAll '+selector);
    },
    querySelector(selector){
      if(selector==='#source-filter option[value=all]')return selectAll;
      const matched=selector.match(/^\[data-(kind|sort)=(.+)\]$/);
      if(matched)return (matched[1]==='kind'?kinds:sorts).find(x=>x.dataset[matched[1]]===matched[2]);
      throw Error('unexpected querySelector '+selector);
    }
  };
  const fetch=async(url)=>{
    apiCalls.push(url);
    if(url.endsWith('/view'))return {ok:true,json:async()=>({counted:true})};
    if(url.includes('?'))return {ok:true,json:async()=>({total:1,page:1,pageSize:20,
      items:[Object.fromEntries(Object.entries(example).filter(([k])=>k!=='payload'))]})};
    if(url.endsWith('/1'))return {ok:true,json:async()=>example};
    throw Error('unexpected fetch '+url);
  };
  const location={search};
  vm.runInNewContext(script,{document,navigator:{language:'fr-FR'},location,
    URLSearchParams,fetch,console});
  return {elements,kinds,sorts,apiCalls};
}
(async()=>{
  const detail=setup('?id=1');
  await flush();
  assert.equal(detail.elements.detail.hidden,false);
  const node=detail.elements.detail.children[0];
  const toggles=walk(node,x=>x.tagName==='details');
  assert.equal(toggles.length,2);
  assert(toggles.every(x=>!x.open));
  assert(toggles.every(x=>x.children[1].children.length===0));
  toggles[0].open=true;
  toggles[0].events.toggle();
  await flush();
  assert.match(toggles[0].textContent,/Échauffement/);
  assert.match(toggles[0].textContent,/128 BPM/);
  assert(toggles[1].children[1].children.length===0,'opening phases must not open songs');
  toggles[1].open=true;
  toggles[1].events.toggle();
  await flush();
  assert.match(toggles[1].textContent,/Music A/);
  assert.match(toggles[1].textContent,/Music B/);
  assert(walk(node,x=>x.href==='beatonstep://shared?id=1').length===1);
  const views=detail.apiCalls.filter(url=>url.endsWith('/view')).length;
  assert.equal(views,1);
  detail.elements.en.onclick();
  await flush();
  assert.equal(detail.apiCalls.filter(url=>url.endsWith('/view')).length,1,
    'language change must not increment views');

  const catalog=setup('');
  await flush();
  assert.match(catalog.apiCalls[0],/source=all/);
  const card=catalog.elements.results.children[0];
  const listToggles=walk(card,x=>x.tagName==='details');
  assert.equal(listToggles.length,2);
  assert(listToggles.every(x=>!x.open));
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,0,
    'compact catalog must not fetch detailed items eagerly');
  listToggles[1].open=true;
  listToggles[1].events.toggle();
  await flush();
  assert.match(listToggles[1].textContent,/Music A/);
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,1,
    'opening an accordion fetches detail on demand');
  listToggles[0].open=true;
  listToggles[0].events.toggle();
  await flush();
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,1,
    'opening another accordion reuses cached detail');
  catalog.elements['source-filter'].value='spotify';
  catalog.elements['source-filter'].onchange();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/source=spotify/);
  catalog.kinds[2].onclick();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/kind=runmix&source=spotify/);
  assert(catalog.elements.results.children.length>0);
  console.log('Public sharing interactions: compact card, independent lazy accordions, FR/EN, source+kind filters OK');
})().catch(error=>{console.error(error);process.exitCode=1});
