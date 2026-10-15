'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../partages.html'),'utf8');
const script=fs.readFileSync(path.resolve(__dirname,'../sport-card-face.js'),'utf8')+'\n'+
  fs.readFileSync(path.resolve(__dirname,'../sport-card-percentile.js'),'utf8')+'\n'+
  html.match(/<script>([\s\S]*?)<\/script>/)[1];
const rules=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../sport-card-rules.json'),'utf8'));
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
    'kind-label','kind-filter','session-mode-label','session-mode-filter',
    'session-mode-picker','sort-label','sort-filter','source-label','source-filter',
    'sort-picker','source-picker','distance-picker','distance-label','distance-filter',
    'difficulty-picker','difficulty-label','difficulty-filter','difficulty-hint',
    'distance-exact-picker','distance-exact-label','distance-exact-filter',
    'footer-privacy','footer-privacy-label','community-link',
    'sport-guide-link','sport-guide-label'])
    elements[name]=new Node(name);
  // Mirror the actual accessible profile label inside #community-link.
  const communityLabel=new Node('span');
  communityLabel.className='community-label';
  elements['community-link'].append(communityLabel);
  elements['sort-filter'].value='recent';
  const options={};
  for(const [id,values] of [
    ['kind-filter',['workout','challenge']],
    ['session-mode-filter',['all','time','distance']],
    ['sort-filter',['recent','popular']],
    ['source-filter',['all']],
    ['distance-filter',['all']],
    ['difficulty-filter',['difficulty_asc','difficulty_desc']],
  ])for(const value of values)options[`#${id} option[value=${value}]`]=new Node('option');
  const body=new Node('body');
  const apiCalls=[];
  const document={
    hidden:false,documentElement:{lang:'fr'},body,
    createElement(tag){return new Node(tag)},
    createElementNS(_namespace,tag){return new Node(tag)},
    getElementById(name){return elements[name]},
    querySelector(selector){
      if(options[selector])return options[selector];
      throw Error('unexpected querySelector '+selector);
    }
  };
  const fetch=async(url)=>{
    apiCalls.push(url);
    if(url==='/sport-card-rules.json')
      return {ok:true,json:async()=>rules};
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
  // The landing page now opens verified sporting challenges, without filters.
  const sport={id:17,kind:'challenge',distanceCm:500000,timeUnit:'minute',
    subValue:25,difficulty:'amateur',owner:'runner_b',createdAt:1000,
    firstHolder:'runner_a',longestHolder:'runner_a',longestHeldMs:86400000,
    history:[{reason:'sport_win',at:1000,from:null,to:'runner_a'},
      {reason:'gift_claim',at:2000,from:'runner_a',to:'runner_b'}],
    historyHasMore:false};
  const landing=setup('',sport);
  await flush();
  assert.equal(landing.elements['kind-filter'].value,'challenge');
  assert.equal(landing.elements.intro.hidden,true,
    'challenge catalogue has no redundant introduction');
  assert.equal(landing.elements.intro.textContent,'');
  assert.equal(landing.elements['distance-filter'].value,'all');
  assert.equal(landing.elements['difficulty-filter'].value,'difficulty_desc');
  assert.match(html,/id="distance-exact-filter"[\s\S]*?placeholder="Distance \(km\)"/);
  assert.equal(landing.elements['distance-exact-filter'].placeholder,'Distance (km)');
  assert.equal(landing.elements['distance-exact-filter'].value,'');
  assert.equal(landing.elements['sort-picker'].hidden,true);
  assert.equal(landing.elements['source-picker'].hidden,true);
  assert.equal(landing.elements['distance-exact-picker'].hidden,false);
  assert(landing.apiCalls.some(url=>
    /^\/api\/sport\/cards\?distance=all&sort=difficulty_desc&page=1$/.test(url)));
  assert.equal(landing.elements['difficulty-hint'].textContent,'',
    'the long Top-world paragraph is no longer rendered below the filters');
  assert.match(landing.elements.results.textContent,/Top ≈ 11 % mondial/,
    'SUB 25 has an estimated 11% finisher rank, not the whole expert-tier 20%');
  assert.match(landing.elements.results.textContent,/SUB 25 min/);
  assert.match(landing.elements.results.textContent,/@runner_b/);
  // Challenge cards offer the detail link in the catalogue and focus gallery,
  // but never on the destination page itself (both FR and EN).
  const sportCatalogCard=landing.elements.results.children[0];
  const publicHandles=walk(sportCatalogCard,x=>x.className==='profile-handle');
  assert.equal(publicHandles.length,1,'the challenge holder is linked in the catalogue');
  assert.equal(publicHandles[0].href,'compte.html?profil=runner_b');
  assert.equal(publicHandles[0].textContent,'@runner_b');
  assert.equal(publicHandles[0].attributes['aria-label'],'Voir le profil de @runner_b');
  let linkStops=0;
  publicHandles[0].events.click({stopPropagation(){linkStops++}});
  publicHandles[0].events.keydown({stopPropagation(){linkStops++}});
  assert.equal(linkStops,2,'click and keyboard navigation do not open the parent gallery');
  const catalogDetailLinks=walk(sportCatalogCard,x=>x.tagName==='a'&&x.className==='primary');
  assert.equal(catalogDetailLinks.length,1,'challenge catalogue keeps the detail action');
  assert.equal(catalogDetailLinks[0].href,'partages.html?kind=challenge&sport=17');
  const sportSummary=walk(sportCatalogCard,x=>x.className==='share-summary sport-summary')[0];
  sportSummary.events.click();
  const sportDialog=walk(landing.body,x=>x.tagName==='dialog')[0];
  assert(sportDialog.open,'challenge gallery opens for the selected card');
  const focusedOwner=walk(sportDialog,x=>x.className==='profile-handle');
  assert.equal(focusedOwner.length,1,'the card gallery also has the public holder link');
  assert.equal(focusedOwner[0].href,'compte.html?profil=runner_b');
  const focusedDetailLinks=walk(sportDialog,x=>x.tagName==='a'&&x.className==='primary');
  assert.equal(focusedDetailLinks.length,1,'focused challenge still links to its full page');
  assert.equal(focusedDetailLinks[0].href,'partages.html?kind=challenge&sport=17');
  sportDialog.close();
  const sportDetail=setup('?kind=challenge&sport=17',sport);
  await flush();
  assert.equal(sportDetail.elements.back.href,'partages.html?kind=challenge');
  const sportDetailCard=sportDetail.elements.detail.children[0];
  const detailOwner=walk(sportDetailCard,x=>x.className==='profile-handle');
  assert.equal(detailOwner.length,1);
  assert.equal(detailOwner[0].href,'compte.html?profil=runner_b',
    'the challenge full page links the same current holder');
  assert.equal(walk(sportDetailCard,x=>x.className==='primary').length,0,
    'challenge detail page has no View detail link pointing to itself');
  assert.equal(walk(sportDetailCard,x=>x.className==='sport-details').length,1,
    'holder history remains accessible on the full challenge detail');
  sportDetail.elements.en.onclick();
  await flush();
  assert.equal(walk(sportDetail.elements.detail,x=>x.className==='profile-handle')[0].attributes['aria-label'],
    'View profile of @runner_b','English link is accessible');
  assert.equal(walk(sportDetail.elements.detail,x=>x.className==='primary').length,0,
    'English challenge detail page also has no self-referential link');
  const history=walk(landing.elements.results,x=>x.className==='sport-details')[0];
  assert(history&&!history.open,'history is folded by default');
  // Switching languages keeps the field understandable and leaves the typed value alone.
  const localeDistance=setup('',sport);
  await flush();
  localeDistance.elements.en.onclick();
  await flush();
  assert.equal(localeDistance.elements['distance-exact-filter'].placeholder,'Distance (km)');
  assert.equal(localeDistance.elements['distance-exact-filter'].value,'');
  landing.elements['distance-filter'].value='500000';
  landing.elements['distance-filter'].onchange();
  await flush();
  landing.elements['distance-exact-filter'].value='5';
  landing.elements['distance-exact-filter'].onchange();
  await flush();
  assert.match(landing.apiCalls.at(-1),/distance=500000&sort=difficulty_desc&page=1/);
  landing.elements['difficulty-filter'].value='difficulty_asc';
  landing.elements['difficulty-filter'].onchange();
  await flush();
  assert.match(landing.apiCalls.at(-1),/sort=difficulty_asc&page=1/);
  landing.elements['distance-exact-filter'].value='21,0975';
  landing.elements['distance-exact-filter'].onchange();
  await flush();
  assert.match(landing.apiCalls.at(-1),/distance=2109750&sort=difficulty_asc/);
  const callCount=landing.apiCalls.length;
  landing.elements['distance-exact-filter'].value='4,5';
  landing.elements['distance-exact-filter'].onchange();
  await flush();
  assert.equal(landing.apiCalls.length,callCount,
    'an unsupported distance must never silently run an unfiltered query');
  assert.match(landing.elements.results.textContent,/Distance non reconnue/);
  history.open=true;
  history.events.toggle();
  await flush();
  assert.match(history.textContent,/@runner_a/);
  assert.match(history.textContent,/Donation/);
  const historyHandles=walk(history,x=>x.className==='profile-handle');
  assert.deepEqual(historyHandles.map(x=>x.textContent),
    ['@runner_a','@runner_a','@runner_a','@runner_a','@runner_b'],
    'first owner, longest owner and all gift/win history names link to profiles');
  assert(historyHandles.every(x=>x.href==='compte.html?profil='+x.textContent.slice(1)),
    'each history link targets its own runner');
  assert(!landing.apiCalls.some(url=>url.includes('/api/shared/17')),
    'sport cards must not invoke legacy musical share APIs');

  const musicalOwner=setup('?kind=workout',{...example,owner:'runner_b'});
  await flush();
  const musicOwnerLink=walk(musicalOwner.elements.results,
    x=>x.className==='profile-handle');
  assert.equal(musicOwnerLink.length,1,'workout collection holders also link to profiles');
  assert.equal(musicOwnerLink[0].href,'compte.html?profil=runner_b');
  const reservedCard=setup('',{...sport,owner:null,firstHolder:null,longestHolder:null,history:[]});
  await flush();
  assert.equal(walk(reservedCard.elements.results,
    x=>x.className==='profile-handle').length,0,
    'BeatOnStep reserve is plain text, not a broken profile link');

  // Individual workout: one collapsed workout, then independently expandable
  // phase branches; only the songs from the selected phase become visible.
  const detail=setup('?id=1');
  await flush();
  assert.equal(detail.elements.back.hidden,false,
    'share details expose a back-to-catalog link');
  assert.equal(detail.elements.back.href,'partages.html');
  assert.equal(detail.elements.back.textContent,'← Catalogue');
  assert.equal(detail.elements.title.textContent,'Partage BeatOnStep');
  assert.equal(detail.elements.intro.hidden,true);
  assert.equal(detail.elements['footer-privacy-label'].textContent,'Confidentialité');
  assert.equal(detail.elements['community-link'].querySelector('.community-label').textContent,'Profil');
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
  const group=walk(card,x=>x.className==='workout-phases')[0];
  assert(group,'the phases belong to a distinct visual child of the workout');
  assert.equal(walk(group,x=>x.className==='phase-list').length,1,
    'all phase cards are grouped in one nested list');
  assert.equal(walk(group,x=>x.className==='phase-branch').length,2,
    'the whole timeline belongs to the one parent workout card');
  assert.match(walk(group,x=>x.className==='workout-phases-title')[0].textContent,
    /Phases de la séance/);
  assert.equal(walk(group,x=>x.className==='workout-phases-count')[0].textContent,
    '2 phases');
  assert.equal(walk(group,x=>x.className==='phase-number').map(x=>x.textContent).join(','),
    '1,2','phase numbers convey order without editing controls');
  for(const branch of phaseBranches){
    const meta=walk(branch,x=>x.className==='phase-meta')[0].textContent;
    assert.match(meta,/BPM moy\./,'average musical tempo is shown');
    assert.doesNotMatch(meta,/Cible|Target|PPM/,'target cadence is hidden from the web view');
  }
  assert.equal(walk(group,x=>x.tagName==='button').length,0,
    'the site does not add song or phase editing buttons');
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
  assert.equal(detail.elements['community-link'].querySelector('.community-label').textContent,'Profile');
  assert.equal(detail.elements['community-link'].attributes['aria-label'],'Profile');
  assert.equal(detail.apiCalls.filter(url=>url.endsWith('/view')).length,1,
    'changing language must not increment views');

  // The catalog only fetches compact records until the workout itself expands.
  // The introduction is reserved for music sessions, including after switching modes.
  const switched=setup('?kind=workout');
  await flush();
  switched.elements['kind-filter'].value='challenge';
  switched.elements['kind-filter'].onchange();
  await flush();
  assert.equal(switched.elements.intro.hidden,true);
  assert.equal(switched.elements.intro.textContent,'');
  switched.elements.en.onclick();
  await flush();
  assert.equal(switched.elements.intro.hidden,true);
  assert.equal(switched.elements.intro.textContent,'');
  switched.elements['kind-filter'].value='workout';
  switched.elements['kind-filter'].onchange();
  await flush();
  assert.equal(switched.elements.intro.hidden,false);
  assert.equal(switched.elements.intro.textContent,
    'Discover timed and distance-based musical workouts.');
  const catalog=setup('?kind=workout');
  await flush();
  assert.equal(catalog.elements.back.hidden,true,
    'the catalog does not show a back-to-workouts link');
  assert.equal(catalog.elements.title.textContent,'Catalogue');
  assert.equal(catalog.elements.intro.textContent,'Séances musicales à découvrir, en durée ou en distance.');
  assert.equal(catalog.elements.intro.hidden,false);
  assert.equal(catalog.elements['footer-privacy-label'].textContent,'Confidentialité');
  catalog.elements.en.onclick();
  await flush();
  assert.equal(catalog.elements.back.hidden,true,
    'changing language must not reveal a back link on the catalog');
  assert.equal(catalog.elements.title.textContent,'Catalog');
  assert.equal(catalog.elements.intro.textContent,'Discover timed and distance-based musical workouts.');
  assert.equal(catalog.elements['footer-privacy-label'].textContent,'Privacy');
  assert.equal(catalog.elements['footer-privacy'].attributes['aria-label'],'Privacy');
  assert.match(catalog.apiCalls[0],/source=all&sort=popular/,
    'catalogue initially requests popular ranking');
  assert.equal(catalog.elements['sort-filter'].value,'popular');
  const recentCatalog=setup('?kind=workout&sort=recent');
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
  catalog.elements['session-mode-filter'].value='distance';
  catalog.elements['session-mode-filter'].onchange();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/kind=workout&goalMode=distance&source=spotify/);
  catalog.elements['sort-filter'].value='popular';
  catalog.elements['sort-filter'].onchange();
  await flush();
  assert.match(catalog.apiCalls.at(-1),/goalMode=distance&source=spotify&sort=popular/);
  assert.equal(catalog.elements['kind-filter'].value,'workout');
  assert.equal(catalog.elements['session-mode-filter'].value,'distance');
  assert.equal(catalog.elements['sort-filter'].value,'popular');
  assert.equal(catalog.elements['source-filter'].value,'spotify');
  assert.equal(catalog.options['#kind-filter option[value=workout]'].textContent,'Musical workouts');
  assert.equal(catalog.options['#session-mode-filter option[value=distance]'].textContent,'Distance');
  assert.equal(catalog.options['#sort-filter option[value=recent]'].textContent,'Newest');

  // Distance musical cards display real GPS targets, not estimated minutes.
  const gps={...example,id:8,name:'Endurance musicale 5 km',
    goalMode:'distance',distanceMeters:5000,durationSec:1800,
    profile:[[600,140],[1200,160]],payload:{
      v:1,n:'Endurance musicale 5 km',s:'spotify',g:'distance',
      m:[1000,4000],
      p:[['Échauffement',600,140,140],['Course',1200,160,160]],
      t:example.payload.t,
    }};
  const distanceDetail=setup('?id=8',gps);
  await flush();
  const gpsCard=distanceDetail.elements.detail.children[0];
  assert.match(walk(gpsCard,x=>x.className==='stat-duration')[0].textContent,/5 km/);
  assert.doesNotMatch(walk(gpsCard,x=>x.className==='stat-duration')[0].textContent,/30 min/);
  const gpsTree=walk(gpsCard,x=>x.className==='share-tree')[0];
  gpsTree.open=true;gpsTree.events.toggle();
  await flush();
  const gpsPhases=walk(gpsCard,x=>x.className==='phase-branch');
  assert.equal(gpsPhases.length,2);
  assert.match(gpsPhases[0].textContent,/1 km/);
  assert.match(gpsPhases[1].textContent,/4 km/);

  // Catalog summaries open the focus viewer, navigating only matching types.
  const gallery=setup('?kind=workout',[example,{...example,id:9,name:'Other workout'}]);
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
  const playlistCatalog=setup('?kind=runmix',youtube);
  await flush();
  assert.equal(playlistCatalog.elements['kind-filter'].value,'workout',
    'an obsolete playlist category redirects to the musical workouts category');
  assert.match(playlistCatalog.apiCalls[0],/kind=workout&goalMode=all/,
    'playlist discovery is not queried even from an old bookmarked URL');
  assert.equal(playlistCatalog.apiCalls.filter(url=>url.endsWith('/2')).length,0,
    'historical playlist detail remains separately accessible by direct ID');
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
  assert.equal(walk(playlistCard,x=>x.className==='workout-phases').length,0,
    'read-only nested workout styling must not affect Run Mix playlists');
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
