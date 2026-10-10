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
    t:[{p:0,n:'Music A',a:'Artist A',b:128,i:'1Hv1VTm8zeOeybub15mA2R'},
      {p:1,n:'Music B',a:'Artist B',b:157,i:'7sNhXWrg9eW3qRqeuePaIC'}]},
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
function setup(search,data=example){
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
      items:[Object.fromEntries(Object.entries(data).filter(([k])=>k!=='payload'))]})};
    if(url.endsWith('/'+data.id))return {ok:true,json:async()=>data};
    throw Error('unexpected fetch '+url);
  };
  const location={search};
  vm.runInNewContext(script,{document,navigator:{language:'fr-FR'},location,
    URLSearchParams,fetch,console});
  return {elements,kinds,sorts,apiCalls};
}
(async()=>{
  // Individual workout: one collapsed workout, then independently expandable
  // phase branches; only the songs from the selected phase become visible.
  const detail=setup('?id=1');
  await flush();
  assert.equal(detail.elements.detail.hidden,false);
  const card=detail.elements.detail.children[0];
  const roots=walk(card,x=>x.tagName==='details');
  assert.equal(roots.length,1,'individual workout starts with only one root');
  assert(!roots[0].open);
  assert.equal(walk(card,x=>x.className==='track').length,0);
  assert(walk(card,x=>x.href==='beatonstep://shared?id=1').length===1,
    'import button stays visible while tree is collapsed');
  roots[0].open=true;
  roots[0].events.toggle();
  await flush();
  const phaseBranches=walk(card,x=>x.tagName==='details'&&x.className==='phase-branch');
  assert.equal(phaseBranches.length,2);
  assert(phaseBranches.every(x=>!x.open),'phases initially collapsed');
  assert.equal(walk(card,x=>x.className==='track').length,0);
  assert.match(phaseBranches[0].textContent,/Échauffement/);
  assert.match(phaseBranches[0].textContent,/128/);
  assert.match(phaseBranches[1].textContent,/Course/);
  phaseBranches[0].open=true;
  phaseBranches[0].events.toggle();
  await flush();
  assert.match(phaseBranches[0].textContent,/Music A/);
  assert.doesNotMatch(phaseBranches[0].textContent,/Music B/);
  assert.equal(walk(card,x=>x.className==='track').length,1);
  const spotify=walk(phaseBranches[0],x=>x.tagName==='a'&&x.className==='track-play');
  assert.equal(spotify.length,1);
  assert.equal(spotify[0].href,'https://open.spotify.com/track/1Hv1VTm8zeOeybub15mA2R');
  assert.equal(spotify[0].target,'_blank');
  assert.equal(spotify[0].rel,'noopener noreferrer');
  phaseBranches[1].open=true;
  phaseBranches[1].events.toggle();
  await flush();
  assert.match(phaseBranches[1].textContent,/Music B/);
  assert.equal(walk(card,x=>x.className==='track').length,2);
  assert.equal(detail.apiCalls.filter(url=>url.endsWith('/1')).length,1,
    'individual workout uses one initial detail fetch');
  assert.equal(detail.apiCalls.filter(url=>url.endsWith('/view')).length,1);
  detail.elements.en.onclick();
  await flush();
  assert.equal(detail.apiCalls.filter(url=>url.endsWith('/view')).length,1,
    'changing language must not increment views');

  // The catalog only fetches compact records until the workout itself expands.
  const catalog=setup('');
  await flush();
  assert.match(catalog.apiCalls[0],/source=all/);
  const catalogCard=catalog.elements.results.children[0];
  const catalogRoot=walk(catalogCard,x=>x.tagName==='details');
  assert.equal(catalogRoot.length,1);
  assert(!catalogRoot[0].open);
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,0);
  catalogRoot[0].open=true;
  catalogRoot[0].events.toggle();
  await flush();
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,1,
    'first opening retrieves full details lazily');
  const catalogPhases=walk(catalogCard,x=>x.tagName==='details'&&x.className==='phase-branch');
  assert.equal(catalogPhases.length,2);
  assert(catalogPhases.every(x=>!x.open));
  catalogPhases[1].open=true;
  catalogPhases[1].events.toggle();
  await flush();
  assert.match(catalogPhases[1].textContent,/Music B/);
  assert.doesNotMatch(catalogPhases[1].textContent,/Music A/);
  catalogRoot[0].open=false;
  catalogRoot[0].events.toggle();
  catalogRoot[0].open=true;
  catalogRoot[0].events.toggle();
  await flush();
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,1,
    'reopening does not refetch details');
  assert(walk(catalogCard,x=>x.href==='partages.html?id=1').length===1,
    'catalog entry retains navigation to its own detail page');
  catalog.elements['source-filter'].value='spotify';
  catalog.elements['source-filter'].onchange();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/source=spotify/);
  catalog.kinds[2].onclick();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/kind=runmix&source=spotify/);

  // Run Mix uses two levels only: playlist -> tracks, and direct YouTube links.
  const youtube={
    id:2,kind:'runmix',source:'youtube',name:'Run Mix',durationSec:1800,
    tracks:1,phases:0,imports:2,views:1,
    payload:{v:1,n:'Run Mix',s:'youtube',t:[['dQw4w9WgXcQ','Video','Artist','Album',156,220,'','']]},
  };
  const playlist=setup('?id=2',youtube);
  await flush();
  const playlistCard=playlist.elements.detail.children[0];
  const playlistRoot=walk(playlistCard,x=>x.tagName==='details');
  assert.equal(playlistRoot.length,1);
  playlistRoot[0].open=true;
  playlistRoot[0].events.toggle();
  await flush();
  assert.equal(walk(playlistCard,x=>x.className==='phase-branch').length,0);
  const youtubeLink=walk(playlistCard,x=>x.tagName==='a'&&x.className==='track-play')[0];
  assert.equal(youtubeLink.href,'https://music.youtube.com/watch?v=dQw4w9WgXcQ');

  // Apple Music trusts ONLY official music.apple.com links.
  const apple={
    ...example,id:3,source:'apple',payload:{...example.payload,
      t:[{p:0,n:'Album song',a:'Singer',url:'https://music.apple.com/fr/album/song/123?i=456',b:140},
        {p:1,n:'Unsafe link',a:'Singer',url:'javascript:alert(1)',b:150}]},
  };
  const appleView=setup('?id=3',apple);
  await flush();
  const appleRoot=walk(appleView.elements.detail,x=>x.tagName==='details')[0];
  appleRoot.open=true;appleRoot.events.toggle();await flush();
  const applePhases=walk(appleView.elements.detail,x=>x.className==='phase-branch');
  applePhases.forEach(phase=>{phase.open=true;phase.events.toggle()});
  await flush();
  const appleLinks=walk(appleView.elements.detail,x=>x.className==='track-play');
  assert.equal(appleLinks[0].href,'https://music.apple.com/fr/album/song/123?i=456');
  assert.match(appleLinks[1].href,/^https:\/\/music\.apple\.com\/search\?term=/);
  assert(!appleLinks.some(a=>a.href.startsWith('javascript:')));

  // Amazon shares have no stable provider song IDs: use official search,
  // never promise an embedded DRM playback stream.
  const amazon={...example,id:4,source:'amazon'};
  const amazonView=setup('?id=4',amazon);
  await flush();
  const amazonRoot=walk(amazonView.elements.detail,x=>x.tagName==='details')[0];
  amazonRoot.open=true;amazonRoot.events.toggle();await flush();
  const amazonPhase=walk(amazonView.elements.detail,x=>x.className==='phase-branch')[0];
  amazonPhase.open=true;amazonPhase.events.toggle();await flush();
  const amazonLink=walk(amazonView.elements.detail,x=>x.className==='track-play')[0];
  assert.match(amazonLink.href,/^https:\/\/music\.amazon\.com\/search\//);
  assert.match(amazonPhase.textContent,/Recherche/);
  // A Deezer numeric provider ID opens its exact song, not search results.
  const deezer={...youtube,id:5,source:'deezer',payload:{...youtube.payload,s:'deezer',
    t:[['123456789','Track Deezer','Singer','Album',150,200,'','']]}};
  const deezerView=setup('?id=5',deezer);
  await flush();
  const deezerRoot=walk(deezerView.elements.detail,x=>x.tagName==='details')[0];
  deezerRoot.open=true;deezerRoot.events.toggle();await flush();
  const deezerLink=walk(deezerView.elements.detail,x=>x.className==='track-play')[0];
  assert.equal(deezerLink.href,'https://www.deezer.com/track/123456789');
  assert.equal(deezerLink.rel,'noopener noreferrer');
  console.log('Public sharing tree: root -> phases -> provider links, playlists, lazy loading, safe URLs, filters, FR/EN OK');
})().catch(error=>{console.error(error);process.exitCode=1});
