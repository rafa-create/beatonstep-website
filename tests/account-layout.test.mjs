import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../compte.html', import.meta.url),'utf8');
const at = marker => html.indexOf(marker);

test('account presents private run history first, then both card decks as collapsible sections',()=>{
  const ownStart=at('<section id="account" hidden>');
  const history=at('id="private-history-fold"');
  const challenges=at('id="challenge-fold"');
  const sessions=at('id="session-fold"');
  const footer=at('id="delete-open"');
  assert.ok(ownStart>=0&&history>ownStart&&challenges>history&&sessions>challenges&&footer>sessions);
  assert.match(html,/<details id="private-history-fold" class="account-fold">/);
  assert.match(html,/<span class="account-fold-title">Historique · Séances<\/span>/);
  assert.match(html,/Archives privées de vos courses, sauvegardées sur votre compte\./);
  assert.match(html,/<details id="challenge-fold" class="account-fold">[\s\S]*?<span class="account-fold-title">Cartes Défis<\/span>/);
  assert.match(html,/<details id="session-fold" class="account-fold">[\s\S]*?<span class="account-fold-title">Cartes Séances<\/span>/);
  assert.doesNotMatch(html,/<details id="(?:private-history-fold|challenge-fold|session-fold)"[^>]*\bopen\b/,
    'all three main sections start collapsed for a compact account overview');
  assert.doesNotMatch(html,/id="deck-navigation"|id="deck-heading"|id="history-deck"/);
});
test('Records entry lives in the signed-in challenge fold, never in the public profile',()=>{
  const ownStart=at('<section id="account" hidden>');
  const ownEnd=at('<section id="public-profile" hidden>');
  const deckStart=at('<details id="challenge-fold"');
  const anchor=at('id="account-records-link"');
  assert.ok(ownStart>=0&&ownEnd>ownStart);
  assert.ok(deckStart>ownStart&&anchor>deckStart&&anchor<ownEnd);
  assert.match(html,/<a id="account-records-link" class="account-records-link" href="\/partages\.html\?kind=challenge&amp;view=records">Voir les records des cartes →<\/a>/);
  assert.doesNotMatch(html.slice(ownEnd),/id="account-records-link"/,
    'visiting a public profile must not show the link');
});
test('each account section can be expanded independently without hiding its contents',()=>{
  assert.match(html,/<details id="private-history-fold" class="account-fold">[\s\S]*?id="history-sessions-items"/);
  assert.match(html,/<details id="challenge-fold" class="account-fold">[\s\S]*?id="challenge-deck-cards"[\s\S]*?id="history-challenges-items"/);
  assert.match(html,/<details id="session-fold" class="account-fold">[\s\S]*?id="session-type-filter"[\s\S]*?id="owned-cards"[\s\S]*?id="saved-workouts-items"/);
});
test('logout remains the final account action, after history and delete options',()=>{
  assert.ok(at('id="account-signout"') > at('id="session-fold"'));
  assert.ok(at('id="account-signout"') > at('id="delete-panel"'));
  assert.ok(at('id="logout"') > at('id="account-signout"'));
});
test('inline account interactions remain syntactically valid',()=>{
  const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source);
  assert.doesNotThrow(()=>new vm.Script(source));
});

test('saved workouts are clearly named without an explanatory paragraph',()=>{
  assert.match(html,/<h2>Mes séances dans l’app<\/h2>/);
  assert.doesNotMatch(html,/Retrouve ces séances dans l’application/);
  assert.doesNotMatch(html,/ne fait pas de toi son créateur/);
  assert.match(html,/\$\('saved-workouts-status'\)\.textContent=visible\.length/);
});
test('authored cards remain accessible after gifting, collapsed by default',()=>{
  assert.match(html,/<details id="my-cards" class="created-cards-fold"><summary>Mes cartes créées · par popularité<\/summary>/);
  assert.doesNotMatch(html,/<details id="my-cards"[^>]*\bopen\b/);
  assert.match(html,/renderCards\(savedCreatedCards,\$\('items'\)\)/);
});
test('opened discovery packs disappear completely from the collection',()=>{
  assert.match(html,/\$\('pack-panel'\)\.hidden=pack\.alreadyOpened===true/);
  assert.match(html,/\.pack-game\[hidden\]\{display:none!important\}/);
  assert.match(html,/packButton\.disabled\|\|\$\('pack-panel'\)\.hidden/);
});

