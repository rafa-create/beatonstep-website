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
  profile:[[600,130],[1800,160]],
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
    this.classList={
      remove:(...names)=>{this.className=this.className.split(' ').filter(x=>!names.includes(x)).join(' ')},
      add:(name)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),name])].join(' ')},
    };
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=[...nodes];this._text=''}
  setAttribute(name,value){this.attributes[name]=value}
  addEventListener(name,fn){this.events[name]=fn}
  querySelector(selector){
    if(selector==='details.share-tree')return walk(this,x=>x.tagName==='details'&&x.className==='share-tree')[0];
    if(selector.startsWith('.'))return walk(this,x=>x.className.split(' ').includes(selector.slice(1)))[0];
    throw Error('unknown querySelector '+selector);
  }
  focus(){this.focused=true}
  showModal(){this.open=true}
  close(){this.open=false;if(this.events.close)this.events.close()}
  removeAttribute(name){delete this.attributes[name]}
}
const walk=(n,predicate)=>[...(predicate(n)?[n]:[]),...n.children.flatMap(c=>walk(c,predicate))];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(search,data=example){
  const items=Array.isArray(data)?data:[data];
  const elements={};
  for(const name of ['fr','en','back','title','intro','notice','catalog','detail','results','pages',
    'kind-label','kind-filter','sort-label','sort-filter','source-label','source-filter',
    'footer-privacy','footer-privacy-label','community-link'])
    elements[name]=new Node(name);
  elements['sort-filter'].value='recent';
  const options={};
  for(const [id,values] of [
    ['kind-filter',['all','workout','runmix']],
    ['sort-filter',['recent','popular']],
    ['source-filter',['all']],
  ])for(const value of values)options[`#${id} option[value=${value}]`]=new Node('option');
  const body=new Node('body');
  const apiCalls=[];
  const document={
    hidden:false,documentElement:{lang:'fr'},body,
    createElement(tag){return new Node(tag)},
    getElementById(name){return elements[name]},
    querySelector(selector){
      if(options[selector])return options[selector];
      throw Error('unexpected querySelector '+selector);
    }
  };
  const fetch=async(url)=>{
    apiCalls.push(url);
    if(url.endsWith('/view'))return {ok:true,json:async()=>({counted:true})};
    if(url.includes('?'))return {ok:true,json:async()=>({total:items.length,page:1,pageSize:20,
      items:items.map(item=>Object.fromEntries(Object.entries(item).filter(([k])=>k!=='payload')) )})};
    const found=items.find(item=>url.endsWith('/'+item.id));
    if(found)return {ok:true,json:async()=>found};
    throw Error('unexpected fetch '+url);
  };
  const location={search};
  vm.runInNewContext(script,{document,navigator:{language:'fr-FR'},location,
    URLSearchParams,fetch,console});
  return {elements,options,apiCalls,body};
}
(async()=>{
  // Individual workout: one collapsed workout, then independently expandable
  // phase branches; only the songs from the selected phase become visible.
  const detail=setup('?id=1');
  await flush();
  assert.equal(detail.elements.back.href,'partages.html');
  assert.equal(detail.elements.back.textContent,'← Catalogue');
  assert.equal(detail.elements.title.textContent,'Partage BeatOnStep');
  assert.equal(detail.elements.intro.hidden,true);
  assert.equal(detail.elements['footer-privacy-label'].textContent,'Confidentialité');
  assert.equal(detail.elements.detail.hidden,false);
  const card=detail.elements.detail.children[0];
  const roots=walk(card,x=>x.tagName==='details');
  assert.equal(roots.length,1,'individual workout starts with only one root');
  assert(!roots[0].open);
  assert.equal(walk(card,x=>x.className==='track').length,0);
  const detailedSummary=walk(card,x=>x.className==='share-summary')[0];
  assert.match(detailedSummary.textContent,/#0001/,'share ID is visible on its card');
  const d1Id = 1_000_000_000_001;
  const d1Detail = setup('?id=' + d1Id, {...example, id:d1Id});
  await flush();
  const d1Card = d1Detail.elements.detail.children[0];
  const d1Summary = walk(d1Card,x=>x.className==='share-summary')[0];
  assert.match(d1Summary.textContent,/#0001/,'D1 share IDs have short visual card numbers');
  assert.doesNotMatch(d1Summary.textContent,/#1000000000001/,'raw D1 offset is not shown');
  assert(walk(d1Card,x=>x.href==='beatonstep://shared?id='+d1Id).length===1,
    'full D1 ID remains unchanged in the mobile import deep link');
  assert.equal(walk(detailedSummary,x=>x.className==='effort-segment').length,2,
    'the individual card uses its two real effort phases');
  assert.match(detailedSummary.textContent,/Profil d'effort/);
  assert(walk(card,x=>x.href==='beatonstep://shared?id=1').length===1,
    'import button stays visible while tree is collapsed');
  assert.equal(walk(card,x=>x.className==='primary').length,1,
    'the card has exactly one separate import action');
  assert.equal(walk(card,x=>x.className==='primary')[0].textContent,'+Importer',
    'the single compact action is titled Importer');
  assert.equal(walk(card,x=>x.className==='primary')[0].attributes['aria-label'],
    'Importer Course progressive 40 min dans BeatOnStep');
  assert.equal(walk(detailedSummary,x=>x.className==='source-logo')[0].src,
    'assets/music-services/spotify.svg');
  assert.equal(walk(detailedSummary,x=>x.className==='share-source-logo')[0].attributes['aria-label'],
    'Spotify','source icon keeps an accessible provider name');
  assert.equal(walk(detailedSummary,x=>x.className==='stat-imports')[0].textContent,'⇩3');
  assert.equal(walk(detailedSummary,x=>x.className==='stat-imports')[0].attributes['aria-label'],
    '3 importations');
  assert.equal(walk(card,x=>x.className==='notice').length,0,
    'no explanatory paragraph is shown inside each card');
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
  assert.equal(detail.elements.back.href,'partages.html');
  assert.equal(detail.elements.back.textContent,'← Catalog');
  assert.equal(detail.elements.title.textContent,'BeatOnStep share');
  assert.equal(detail.elements['footer-privacy-label'].textContent,'Privacy');
  assert.equal(detail.apiCalls.filter(url=>url.endsWith('/view')).length,1,
    'changing language must not increment views');

  // The catalog only fetches compact records until the workout itself expands.
  const catalog=setup('');
  await flush();
  assert.equal(catalog.elements.back.href,'seances-programmees.html');
  assert.equal(catalog.elements.back.textContent,'← Séances programmées');
  assert.equal(catalog.elements.title.textContent,'Catalogue');
  assert.equal(catalog.elements.intro.textContent,'Séances et playlists de la communauté.');
  assert.equal(catalog.elements.intro.hidden,false);
  assert.equal(catalog.elements['footer-privacy-label'].textContent,'Confidentialité');
  catalog.elements.en.onclick();
  await flush();
  assert.equal(catalog.elements.back.href,'seances-programmees.html');
  assert.equal(catalog.elements.back.textContent,'← Programmed workouts');
  assert.equal(catalog.elements.title.textContent,'Catalog');
  assert.equal(catalog.elements.intro.textContent,'Workouts and playlists from the community.');
  assert.equal(catalog.elements['footer-privacy-label'].textContent,'Privacy');
  assert.equal(catalog.elements['footer-privacy'].attributes['aria-label'],'Privacy');
  assert.match(catalog.apiCalls[0],/source=all&sort=popular/,
    'catalogue initially requests popular ranking');
  assert.equal(catalog.elements['sort-filter'].value,'popular');
  const recentCatalog=setup('?sort=recent');
  await flush();
  assert.match(recentCatalog.apiCalls[0],/sort=recent/,
    'explicit newest ranking still overrides the default');
  const catalogCard=catalog.elements.results.children[0];
  const catalogRoot=walk(catalogCard,x=>x.tagName==='details');
  assert.equal(catalogRoot.length,1);
  assert(!catalogRoot[0].open);
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,0);
  assert.equal(walk(catalogCard,x=>x.className==='effort-segment').length,2,
    'catalog cards immediately show the real profile from compact API metadata');
  assert.equal(walk(catalogCard,x=>x.className==='collection-glyph').length,0);
  catalogRoot[0].open=true;
  catalogRoot[0].events.toggle();
  await flush();
  assert.equal(catalog.apiCalls.filter(url=>url.endsWith('/1')).length,1,
    'first opening retrieves full details lazily');
  const catalogPhases=walk(catalogCard,x=>x.tagName==='details'&&x.className==='phase-branch');
  assert.equal(catalogPhases.length,2);
  assert.equal(walk(catalogCard,x=>x.className==='effort-segment').length,2,
    'the visual changes to real phase targets when details load');
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
  const catalogSummary=walk(catalogCard,x=>x.className==='share-summary')[0];
  assert.match(catalogSummary.textContent,/40 min/);
  assert.match(catalogSummary.textContent,/2 tracks/);
  assert.doesNotMatch(catalogSummary.textContent,/imports|views/);
  assert.equal(walk(catalogCard,x=>x.href==='partages.html?id=1').length,0,
    'no redundant navigation button inside the expanded card');
  assert.equal(walk(catalogCard,x=>x.href==='beatonstep://shared?id=1').length,1,
    'catalog entries can be imported directly without expanding');
  assert.equal(walk(catalogCard,x=>x.className==='primary')[0].textContent,'+Import');
  assert.equal(walk(catalogCard,x=>x.className==='stat-imports')[0].attributes['aria-label'],'3 imports');
  assert.equal(walk(catalogCard,x=>x.className==='source-logo')[0].src,
    'assets/music-services/spotify.svg');
  catalog.elements['source-filter'].value='spotify';
  catalog.elements['source-filter'].onchange();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/source=spotify/);
  catalog.elements['kind-filter'].value='runmix';
  catalog.elements['kind-filter'].onchange();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/kind=runmix&source=spotify/);
  catalog.elements['sort-filter'].value='popular';
  catalog.elements['sort-filter'].onchange();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/kind=runmix&source=spotify&sort=popular/);
  assert.equal(catalog.elements['kind-filter'].value,'runmix');
  assert.equal(catalog.elements['sort-filter'].value,'popular');
  assert.equal(catalog.elements['source-filter'].value,'spotify');
  assert.equal(catalog.options['#kind-filter option[value=workout]'].textContent,'Workouts');
  assert.equal(catalog.options['#sort-filter option[value=recent]'].textContent,'Newest');

  // Catalog summaries open the focus viewer, navigating only matching types.
  const gallery=setup('',[example,{...example,id:9,name:'Other workout'}]);
  await flush();
  const firstSummary=walk(gallery.elements.results.children[0],x=>x.className==='share-summary')[0];
  let prevented=false;
  firstSummary.events.click({preventDefault(){prevented=true}});
  assert(prevented,'focus replaces inline expansion when tapping catalog card');
  const dialog=walk(gallery.body,x=>x.tagName==='dialog')[0];
  assert(dialog.open,'the focused card is presented in a native dialog');
  const stage=walk(dialog,x=>x.className.split(' ').includes('focus-stage'))[0];
  assert.equal(walk(stage,x=>x.className==='card').length,1);
  assert.match(stage.textContent,/Course progressive/);
  const forward=walk(dialog,x=>x.tagName==='button'&&x.textContent==='→')[0];
  const back=walk(dialog,x=>x.tagName==='button'&&x.textContent==='←')[0];
  assert.equal(back.disabled,true);
  assert.equal(forward.disabled,false);
  forward.onclick();
  assert.match(stage.textContent,/Other workout/);
  assert.equal(forward.disabled,true);
  stage.events.touchstart({touches:[{clientX:40,clientY:110}]});
  let cancelledClick=false;
  stage.events.touchend({changedTouches:[{clientX:150,clientY:125}],preventDefault(){cancelledClick=true}});
  assert(cancelledClick,'horizontal swipe changes focused card');
  assert.match(stage.textContent,/Course progressive/);
  assert.equal(back.disabled,true);
  dialog.close();
  assert.equal(dialog.open,false);
  // Run Mix uses two levels only: playlist -> tracks, and direct YouTube links.
  const youtube={
    id:2,kind:'runmix',source:'youtube',name:'Run Mix',durationSec:1800,
    tracks:1,phases:0,imports:2,views:1,
    profile:[[220,156]],
    payload:{v:1,n:'Run Mix',s:'youtube',t:[['dQw4w9WgXcQ','Video','Artist','Album',156,220,'','']]},
  };
  const playlist=setup('?id=2',youtube);
  await flush();
  const playlistCard=playlist.elements.detail.children[0];
  assert.equal(walk(playlistCard,x=>x.className==='primary')[0].textContent,'+Importer');
  assert.equal(walk(playlistCard,x=>x.className==='source-logo')[0].src,
    'assets/music-services/youtube.svg');
  assert.equal(walk(playlistCard,x=>x.className==='stat-imports')[0].textContent,'⇩2');
  assert.equal(walk(playlistCard,x=>x.className==='effort-segment').length,1,
    'Run Mix shows a real BPM segment, not a fictional cadence profile');
  assert.match(walk(playlistCard,x=>x.className==='collection-art-label')[0].textContent,/Profil BPM/);
  const playlistCatalog=setup('',youtube);
  await flush();
  assert.equal(walk(playlistCatalog.elements.results,x=>x.className==='effort-segment').length,1,
    'Run Mix cards render BPM immediately from compact API metadata, without a detail fetch');
  assert.equal(playlistCatalog.apiCalls.filter(url=>url.endsWith('/2')).length,0);
  const unknownBpm=setup('?id=22',{
    ...youtube,id:22,profile:undefined,
    payload:{...youtube.payload,t:[['id','Unknown','Artist','Album',null,180]]},
  });
  await flush();
  assert.equal(walk(unknownBpm.elements.detail,x=>x.className==='effort-segment').length,0,
    'a playlist without any BPM retains the musical note, no invented data');
  assert.match(walk(unknownBpm.elements.detail,
    x=>x.className==='collection-art-label')[0].textContent,/Playlist musicale/);
  const partialBpm=setup('?id=23',{
    ...youtube,id:23,profile:[[200,128],[180,null],[240,160]],
  });
  await flush();
  assert.equal(walk(partialBpm.elements.detail,
    x=>x.className==='effort-segment effort-segment--unknown').length,1,
    'unknown BPM inside an otherwise measurable playlist is drawn as a neutral gap');
  assert.equal(walk(partialBpm.elements.detail,
    x=>x.className==='effort-segment').length,2);
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
  assert.equal(walk(appleView.elements.detail,x=>x.className==='source-logo')[0].src,
    'assets/music-services/apple.svg');
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
  assert.equal(walk(amazonView.elements.detail,x=>x.className==='source-logo')[0].src,
    'assets/music-services/amazon.svg');
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
  assert.equal(walk(deezerView.elements.detail,x=>x.className==='source-logo')[0].src,
    'assets/music-services/deezer.svg');
  const deezerRoot=walk(deezerView.elements.detail,x=>x.tagName==='details')[0];
  deezerRoot.open=true;deezerRoot.events.toggle();await flush();
  const deezerLink=walk(deezerView.elements.detail,x=>x.className==='track-play')[0];
  assert.equal(deezerLink.href,'https://www.deezer.com/track/123456789');
  assert.equal(deezerLink.rel,'noopener noreferrer');
  console.log('Public sharing tree: root -> phases -> provider links, playlists, lazy loading, safe URLs, filters, FR/EN OK');
})().catch(error=>{console.error(error);process.exitCode=1});
