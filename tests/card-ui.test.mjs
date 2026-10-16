import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read = name => readFileSync(path.join(root,name),'utf8');

test('account pack is collectible with an animated reveal, not a reserve inventory dashboard',()=>{
  const html=read('compte.html');
  assert.match(html,/class="pack-image"/);
  assert.match(html,/id="card-reveal"/);
  assert.match(html,/reveal-turn/);
  assert.match(html,/showCardReveal\(result.card\)/);
  assert.match(html,/prefers-reduced-motion/);
  assert.doesNotMatch(html,/Réserve : '\+pack\.remaining/);
  assert.doesNotMatch(html,/une nouvelle carte de séance anonyme attend un propriétaire/i);
});
test('account opens challenge deck first, with sessions on the right',()=>{
  const html=read('compte.html');
  const challengeButton=html.indexOf('id="deck-challenges"');
  const sessionButton=html.indexOf('id="deck-sessions"');
  assert.ok(challengeButton>0&&sessionButton>challengeButton,
    'challenge control must be the first option');
  assert.match(html,/id="deck-challenges" aria-pressed="true"/);
  assert.match(html,/id="deck-sessions" aria-pressed="false"/);
  assert.match(html,/let selectedDeck='challenges'/,
    'a signed-in account defaults to its sporting challenges');
  assert.match(html,/id="deck-heading">Mon deck · Défis<\/h2>/,
    'one challenge-deck title remains visible before hydration');
  assert.match(html,/id="challenge-deck">\s*<a id="account-records-link"/,
    'sporting card collection remains accessible beneath that title');
  assert.doesNotMatch(html,/<h2>Mes défis sportifs<\/h2>/,
    'do not reintroduce a redundant challenge heading');
  assert.match(html,/id="session-deck" hidden/,
    'workout cards stay available on the second tab');
  assert.match(html,/id="history-challenges-panel"><p/,
    'sporting history is the initial timeline');
  assert.match(html,/id="history-sessions-panel" hidden/,
    'session history is only visible when its tab is selected');
  assert.match(html,/\$\('deck-sessions'\)\.onclick=\(\)=>\{selectedDeck='sessions';showDecks\(\)\}/,
    'switching back to music must still update deck and history');
});

test('catalogue shows an accessible crown, not the proprietor word, and an icon-only phone profile',()=>{
  const html=read('partages.html');
  assert.match(html,/class="community-icon"/);
  assert.match(html,/class="community-label"/);
  assert.match(html,/setAttribute\('aria-label',fr\('Profil','Profile'\)\)/);
  assert.match(html,/card-owner.*unclaimed/);
  assert.match(html,/Card held by @/);
  assert.doesNotMatch(html,/Propriétaire · /);
  assert.match(html,/collector-arrival/);
});
test('site scripts remain parseable and account device pack has an auth gate',()=>{
  for(const page of ['compte.html','partages.html']){
    const scripts=[...read(page).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length>0);
    for(const [,script] of scripts)new vm.Script(script,{filename:page});
  }
  const account=read('worker/account.js');
  assert.match(account,/devicePublisher\(db,request\)/);
  assert.match(account,/account\/device\/pack\/open/);
  assert.match(account,/account_session_expired/);
  assert.match(account,/return openPack\(db,member.id\)/);
});

test('gift invitation renders a collector card with safe app and web alternatives',()=>{
  const html=read('cadeau.html');
  assert.match(html,/Tu as reçu <em>une carte/);
  assert.match(html,/id="effort-bars"/);
  assert.match(html,/beatonstep:\/\/card-gift\?code=/);
  assert.match(html,/beatonstep:\/\/shared\?id=/);
  assert.match(html,/auto=1/);
  assert.match(html,/compte\.html#gift=/);
  assert.match(html,/api\/account\/gift\/preview/);
  assert.match(html,/name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(html,/name="referrer" content="no-referrer"/);
  assert.match(html,/prefers-reduced-motion:reduce/);
  assert.match(html,/id="gift-retry"/);
  assert.match(html,/Ce lien ne contient pas de code cadeau/);
  assert.match(html,/Ce code cadeau est incorrect/);
  assert.match(html,/vérification est momentanément indisponible/);
  assert.match(html,/\$\('gift-retry'\)\.onclick/);
  assert.doesNotMatch(html,/innerHTML\s*=/);
  for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
    new vm.Script(script,{filename:'cadeau.html'});
  }
});
test('gift creation is owner-authorized; native acceptance requires a valid device grant',()=>{
  const account=read('worker/account.js');
  const pack=read('worker/pack.js');
  assert.match(account,/return createGift\(db,user\.id,data\?\.id\)/);
  assert.match(account,/return createGift\(db,member\.id,data\?\.id\)/);
  assert.match(account,/return claimGift\(db,member\.id,data\?\.code\)/);
  assert.match(account,/devicePublisher\(db,request\)/);
  assert.match(account,/return giftStatus\(db,data\?\.code\)/);
  assert.match(pack,/WHERE share_id=\? AND owner_user_id=\?/);
  assert.match(pack,/expected_owner_id/);
  assert.match(pack,/gift_self_claim/);
  assert.match(pack,/redeemed_at IS NULL/);
  assert.match(pack,/expires_at>\?/);
  assert.match(pack,/beatonstep\.app\/cadeau\.html#gift=/);
  assert.match(pack,/profile:cardProfile\(r\.profile_json\)/);
  assert.match(pack,/COALESCE\(x\.profile_json,json_extract\(x\.payload_json/);
  assert.match(account,/DELETE FROM workout_card_gifts WHERE expected_owner_id=/);
});
test('website allows owners to share their cards and sign-in keeps gift tokens',()=>{
  const html=read('compte.html');
  assert.match(html,/Offrir cette carte/);
  assert.match(html,/\/api\/account\/gift\/create/);
  assert.match(html,/reusableGiftLink\(item\.id\)/);
  assert.match(html,/localStorage\.setItem\(cacheKey/);
  assert.match(html,/navigator\.share\(\{url:sharedUrl\}\)/);
  assert.match(html,/navigator\.clipboard\.writeText\(sharedUrl\)/);
  assert.match(html,/giftCode=new URLSearchParams\(location\.hash\.slice\(1\)\)/);
  assert.match(html,/\/api\/account\/gift\/claim/);
  assert.match(html,/Voir la séance sur le site/);
  assert.match(html,/shared\?id=/);
});

test('sport card details have no inert chevron, while real expanders keep theirs',()=>{
  const html=read('partages.html');
  assert.match(html,/\.share-tree>\.share-summary::after\{content:'';/,
    'only expandable musical sessions display the summary chevron');
  assert.match(html,/\.share-tree>\.share-summary::after\{right:17px\}/,
    'the mobile breakpoint must not reintroduce a sporting chevron');
  assert.doesNotMatch(html,/(?:^|\n)\s*\.share-summary::after\{/,
    'a generic chevron selector would also paint a false control on sporting cards');
  assert.match(html,/\.sport-card \.sport-summary\[role="button"\]\{cursor:pointer/,
    'only a sport card that opens the gallery should advertise a tap target');
  assert.match(html,/const summary=el\('div','share-summary sport-summary'\)/,
    'sport card summary is a normal container, not an expandable details element');
  assert.match(html,/const details=el\('details','sport-details'\)/,
    'the independent holder-history expander must remain available');
  assert.match(html,/details\.addEventListener\('toggle',async\(\)=>\{/,
    'holder history still loads on expansion');
});

test('sport card presentations use mm:ss SUB above a minute without blue mobile tap highlight',()=>{
  const catalog=read('partages.html');
  const sportSub=catalog.match(/  function sportSubLabel[\s\S]*?(?=  function sportName)/)?.[0];
  assert.ok(sportSub,'catalog sport SUB formatter present');
  assert.equal(vm.runInNewContext(sportSub+';sportSubLabel(130,"second")'),'2 min 10 s');
  assert.equal(vm.runInNewContext(sportSub+';sportSubLabel(120,"second")'),'2 min');
  assert.equal(vm.runInNewContext(sportSub+';sportSubLabel(134,"second")'),'2 min 14 s');
  assert.match(catalog,/-webkit-tap-highlight-color:transparent/);
  assert.match(catalog,/\.sport-card \.sport-summary:focus-visible\{outline:2px solid var\(--yellow\)/);
  const account=read('compte.html');
  const accountFn=account.match(/      const displaySportName=[\s\S]*?(?=      const reasons=)/)?.[0];
  assert.ok(accountFn);
  assert.equal(vm.runInNewContext(accountFn+';displaySportName("400 m · SUB 130 s")'),
    '400 m · SUB 2 min 10 s');
  const gift=read('cadeau-sport.html');
  const giftFn=gift.match(/  const displaySportName=[\s\S]*?(?=  const api=)/)?.[0];
  assert.ok(giftFn);
  assert.equal(vm.runInNewContext(giftFn+';displaySportName("400 m · SUB 134 s")'),
    '400 m · SUB 2 min 14 s');
});


test('compiled web skins are derived from the same official seven-level JSON',()=>{
  const manifest=JSON.parse(read('sport-card-rules.json'));
  const css=read('dist/sport-card-face.css');
  const sourceCss=read('sport-card-face.css');
  const sourceJs=read('sport-card-face.js');
  const helper=read('dist/sport-card-face.js');
  assert.deepEqual(Object.keys(manifest.cardVisuals).sort(),
    [...manifest.tierOrder].sort());
  assert.doesNotMatch(sourceCss,/\.sport-skin--\w+\{--sport-accent:/,
    'the source CSS must contain no hand-maintained level colors');
  assert.match(sourceCss,/\/\*__SPORT_CARD_COLORS__\*\//);
  assert.match(sourceJs,/\/\*__SPORT_CARD_LEVELS__\*\//);
  assert.doesNotMatch(helper,/__SPORT_CARD_LEVELS__/,
    'the deployed script must contain compiled levels, not a placeholder');
  const ctx={};
  vm.runInNewContext(helper,ctx);
  for(const [i,tier] of [...manifest.tierOrder].reverse().entries()){
    const {accent,shade,symbol}=manifest.cardVisuals[tier];
    assert.match(accent,/^#[0-9A-F]{6}$/);
    assert.match(shade,/^#[0-9A-F]{6}$/);
    assert.ok(css.includes('.sport-skin--'+tier+
      '{--sport-accent:'+accent+';--sport-shade:'+shade+'}'));
    assert.equal(ctx.BeatOnStepSportCards.levels[tier][2],symbol);
    assert.equal(ctx.BeatOnStepSportCards.levels[tier][3],i+1);
  }
  assert.doesNotMatch(css,/\/\*__SPORT_CARD_COLORS__\*\//);
  assert.doesNotMatch(css,/\.bos-sport-face\.sport-finish--400m\{--sport-accent:/);
  assert.doesNotMatch(css,/\.bos-sport-face\.sport-finish--5k\{--sport-accent:/);
  assert.match(css,/color-mix\(in srgb,var\(--sport-accent\) 23%,transparent\)/);
  assert.match(helper,/item\?\.distanceCm===40000\?' sport-finish--400m'/);
  assert.match(helper,/item\?\.distanceCm===500000\?' sport-finish--5k'/);
  assert.match(helper,/CARTE UNIQUE AU MONDE/);
  assert.doesNotMatch(helper,/1\s*\/\s*1/);
});

test('sport card faces keep seven difficulty finishes and honour marathon at every level',()=>{
  const helper=read('dist/sport-card-face.js');
  const css=read('dist/sport-card-face.css');
  const ctx={};
  vm.runInNewContext(helper,ctx);
  const api=ctx.BeatOnStepSportCards;
  assert.equal(typeof api.createFace,'function');
  for(const difficulty of ['beginner','amateur','regular','intermediate',
    'expert','legend','world_elite']){
    assert.match(css,new RegExp('\\.sport-skin--'+difficulty+'\\{'));
    assert.ok(api.levels[difficulty]);
  }
  const document={
    createElement(tag){return {tag,className:'',textContent:'',children:[],attrs:{},
      setAttribute(k,v){this.attrs[k]=v},
      append(...nodes){this.children.push(...nodes)}}},
  };
  const walk=node=>[node,...node.children.flatMap(walk)];
  assert.match(css,/\.bos-sport-stars\{display:flex/,
    'every card must reserve a consistent seven-star row');
  assert.match(css,/\.bos-sport-stars \.is-filled\{color:var\(--sport-accent\)\}/,
    'earned stars use the existing tier-specific colour');
  assert.match(css,/\.bos-sport-stars \.is-outline\{color:#716e61\}/,
    'unearned stars remain understated and outlined');
  for(const [difficulty,rank] of [
    ['beginner',1],['amateur',2],['regular',3],['intermediate',4],
    ['expert',5],['legend',6],['world_elite',7],
  ]){
    const item=api.createFace(document,{
      title:'5 km · SUB 29 min',distanceCm:500000,difficulty,
    },'fr');
    const stars=walk(item).find(node=>node.className==='bos-sport-stars');
    assert.ok(stars,difficulty+' card must have a star row');
    assert.equal(stars.children.length,7,'the scale has seven slots');
    assert.equal(stars.children.filter(node=>node.className==='is-filled').length,rank,
      difficulty+' must fill exactly '+rank+' stars');
    assert.equal(stars.children.filter(node=>node.className==='is-outline').length,7-rank);
    assert.equal(stars.attrs['aria-hidden'],'true',
      'the parent card supplies the accessible name and star count');
    assert.match(item.attrs['aria-label'],new RegExp(rank+' étoiles sur 7'),
      'assistive technologies get a human-readable progression');
    const footer=walk(item).find(node=>node.className==='bos-sport-foot');
    assert.ok(footer.children.findIndex(node=>node.className==='bos-sport-name') <
      footer.children.findIndex(node=>node.className==='bos-sport-stars'));
    assert.ok(footer.children.findIndex(node=>node.className==='bos-sport-stars') <
      footer.children.findIndex(node=>node.className==='bos-sport-unique'));
    assert.doesNotMatch(walk(item).map(node=>node.textContent).join(' '),/Difficulté : /);
    assert.equal(walk(item).filter(node=>node.className==='bos-sport-unique').length,1);
  }
  const marathon=api.createFace(document,{
    title:'Marathon · SUB 320 min',distanceCm:4219500,difficulty:'beginner',
  },'fr');
  assert.match(marathon.className,/sport-skin--beginner/);
  assert.match(marathon.className,/sport-featured/);
  assert.equal(walk(marathon).find(n=>n.className==='bos-sport-crest').textContent,'42K');
  assert.equal(walk(marathon).find(n=>n.className==='bos-sport-signature').textContent,
    'MARATHON');
  assert.equal(walk(marathon).find(n=>n.className==='bos-sport-unique').textContent,
    'CARTE UNIQUE AU MONDE');
  assert.doesNotMatch(walk(marathon).map(n=>n.textContent).join(' '),/1\s*\/\s*1/);
  const legend=api.createFace(document,{
    title:'Marathon · SUB 180 min',distanceCm:4219500,difficulty:'legend',
  },'fr');
  assert.match(legend.className,/sport-skin--legend/);
  assert.equal(walk(legend).find(n=>n.className==='bos-sport-signature').textContent,
    'MARATHON');
  const elite=api.createFace(document,{
    title:'Marathon · SUB 150 min',distanceCm:4219500,difficulty:'world_elite',
  },'en');
  assert.equal(walk(elite).find(n=>n.className==='bos-sport-unique').textContent,
    'ONE CARD WORLDWIDE');
  for(const [distanceCm,label] of [[40000,'SPRINT'],[80000,'DEMI-FOND'],
    [150000,'DEMI-FOND'],[160934,'LE MILE'],[500000,'5 KILOMÈTRES'],
    [1000000,'10 KILOMÈTRES'],[2109750,'SEMI-MARATHON'],
    [4300000,'ULTRA-DISTANCE']]){
    assert.equal(api.signature(distanceCm)[1],label);
  }
  for(const file of ['partages.html','compte.html','cadeau-sport.html']){
    const html=read(file);
    assert.match(html,/sport-card-face\.css/);
    assert.match(html,/sport-card-face\.js/);
    assert.match(html,/BeatOnStepSportCards\.createFace/);
  }
});

test('all masked sporting owners are described as private, not unavailable',()=>{
  const page=read('partages.html'),admin=read('admin.html');
  assert.match(page,/fallback\|\|fr\('Compte privé','Private account'\)/);
  assert.match(page,/item\.hasOwner===true[\s\S]*?'Compte privé','Private account'/);
  assert.match(page,/profileHandle\(full\.firstHolder\)/);
  assert.match(page,/profileHandle\(full\.longestHolder\)/);
  assert.match(page,/profileHandle\(event\.to\)/);
  assert.doesNotMatch(page,/Compte indisponible|Profil privé ou supprimé/);
  assert.match(page,/Réserve BeatOnStep/,'true reserve label remains');
  assert.match(admin,/card\.hasOwner\?'Compte privé':'Réserve BeatOnStep'/);
  assert.doesNotMatch(admin,/Compte privé ou supprimé/);
});

test('home removes both repeated cadence/BPM explanation lines in French and English',()=>{
  const home=read('index.html');
  const css=read('site.css');
  for(const legend of [
    'Cadence = pas/min · BPM = tempo du titre',
    'Cadence = steps/min · BPM = track tempo',
  ])assert.doesNotMatch(home,new RegExp(legend),
    'remove duplicated educational legend without changing the live controls');
  assert.doesNotMatch(home,/class="beat-legend(?: beat-legend-section)?"/);
  assert.doesNotMatch(css,/\.beat-legend(?:-section)?\s*\{/);
  assert.match(home,/data-mismatch-ppm/,'keep cadence demonstration');
  assert.match(home,/data-pace-run/,'keep interactive running pace display');
  assert.match(home,/Cadence et BPM, c’est quoi \?/,'keep the opt-in FAQ');
});
