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
