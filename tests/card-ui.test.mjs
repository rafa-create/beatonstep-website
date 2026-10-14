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


test('sport card faces keep seven difficulty finishes and honour marathon at every level',()=>{
  const helper=read('sport-card-face.js');
  const css=read('sport-card-face.css');
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
  for(const [distanceCm,label] of [[40000,'SPRINT'],[500000,'5 KILOMÈTRES'],
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
