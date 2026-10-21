import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPublicSportCards} from '../worker/sport-public-catalog.js';
import {sportCardDifficultyFilterSql,sportCardDifficultyOrderSql,
  difficultyForSportCard} from '../worker/sport-card-rules.js';

const canonical=JSON.parse(readFileSync(new URL('../sport-card-rules.json',import.meta.url),'utf8'));
const caps=canonical.capsByDistance['500000'];
const tierRange=tier=>{
  const index=canonical.tierOrder.indexOf(tier);
  const lower=index===0?1:caps[canonical.tierOrder[index-1]]+1;
  return {lower,upper:caps[tier]};
};
const sqlRange=tier=>{
  const {lower,upper}=tierRange(tier);
  return new RegExp(String.raw`c\.sub_value BETWEEN ${lower} AND ${upper}`);
};
const url=path=>new URL('https://beatonstep.app'+path);
const sport={id:17,distance_cm:500000,time_unit:'minute',sub_value:25,
  difficulty:'amateur',created_at:1000,owner_handle:'runner_b',has_owner:1,holder_count:2};

function mockDb(overrides={},historyRows=null){
  const queries=[];
  const db={prepare(sql){
    return {bind(...args){
      const item={sql,args};queries.push(item);
      return {
        async first(){
          if(sql.startsWith('SELECT COUNT(*)'))return {total:1};
          if(sql.includes('WHERE c.id=?'))return {...sport,...overrides};
          if(sql.includes('next.changed_at AS ended_at'))
            return {handle:'runner_a',started_at:1000,ended_at:4000};
          if(sql.includes('WHERE e.card_id=? AND e.reason='))
            return {handle:'runner_a'};
          throw Error('Unexpected first query: '+sql);
        },
        async all(){
          if(sql.includes(' FROM sport_world_cards c')&&sql.includes(' LIMIT 20 OFFSET ?'))
            return {results:[{...sport,...overrides}]};
          if(sql.includes('FROM sport_card_ownership_events e'))
            return {results:historyRows??[
              {reason:'gift_claim',changed_at:4000,
                from_handle:'runner_a',to_handle:'runner_b'},
              {reason:'sport_win',changed_at:1000,
                from_handle:null,to_handle:'runner_a'},
            ]};
          throw Error('Unexpected all query: '+sql);
        },
      };
    }};
  }};
  return {db,queries};
}

test('default view lists only verified world cards without personal identifiers',async()=>{
  const {db,queries}=mockDb();
  const r=await readPublicSportCards(db,url('/api/sport/cards'));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.deepEqual(body.items,[{kind:'challenge',id:17,distanceCm:500000,
    timeUnit:'minute',subValue:25,difficulty:'expert',
    createdAt:1000,holderCount:2,owner:'runner_b',hasOwner:true,
    performanceWarning:false}]);
  assert.equal(body.total,1);
  assert.equal(body.page,1);
  assert(queries.every(q=>q.sql.includes('sport_world_cards')),
    'old publishable v2 shared_items must not enter sport catalogue');
  assert.doesNotMatch(JSON.stringify(body),/user_id|owner_id|email|run_id|gps/i);
});

test('SUB and difficulty filters use JSON-derived ranges before SQL paging',async()=>{
  const {db,queries}=mockDb();
  const r=await readPublicSportCards(db,url(
    '/api/sport/cards?distance=500000&difficulty=expert&sub=25&page=1'));
  assert.equal(r.status,200);
  const q=queries.find(q=>q.sql.includes(' LIMIT 20 OFFSET ?'));
  assert.match(q.sql,/c\.distance_cm=\?/);
  assert.match(q.sql,/c\.distance_cm=500000/);
  assert.match(q.sql,sqlRange('expert'));
  assert.doesNotMatch(q.sql,/c\.difficulty\s*(?:=|BETWEEN)/,
    'the old stored D1 tier is not the source of truth');
  assert.match(q.sql,/c\.sub_value<=\?/);
  assert.match(q.sql,/ORDER BY c\.distance_cm ASC,c\.sub_value DESC/);
  assert.deepEqual(q.args,[500000,25,0]);
  assert.deepEqual((await r.json()).items[0].difficulty,'expert');
});