test('musical cards are split by time or distance without mixing sporting trophies',()=>{
  assert.match(html,/id="session-time" type="button"/);
  assert.match(html,/id="session-distance" type="button"/);
  assert.match(html,/cardKindLabel\(item\)/);
  assert.match(html,/renderCollection\(savedOwnedCards\)/);
  assert.match(html,/renderCards\(savedCreatedCards,\$\('items'\)\)/);
  assert.match(html,/card\.ghost&&card\.personallyValidated/,
    'ghost sporting trophies require a prior personal validated achievement');
  assert.match(html,/id="session-type-filter" class="session-type-filter" role="group" aria-label="Type de carte de séance">/);
});

test('owned, gifted and ghost sporting cards open the exact public detail URL',()=>{
  assert.match(html,/faceLink\.href='\/partages\.html\?kind=challenge&sport='\+encodeURIComponent\(card\.id\)/);
  assert.match(html,/faceLink\.append\(face\)/);
  assert.match(html,/for\(const card of ghosts\)addCard\(card,'ghost'\)/);
  assert.match(html,/renderPublicChallenges\(data\.challenges\|\|\[\],data\.ghosts\|\|\[\]\)/);
});

test('minimal profile copy keeps distinct deck titles and actionable controls',()=>{
  assert.match(html,/<h1 id="heading">Mon compte<\/h1><p id="intro" hidden><\/p>/);
  assert.match(html,/<span class="account-fold-title">Cartes Défis<\/span>/);
  assert.doesNotMatch(html,/<h2>Mes défis sportifs<\/h2>/);
  assert.doesNotMatch(html,/<h2>Mes cartes de séances possédées<\/h2>/);
  assert.match(html,/id="account-records-link"/);
  assert.match(html,/id="challenge-deck-cards"/);
  assert.match(html,/id="owned-cards"/);
  assert.match(html,/id="show-public-challenges"/);
  for(const redundant of [
    'Les trophées mondiaux apparaîtront',
    'Les courses sont normales',
    'Une carte unique par séance, à découvrir',
    'Retrouvez vos decks Séances et Défis',
    'Profil public par défaut. Décochez',
    'Séance enregistrée (ne constitue pas une validation sportive)',
  ])assert.ok(!html.includes(redundant),'remove old redundant copy: '+redundant);
  assert.match(html,/label\.textContent='Séance enregistrée';/);
  assert.match(html,/if\(giftCode\)\{\$\('heading'\)\.textContent='Ta carte cadeau t’attend';/);
  assert.match(html,/\$\('intro'\)\.hidden=false;/);
});

test('private-profile opt-in is subtle and at the bottom of the signed-in account',()=>{
  const accountStart=at('<section id="account" hidden>');
  const accountEnd=at('<div id="card-reveal"');
  const footer=at('id="profile-visibility"');
  assert.ok(footer>accountStart&&footer<accountEnd);
  assert.ok(footer>at('id="session-fold"'),'privacy checkbox follows both card decks');
  assert.ok(footer>at('id="delete-panel"'),'privacy checkbox is near the footer');
  assert.ok(footer<at('id="account-signout"'),'logout stays final account action');
  assert.match(html,/id="show-public-challenges" type="checkbox">Rendre mon profil privé/);
  assert.doesNotMatch(html,/id="show-public-challenges" type="checkbox" checked/);
  assert.match(html,/\.profile-visibility\{[^}]*border-top:1px solid var\(--line\)/);
  assert.doesNotMatch(html,/Visibilité de mon profil public/);
});

test('Strava sporting pace is placed under the card time in the compact French format',()=>{
  assert.match(html,/function sportHistoryPace\(seconds\)/);
  assert.match(html,/minutes\+' min '\+remainder/);
  assert.match(html,/pace\+'\/km'/);
  assert.match(html,/li\.append\(title\);[\s\S]*sportHistoryPace\(event\.averagePaceSecPerKm\)[\s\S]*li\.append\(meta\)/);
  assert.doesNotMatch(html,/sportHistoryPace\(event\.averagePaceSecPerKm\)[\s\S]{0,180}historyPace\(/);
});
