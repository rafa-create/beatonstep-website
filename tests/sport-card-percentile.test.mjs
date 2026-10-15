import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../sport-card-percentile.js',import.meta.url),'utf8');
const rules=JSON.parse(readFileSync(new URL('../sport-card-rules.json',import.meta.url),'utf8'));
const face=readFileSync(new URL('../partages.html',import.meta.url),'utf8');
const account=readFileSync(new URL('../compte.html',import.meta.url),'utf8');
const gift=readFileSync(new URL('../cadeau-sport.html',import.meta.url),'utf8');

async function api(data=rules){
  const context={
    fetch:async()=>({ok:true,json:async()=>data}),
  };
  vm.runInNewContext(source,context);
  const client=context.BeatOnStepSportPercentiles;
  await client.ready();
  return client;
}
const card=(distanceCm,subValue,difficulty='beginner')=>({distanceCm,subValue,difficulty});

test('world labels are read from the same v2 JSON as official sporting awards',async()=>{
  const client=await api();
  const checks=[
    [500000,22,'legend',5],
    [500000,29,'expert',20],
    [500000,35,'intermediate',50],
    [500000,42,'regular',75],
    [500000,51,'amateur',90],
    [1000000,63,'intermediate',50],
    [2109750,135,'intermediate',50],
    [4219500,267,'intermediate',50],
  ];
  for(const [distanceCm,subValue,level,percent] of checks){
    const row=card(distanceCm,subValue);
    assert.equal(client.visibleTier(row),level);
    assert.equal(client.percentile(row),percent);
    assert.equal(client.label(row,'fr'),'Top ≈ '+percent+' % mondial');
    assert.equal(client.label(row,'en'),'World top ≈ '+percent+'%');
  }
});

test('percentiles progress for individual SUB thresholds and world record is the floor',async()=>{
  const client=await api();
  for(const [sub,top] of [[20,2],[22,5],[24,9],[25,11],[27,16],[29,20]]){
    assert.equal(client.percentile(card(500000,sub)),top,'5km SUB '+sub);
  }
  for(const [sub,expected] of [
    [13,'À 11 s du record mondial'],
    [14,'À 1 min 11 s du record mondial'],
    [15,'À 2 min 11 s du record mondial'],
    [16,'À 3 min 11 s du record mondial'],
    [17,'À 4 min 11 s du record mondial'],
    [18,'À 5 min 11 s du record mondial'],
    [19,'À 6 min 11 s du record mondial'],
  ]){
    assert.equal(client.percentile(card(500000,sub)),null,
      'no fabricated extreme-tail percentiles for elite SUB '+sub);
    assert.equal(client.label(card(500000,sub),'fr'),expected);
  }
  assert.equal(client.label(card(500000,14),'en'),
    '1 min 11 sec from the world record');
  assert.equal(client.label(card(500000,12),'fr'),'Palier du record mondial');
  assert.equal(client.percentile(card(40000,44)),null);
  assert.equal(client.label(card(40000,44),'fr'),'À 1 s du record mondial');
  assert.equal(client.recordBracket(card(40000,44)),'official');
  assert.equal(client.recordBracket(card(40000,45)),null);
  const distance=400000; // 4km has a modeled reference between 3km and road 5km.
  const world=client.worldRecordReference(distance);
  assert.ok(world&&world.estimated===true&&world.seconds>437.55&&world.seconds<769);
  assert.equal(client.recordGap(card(400000,15))?.estimated,true,
    'an interpolated world reference is explicitly marked as estimated');
  assert.match(client.label(card(400000,15),'fr'),/référence mondiale estimée/);
  assert.equal(client.label({...card(500000,15),performanceWarning:true},'fr'),'Élite mondiale');
  assert.equal(client.worldRecordReference(500000).seconds,769);
  assert.equal(client.worldRecordReference(100000).seconds,131.83,
    'uses the ratified 2026 Wanyonyi record');
  assert.equal(client.worldRecordReference(4219500).seconds,7170,
    'uses the updated 2026 marathon world record');
  assert.equal(client.worldRecordReference(5000000),null,
    'no extrapolation beyond reviewed world-record anchors');
});

test('no invented world rank for beginner, warning or ultra',async()=>{
  const client=await api();
  assert.equal(client.percentile(card(500000,57)),null);
  assert.equal(client.label(card(500000,57),'fr'),'Débutant');
  assert.equal(client.percentile(card(4300000,600,'legend')),null);
  assert.equal(client.label(card(4300000,600,'legend'),'fr'),'Légende longue distance');
  assert.equal(client.percentile({...card(500000,22),performanceWarning:true}),null);
  assert.equal(client.label({...card(500000,22),performanceWarning:true},'fr'),'Légende');
  assert.equal(client.percentile(card(500000,58)),null);
});

test('an older D1 label never invents an outdated world ranking',async()=>{
  const client=await api();
  const old=card(500000,29,'amateur');
  assert.equal(client.tier(old),'expert');
  assert.equal(client.label(old,'fr'),'Top ≈ 20 % mondial');
  assert.equal(client.visibleTier(old),'expert');
});

test('if the official rules fail, UI falls back to tier name without fake percentile',async()=>{
  const client=await api({revision:'legacy',difficultyRuleset:'v1'});
  assert.equal(client.label(card(500000,29,'amateur'),'fr'),'Amateur');
  assert.equal(client.percentile(card(500000,29,'amateur')),null);
});

test('catalogue, account and gift link use one browser helper without text on card face',()=>{
  for(const page of [face,account,gift]){
    assert.match(page,/<script src="\/sport-card-percentile\.js"><\/script>/);
    assert.match(page,/BeatOnStepSportPercentiles\.ready\(\)/);
    assert.match(page,/BeatOnStepSportPercentiles\.visibleTier\(/);
    assert.match(page,/BeatOnStepSportPercentiles\.label\(/);
  }
  assert.doesNotMatch(face,/fr\('Difficulté : ','Difficulty: '\)/);
  assert.doesNotMatch(gift,/textContent='Niveau '/);
  assert.doesNotMatch(account,/BeatOnStepSportCards\.levels\[card\.difficulty\]/);
});
