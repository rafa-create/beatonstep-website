import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const page=readFileSync(new URL('../seances-programmees.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../site.css',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../partages.html',import.meta.url),'utf8');

test('home workout section makes time and distance goals clear without more technical copy',()=>{
  const start=home.indexOf('id="seances-programmees"');
  const end=home.indexOf('</article>',start);
  assert.ok(start>=0&&end>start);
  const section=home.slice(start,end);
  assert.match(section,/Séances musicales · durée ou distance/);
  assert.match(section,/Ton objectif : un chrono ou des kilomètres/);
  assert.match(section,/Choisis une durée ou une distance/);
  assert.match(section,/Music workouts · time or distance/);
  assert.match(section,/Choose a time or distance goal/);
  assert.match(section,/Découvrir les séances et défis/);
  assert.match(section,/data-keep-lang data-href="seances-programmees\.html"/);
  assert.doesNotMatch(section,/BeatOnStep prépare une playlist selon le BPM cible de chaque étape/);
});

test('special page has two short, distinct catalogue choices with clear game rules',()=>{
  const start=page.indexOf('<div class="workouts-hero">');
  const end=page.indexOf('<section class="workouts-screens"',start);
  assert.ok(start>=0&&end>start);
  const hero=page.slice(start,end);
  assert.match(hero,/Cartes Séances/);
  assert.match(hero,/Cartes Défis/);
  assert.match(hero,/Choose a time or a distance/);
  assert.match(hero,/Choisis une durée ou une distance/);
  assert.match(hero,/D’autres coureurs peuvent tenter de te la voler/);
  assert.match(hero,/Other runners can try to steal it/);
  assert.equal((hero.match(/<article class="workouts-path">/g)||[]).length,2);
  for(const kind of ['workout','challenge']){
    const url='partages.html?kind='+kind;
    assert.equal(hero.split('href="'+url+'"').length-1,2,
      'both language variants point to the '+kind+' catalogue');
    assert.equal(hero.split('data-href="'+url+'"').length-1,2,
      'the site translates the '+kind+' link');
  }
  assert.doesNotMatch(hero,/Explorer le catalogue|Browse the catalogue/,
    'replace the ambiguous single catalogue button');
  assert.ok(hero.indexOf('Cartes Séances')<hero.indexOf('Cartes Défis'));
  assert.match(page,/id="main"/);
  assert.match(page,/workouts-screens/,'existing running screenshots stay in place');
});

test('mobile choices stack and catalogue respects the passed language',()=>{
  assert.match(css,/\.workouts-paths\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css,/@media \(max-width: 600px\)\s*\{[\s\S]*?\.workouts-paths\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(catalog,/\['fr','en'\]\.includes\(params\.get\('lang'\)\)/,
    'a direct French/English link must not revert to the browser language');
});
