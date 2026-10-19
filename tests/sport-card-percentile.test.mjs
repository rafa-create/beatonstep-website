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
  const context={fetch:async()=>({ok:true,json:async()=>data})};
  vm.runInNewContext(source,context);
  const client=context.BeatOnStepSportPercentiles;
  await client.ready();
  return client;
}
const card=(distanceCm,subValue,difficulty='beginner')=>({distanceCm,subValue,difficulty});

test('revised sporting thresholds expose approximate percentile anchors without claiming measured personal ranks',async()=>{
  const client=await api();
  assert.deepEqual(rules.percentileCalibration.estimatedPercentileTargets,{world_elite:0.5,legend:2,expert:20,intermediate:50,regular:75,amateur:90});
  for(const [distanceCm,subValue,level,label] of [
    [40000,60,'legend','Légende'],
    [80000,160,'legend','Légende'],
    [100000,230,'legend','Légende'],
    [150000,345,'legend','Légende'],
    [160934,370,'legend','Légende'],
    [200000,8,'legend','Légende'],
    [300000,12,'legend','Légende'],
    [400000,17,'legend','Légende'],
    [500000,21,'legend','Légende'],
    [500000,22,'expert','Expert'],
    [1000000,44,'legend','Légende'],
    [2109750,98,'legend','Légende'],
    [4219500,215,'legend','Légende'],
  ]){
    const row=card(distanceCm,subValue);
    assert.equal(client.visibleTier(row),level,String(distanceCm)+' SUB '+subValue);
    assert.equal(client.percentile(row),level==='expert'?6:2);
    assert.equal(client.label(row,'fr'),level==='expert'?'Top ≈ 6 % mondial':'Top ≈ 2 % mondial');
  }
  assert.equal(client.tierTopLabel('expert','fr'),'Top ≈ 20 % des arrivants');
  assert.equal(client.tierTopLabel('legend','en'),'Top ≈ 2% of race finishers');
});

test('official and estimated world-record comparisons remain available',async()=>{
  const client=await api();
  for(const [sub,expected] of [
    [13,'À 11 s du record mondial'],
    [14,'À 1 min 11 s du record mondial'],
    [15,'À 2 min 11 s du record mondial'],
    [16,'À 3 min 11 s du record mondial'],
    [17,'À 4 min 11 s du record mondial'],
    [18,'À 5 min 11 s du record mondial'],
    [19,'À 6 min 11 s du record mondial'],
  ]){
    assert.equal(client.percentile(card(500000,sub)),null);
    assert.equal(client.label(card(500000,sub),'fr'),expected);
  }
  assert.equal(client.label(card(500000,12),'fr'),'Record du monde battu de 49 s minimum');
  assert.equal(client.label(card(500000,12),'en'),'World record beaten by at least 49 sec');
  assert.equal(client.recordGap(card(500000,12))?.leadSeconds,49);
  assert.equal(client.percentile(card(40000,44)),null);
  assert.equal(client.label(card(40000,44),'fr'),'À 1 s du record mondial');
  assert.equal(client.recordBracket(card(40000,44)),'official');
  assert.equal(client.recordBracket(card(40000,45)),null);
  const world=client.worldRecordReference(400000);
  assert.ok(world&&world.estimated===true&&world.seconds>437.55&&world.seconds<769);
  assert.equal(client.recordGap(card(400000,11))?.estimated,true);
  assert.match(client.label(card(400000,11),'fr'),/référence mondiale estimée/);
  assert.equal(client.worldRecordReference(500000).seconds,769);
  assert.equal(client.worldRecordReference(100000).seconds,131.83);
  assert.equal(client.worldRecordReference(4219500).seconds,7170);
  assert.equal(client.worldRecordReference(5000000),null);
});

test('legacy units, warnings and ultra cards remain conservative',async()=>{
  const client=await api();
  const oldRegular={...card(100000,8),timeUnit:'minute',difficulty:'regular'};
  assert.equal(client.tier(oldRegular),'regular');
  assert.equal(client.visibleTier(oldRegular),'regular');
  assert.equal(client.percentile(oldRegular),null);
  assert.equal(client.label(oldRegular,'fr'),'Régulier');
  assert.equal(client.recordGap(oldRegular),null);

  const oldElite={...card(100000,3),timeUnit:'minute',difficulty:'world_elite'};
  assert.equal(client.tier(oldElite),'world_elite');
  assert.equal(client.recordGap(oldElite)?.leadSeconds,0);
  assert.equal(client.recordGap(oldElite)?.seconds,48);
  assert.equal(client.label(oldElite,'fr'),'À 48 s du record mondial');

  const newSecond={...card(100000,150),timeUnit:'second'};
  assert.equal(client.tier(newSecond),'world_elite');
  assert.equal(client.label(newSecond,'fr'),'À 18 s du record mondial');

  assert.equal(client.percentile(card(4300000,600,'legend')),null);
  assert.equal(client.label(card(4300000,600,'legend'),'fr'),'Légende longue distance');
  assert.equal(client.percentile({...card(500000,19),performanceWarning:true}),null);
  assert.equal(client.label({...card(500000,19),performanceWarning:true},'fr'),'Élite mondiale');
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

test('a ruleset mismatch falls back to tier name without inventing percentile',async()=>{
  const client=await api({revision:'legacy',difficultyRuleset:'v1'});
  assert.equal(client.label(card(500000,29,'amateur'),'fr'),'Amateur');
  assert.equal(client.percentile(card(500000,29,'amateur')),null);
});
