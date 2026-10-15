import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../compte.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
const start=script.indexOf('  function historyClock(seconds){');
const end=script.indexOf('  async function refreshHistory(append=false){',start);

class Element {
  constructor(name){
    this.tagName=name;this.children=[];this.attributes={};
    this.className='';this._text='';this.listeners={};
  }
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];this._text='';}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,fn){this.listeners[name]=fn;}
}
function api(){
  assert.ok(start>=0&&end>start,'rendering functions are present');
  const list=new Element('ul');
  const ctx={
    document:{createElement:tag=>new Element(tag)},
    $:name=>{assert.equal(name,'history-sessions-items');return list;},
  };
  const functions=vm.runInNewContext(script.slice(start,end)+
    '\n({historyClock,historyPace,historyDateTime,addHistoryRuns})',ctx);
  return {list,...functions};
}

test('web only: precise time, pace and local clock from existing run summary',()=>{
  const {list,addHistoryRuns}=api();
  const endedAtMs=Date.UTC(2026,9,15,17,47);
  addHistoryRuns([{runId:'run-1',summary:{
    workoutName:'5 km progressif',endedAtMs,durationSeconds:1537,
    distanceMeters:5000,averagePaceSecPerKm:307,stepCount:4210,
  }}]);
  const card=list.children[0];
  assert.equal(card.children[0].textContent,'5 km progressif');
  const meta=card.children[1].textContent;
  assert.match(meta,/5 km · 25:37 · Allure moyenne : 5:07\/km/);
  assert.match(meta,/\d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/);
  assert.doesNotMatch(meta,/pas|steps|4210/);
  assert.equal(card.children[2].attributes['aria-label'].includes('5 km progressif'),true);
  assert.equal(typeof card.children[2].listeners.click,'function',
    'removing a saved run still works');
});

test('clock formatter rolls over minutes and hours without dropping seconds',()=>{
  const {historyClock,historyPace}=api();
  for(const [seconds,value] of [
    [0,'0:00'],[7,'0:07'],[59,'0:59'],[61,'1:01'],
    [1537,'25:37'],[3599,'59:59'],[3600,'1:00:00'],
    [3607,'1:00:07'],[3727,'1:02:07'],[3599.9,'1:00:00'],
  ])assert.equal(historyClock(seconds),value);
  for(const invalid of [null,undefined,-1,Infinity,NaN,'1537'])
    assert.equal(historyClock(invalid),null);
  assert.equal(historyPace(315),'5:15/km');
  assert.equal(historyPace(0),null);
  assert.equal(historyPace(null),null);
});

test('old runs with no pace or timestamp remain readable',()=>{
  const {list,addHistoryRuns}=api();
  addHistoryRuns([{runId:'old',summary:{
    durationSeconds:3604,stepCount:4400,distanceMeters:null,
    averagePaceSecPerKm:null,
  }}]);
  const meta=list.children[0].children[1].textContent;
  assert.equal(meta,'Date inconnue · 1:00:04');
  assert.doesNotMatch(meta,/Allure moyenne|pas|4400/);
});
