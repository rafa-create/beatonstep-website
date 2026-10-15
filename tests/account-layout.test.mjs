import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../compte.html', import.meta.url),'utf8');
const at = marker => html.indexOf(marker);

test('account uses just two category choices above deck and history',()=>{
  assert.ok(at('id="deck-navigation"') >= 0);
  // The challenge collection is intentionally the primary, left-hand choice.
  assert.ok(at('id="deck-challenges"') > at('id="deck-navigation"'));
  assert.ok(at('id="deck-sessions"') > at('id="deck-challenges"'));
  assert.ok(at('id="deck-heading"') > at('id="deck-sessions"'));
  assert.match(html, /id="deck-challenges" aria-pressed="true"/);
  assert.match(html, /id="deck-sessions" aria-pressed="false"/);
  assert.ok(at('id="history-deck"') > at('id="challenge-deck"'));
  assert.doesNotMatch(html, /id="view-decks"|id="view-history"/);
  assert.doesNotMatch(html, /id="history-sessions"|id="history-challenges"/);
});
test('switching category shows matching deck and history together',()=>{
  assert.match(html, /\$\('session-deck'\)\.hidden=!sessions/);
  assert.match(html, /\$\('challenge-deck'\)\.hidden=sessions/);
  assert.match(html, /\$\('history-sessions-panel'\)\.hidden=!sessions/);
  assert.match(html, /\$\('history-challenges-panel'\)\.hidden=sessions/);
  assert.match(html, /\$\('history-heading'\)\.textContent=sessions/);
});
test('logout remains the final account action, after history and delete options',()=>{
  assert.ok(at('id="account-signout"') > at('id="history-deck"'));
  assert.ok(at('id="account-signout"') > at('id="delete-panel"'));
  assert.ok(at('id="logout"') > at('id="account-signout"'));
});
test('inline account interactions remain syntactically valid',()=>{
  const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source);
  assert.doesNotThrow(()=>new vm.Script(source));
});

test('saved workout copy explains author attribution in plain French',()=>{
  assert.match(html,/Retrouve ces séances dans l’application/);
  assert.match(html,/ne fait pas de toi son créateur/);
  assert.doesNotMatch(html,/Les imports ne transfèrent pas la création/);
});

test('musical cards are split by time or distance without mixing sporting trophies',()=>{
  assert.match(html,/id="session-time" type="button"/);
  assert.match(html,/id="session-distance" type="button"/);
  assert.match(html,/cardKindLabel\(item\)/);
  assert.match(html,/renderCollection\(savedOwnedCards\)/);
  assert.match(html,/renderCards\(savedCreatedCards,\$\('items'\)\)/);
  assert.match(html,/card\.ghost&&card\.personallyValidated/,
    'ghost sporting trophies require a prior personal validated achievement');
  assert.match(html,/\$\('session-type-filter'\)\.hidden=!sessions/);
});