test('difficulty sorting uses JSON tiers, never D1 labels, before pagination',async()=>{
  for(const direction of ['difficulty_asc','difficulty_desc']){
    const {db,queries}=mockDb();
    const result=await readPublicSportCards(db,url('/api/sport/cards?sort='+direction));
    assert.equal(result.status,200);
    const q=queries.find(item=>item.sql.includes(' LIMIT 20 OFFSET ?'));
    assert.match(q.sql,/ORDER BY CASE WHEN /);
    assert.match(q.sql,/c\.distance_cm=500000/);
  assert.match(q.sql,sqlRange('expert'));
    assert.match(q.sql,new RegExp(direction==='difficulty_desc'
      ?'END DESC,c\\.distance_cm DESC,c\\.sub_value ASC,c\\.id ASC'
      :'END ASC,c\\.distance_cm ASC,c\\.sub_value DESC,c\\.id ASC'));
    assert.doesNotMatch(q.sql,/ORDER BY c\.difficulty/);
    assert.match(q.sql,/c\.distance_cm (?:ASC|DESC),c\.sub_value (?:ASC|DESC)/,
      'time is only compared after distance');
    assert.deepEqual(q.args,[0]);
  }
  assert.equal(difficultyForSportCard(500000,25).difficulty,'expert');
  assert.match(sportCardDifficultyFilterSql('world_elite',500000),
    sqlRange('world_elite'));
  assert.match(sportCardDifficultyFilterSql('legend',500000),
    sqlRange('legend'));
  assert.match(sportCardDifficultyFilterSql('legend',5000000),
    /c\.distance_cm IN \(5000000\)/);
  assert.equal(sportCardDifficultyFilterSql('expert',5000000),'(1=0)',
    'ultra race results do not get a modeled finisher difficulty');
  assert.match(sportCardDifficultyOrderSql('difficulty_desc'),/THEN 6/);
  assert.equal(sportCardDifficultyOrderSql('malicious;DROP TABLE'),null);
});

test('invalid and unscoped filters cannot enumerate arbitrary values',async()=>{
  const {db,queries}=mockDb();
  for(const query of ['?sub=25','?distance=456','?distance=500000&sub=0',
    '?difficulty=madeup','?page=-1','?distance=500000&sub=1.5',
    '?sort=unexpected','?sort=difficulty_asc%3BDROP']){
    const r=await readPublicSportCards(db,url('/api/sport/cards'+query));
    assert.equal(r.status,400,query);
  }
  assert.equal(queries.length,0);
});

test('holder timeline reveals only public pseudonyms, gift/win motives and dates',async()=>{
  const {db,queries}=mockDb();
  const r=await readPublicSportCards(db,url('/api/sport/cards/17'),{now:5000});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.owner,'runner_b');
  assert.equal(body.hasOwner,true);
  assert.equal(body.holderCount,2);
  assert.ok(queries.filter(q=>q.sql.includes('AS holder_count')).every(q=>
    q.sql.includes('COUNT(DISTINCT e.new_owner_id)')),
    'one runner winning twice must count as one distinct holder');
  assert.equal(body.firstHolder,'runner_a');
  assert.equal(body.longestHolder,'runner_a');
  assert.equal(body.longestHeldMs,3000);
  assert.deepEqual(body.history,[{reason:'gift_claim',at:4000,
      from:'runner_a',to:'runner_b'},
    {reason:'sport_win',at:1000,from:null,to:'runner_a'}]);
  assert.equal(body.historyHasMore,false);
  assert(queries.some(q=>q.sql.includes('LIMIT 101')));
  assert.doesNotMatch(JSON.stringify(body),/user_id|current_owner_id|run_id|evidence|email/);
});

test('legacy share identifiers and missing sports cards remain distinct',async()=>{
  const {db}=mockDb();
  const r=await readPublicSportCards(db,url('/api/sport/cards/nope'));
  assert.equal(r.status,404);
});

test('owner epoch separates an old flagged performance from a clean gift',async()=>{
  const warned=mockDb({performance_warning:1});
  const r=await readPublicSportCards(warned.db,url('/api/sport/cards'),{
    telemetryEnabled:true,
  });
  assert.equal((await r.json()).items[0].performanceWarning,true);
  const q=warned.queries.find(x=>x.sql.includes('ORDER BY c.distance_cm'));
  assert.match(q.sql,/tr.owner_epoch=c.owner_epoch/);
  const gifted=mockDb({performance_warning:0,owner_handle:'recipient'});
  const clean=await readPublicSportCards(gifted.db,url('/api/sport/cards/17'),{
    telemetryEnabled:true,
  });
  const newHolder=await clean.json();
  assert.equal(newHolder.owner,'recipient');
  assert.equal(newHolder.performanceWarning,false);
});

test('each historic sporting winner keeps their OWN warning after later transfers',async()=>{
  const rows=[
    {reason:'sport_win',changed_at:7000,
      from_handle:'runner_b',to_handle:'runner_c',
      performance_warning:1,
      warning_reasons:'["implausible_speed","inconsistent_crossings"]'},
    {reason:'gift_claim',changed_at:4000,
      from_handle:'runner_a',to_handle:'runner_b',
      performance_warning:0,warning_reasons:null},
    {reason:'sport_win',changed_at:1000,
      from_handle:null,to_handle:'runner_a',
      performance_warning:1,warning_reasons:null},
  ];
  const {db,queries}=mockDb({owner_handle:'runner_c',performance_warning:1},rows);
  const response=await readPublicSportCards(db,url('/api/sport/cards/17'),{
    now:8000,telemetryEnabled:true,
  });
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.history.length,3);
  assert.deepEqual(body.history[0].warningReasons,
    ['implausible_speed','inconsistent_crossings']);
  assert.equal(body.history[0].performanceWarning,true);
  assert.equal(body.history[1].performanceWarning,undefined,
    'gift must not inherit a sporting review');
  assert.equal(body.history[2].performanceWarning,true,
    'historical warning persists for the first holder');
  assert.deepEqual(body.history[2].warningReasons,[],
    'old warnings without saved motives must not fabricate details');
  const query=queries.find(q=>q.sql.includes('LIMIT 101'));
  assert.match(query.sql,/tr.owner_epoch=e.new_epoch/);
  assert.match(query.sql,/rd.owner_epoch=e.new_epoch/);
  assert.match(query.sql,/e.reason='sport_win'/);
  assert.doesNotMatch(JSON.stringify(body),/latitude|longitude|evidence_digest|user_id/);
});

test('verified sport wins show whole run totals only, with strict SQL linking',async()=>{
  const sample={endedAtMs:1792200000000,durationSeconds:1721,
    distanceMeters:5745,averagePaceSecPerKm:300,
    tracks:[{title:'SECRET'}],runRoute:[[123,456]]};
  const rows=[{reason:'sport_win',changed_at:1792200000100,
    to_handle:'runner_a',public_run_json:JSON.stringify(sample)}];
  const {db,queries}=mockDb({},rows);
  const body=await (await readPublicSportCards(db,url('/api/sport/cards/17'))).json();
  assert.deepEqual(body.history[0].session,{
    at:1792200000000,durationSeconds:1721,
    distanceMeters:5745,averagePaceSecPerKm:300});
  assert.doesNotMatch(JSON.stringify(body),/SECRET|runRoute|snapshot_json|runId/);
  const sql=queries.find(q=>q.sql.includes('ORDER BY e.new_epoch DESC LIMIT 101')).sql;
  assert.match(sql,/verified\.run_id/);
  assert.match(sql,/verified\.verified_at=e\.changed_at/);
  assert.match(sql,/COUNT\(\*\) FROM sport_verified_runs candidate/);
  assert.match(sql,/saved\.ended_at=verified\.completed_at/);
  assert.match(sql,/COALESCE\(consent\.show_challenges,1\)=1/);
  assert.match(sql,/WHERE e\.reason='sport_win' AND COALESCE\(consent\.show_challenges,1\)=1/,
    'consent must be required in WHERE, not only LEFT JOIN');
  assert.match(sql,/COALESCE\(prior_pref\.show_challenges,1\)=1/);
  assert.match(sql,/COALESCE\(recipient_pref\.show_challenges,1\)=1/);
});
test('gifts, invalid or missing saved records do not fabricate sport performances',async()=>{
  const rows=[
    {reason:'sport_win',changed_at:1000,public_run_json:null},
    {reason:'sport_win',changed_at:900,
      public_run_json:JSON.stringify({endedAtMs:2,durationSeconds:-4})},
    {reason:'gift_claim',changed_at:800,
      public_run_json:JSON.stringify({endedAtMs:1792200000000,durationSeconds:10})},
  ];
  const {db}=mockDb({},rows);
  const body=await (await readPublicSportCards(db,url('/api/sport/cards/17'))).json();
  assert.ok(body.history.every(e=>!Object.hasOwn(e,'session')));
});
test('all card-owner identities use the existing explicit opt-in',async()=>{
  const {db,queries}=mockDb();
  await readPublicSportCards(db,url('/api/sport/cards'));
  await readPublicSportCards(db,url('/api/sport/cards/17'));
  const sql=queries.map(q=>q.sql).join('\n');
  assert.match(sql,/COALESCE\(visibility\.show_challenges,1\)=1/);
  assert.match(sql,/COALESCE\(prior_pref\.show_challenges,1\)=1/);
  assert.match(sql,/COALESCE\(recipient_pref\.show_challenges,1\)=1/);
});

test('private owner is distinct from an unowned reserve card',async()=>{
  const {db,queries}=mockDb({owner_handle:null,has_owner:1});
  const list=await (await readPublicSportCards(db,url('/api/sport/cards'))).json();
  const detail=await (await readPublicSportCards(db,url('/api/sport/cards/17'))).json();
  assert.equal(list.items[0].owner,null);
  assert.equal(list.items[0].hasOwner,true);
  assert.equal(detail.owner,null);
  assert.equal(detail.hasOwner,true);
  assert.match(queries.map(q=>q.sql).join('\n'),
    /c\.current_owner_id IS NOT NULL THEN 1 ELSE 0 END AS has_owner/);
  assert.doesNotMatch(JSON.stringify(detail),/current_owner_id|owner_user_id/);
});
test('genuine reserve has no owner',async()=>{
  const {db}=mockDb({owner_handle:null,has_owner:0});
  const data=await (await readPublicSportCards(db,url('/api/sport/cards'))).json();
  assert.equal(data.items[0].owner,null);
  assert.equal(data.items[0].hasOwner,false);
});
