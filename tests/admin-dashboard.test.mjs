import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {adminRequest} from '../worker/admin.js';

const ROOT='https://beatonstep.app';
const token='a'.repeat(64);
const cookie='__Host-bos_admin='+token;
const hash=createHash('sha256').update(token).digest('hex');
const url=path=>new URL(ROOT+path);
function fixture({authorized=true}={}){
  const queries=[];
  const db={prepare(sql){
    const call={sql,args:[]};queries.push(call);
    return {bind(...args){call.args=args;return this},
      async first(){
        if(sql.startsWith('SELECT u.email FROM admin_sessions'))
          return authorized&&call.args[0]===hash?{email:'owner@example.test'}:null;
        if(sql.includes('(SELECT COUNT(*) FROM shared_items)'))
          return {shares:8,sport_cards:5,ownership_events:13,
            verified_runs:4,accounts:9};
        if(sql==='SELECT COUNT(*) AS total FROM sport_world_cards')
          return {total:2};
        if(sql.includes("FROM sport_card_telemetry_reviews WHERE state='warning'"))
          return {total:2};
        if(sql.includes('SELECT COUNT(*) AS total FROM community_users u'))
          return {total:1};
        throw Error('Unknown admin first: '+sql);
      },
      async all(){
        if(sql.includes('FROM sport_card_telemetry_reviews tr')){
          return {results:[{
            card_id:17,owner_epoch:3,created_at:1792000000000,
            reviewed_at:1792000010000,reason_codes:'["implausible_speed"]',
            distance_cm:500000,time_unit:'minute',sub_value:25,
            athlete_handle:null,earned_at:1792000000000,current_epoch:0,
          }]};
        }
        // Account rows include a correlated sport_world_cards subquery, so
        // match the outer FROM before the nested sport table.
        if(sql.includes('FROM community_users u')){
          return {results:[{handle:'runner',created_at:1792100000000,
            is_public:0,cards:2,runs:8}]};
        }
        if(sql.includes('FROM sport_world_cards c')){
          return {results:[{id:3,distance_cm:500000,time_unit:'minute',
            sub_value:25,owner_epoch:4,owner_handle:null,has_owner:1,holder_count:3}]};
        }
        throw Error('Unknown admin all: '+sql);
      },
    };
  }};
  const env={DB:db,CATALOG_BACKEND:'d1'};
  const send=async(path,withCookie=authorized)=>{
    const target=url(path);
    const request=new Request(target,{headers:withCookie?{cookie}:{}});
    return adminRequest(request,env,target);
  };
  return {db,env,send,queries};
}

test('public browser and community cookie cannot reach privileged overview or sport list',async()=>{
  const f=fixture({authorized:false});
  for(const path of ['/api/admin/overview','/api/admin/sport/cards',
    '/api/admin/sport/warnings','/api/admin/accounts']){
    const r=await f.send(path,false);
    assert.equal(r.status,401);
    assert.deepEqual(await r.json(),{error:'admin_required'});
  }
  assert(f.queries.every(q=>q.sql.startsWith('SELECT u.email FROM admin_sessions')),
    'no D1 contents are read before admin authorization');
});
test('admin-only dashboard reads existing counts and does not mutate D1',async()=>{
  const f=fixture();
  const res=await f.send('/api/admin/overview');
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{
    shares:8,sportCards:5,ownershipEvents:13,verifiedRuns:4,accounts:9});
  assert(f.queries.every(q=>/^SELECT/.test(q.sql)));
});
test('sport card inspection sorts and paginates, hides private owner identity',async()=>{
  const f=fixture();
  const res=await f.send('/api/admin/sport/cards?sort=holders&page=2');
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{page:2,pageSize:25,total:2,
    items:[{id:3,distanceCm:500000,timeUnit:'minute',subValue:25,
      ownerEpoch:4,owner:null,hasOwner:true,holderCount:3}]});
  const query=f.queries.find(q=>q.sql.includes('FROM sport_world_cards c'));
  assert.deepEqual(query.args,[25,25]);
  assert.match(query.sql,/ORDER BY holder_count DESC,c.id ASC/);
  assert.match(query.sql,/COALESCE\(preferences.show_challenges,1\)=1/);
  assert.match(query.sql,/c\.current_owner_id IS NOT NULL THEN 1 ELSE 0 END AS has_owner/);
  assert.match(query.sql,/COUNT\(DISTINCT e.new_owner_id\)/);
});
test('invalid admin sports filters fail without touching sport tables',async()=>{
  const f=fixture();
  for(const path of ['/api/admin/sport/cards?page=-1',
    '/api/admin/sport/cards?sort=evil','/api/admin/sport/cards?sort=holders&leak=1']){
    const r=await f.send(path);
    assert.equal(r.status,400);
  }
  assert(!f.queries.some(q=>q.sql.includes('FROM sport_world_cards c')));
});
test('admin UI has named sections and no award or transfer action',()=>{
  const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  for(const name of ['overview','sessions','sports','warnings','accounts','tools'])
    assert.match(html,new RegExp('id="tab-'+name+'"'));
  assert.match(html,/id="sport-items"/);
  assert.match(html,/id="warning-items"/);
  assert.match(html,/id="account-items"/);
  assert.match(html,/id="admin-stats"/);
  assert.match(html,/\/api\/admin\/sport\/cards\?page=/);
  assert.match(html,/\/api\/shared\?kind=workout&sort=recent&page=/);
  assert.match(html,/confirm\('Réconcilier les séances/);
  assert.doesNotMatch(html,/\/api\/admin\/sport\/award|\/api\/admin\/sport\/transfer/);
});

test('admin account inspection requires a real admin session and hides emails',async()=>{
  const f=fixture();
  const r=await f.send('/api/admin/accounts?page=2&handle=runner');
  assert.equal(r.status,200);
  const body=await r.json();
  assert.deepEqual(body,{page:2,pageSize:25,total:1,
    items:[{handle:'runner',createdAt:1792100000000,
      public:false,cards:2,runs:8}]});
  const response=JSON.stringify(body);
  assert.doesNotMatch(response,/owner@example|password|token|snapshot_json|run_id/);
  const count=f.queries.find(q=>q.sql.includes('SELECT COUNT(*) AS total FROM community_users u'));
  const list=f.queries.find(q=>q.sql.includes('LEFT JOIN community_profile_settings'));
  assert.deepEqual(count.args,['runner*']);
  assert.deepEqual(list.args,['runner*',25,25]);
  assert.match(list.sql,/GLOB \?/);
  assert.match(list.sql,/COALESCE\(settings.show_challenges,1\)/);
  assert.match(list.sql,/COUNT\(\*\) FROM account_run_records/);
});
test('admin account search rejects wildcard injection and unrecognized parameters',async()=>{
  const f=fixture();
  for(const path of ['/api/admin/accounts?handle=%2A',
    '/api/admin/accounts?handle=%3F','/api/admin/accounts?page=0',
    '/api/admin/accounts?page=1&email=somebody']){
    const res=await f.send(path);
    assert.equal(res.status,400);
  }
  assert(!f.queries.some(q=>q.sql.includes('FROM community_users u')));
});

test('flagged performances list ALL warning epochs, without altering card ownership',async()=>{
  const f=fixture();
  const res=await f.send('/api/admin/sport/warnings?page=2');
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{page:2,pageSize:25,total:2,
    items:[{cardId:17,ownerEpoch:3,distanceCm:500000,timeUnit:'minute',
      subValue:25,owner:null,earnedAt:1792000000000,
      reviewedAt:1792000010000,reasons:['implausible_speed'],
      currentEpoch:false}]});
  const query=f.queries.find(x=>x.sql.includes('FROM sport_card_telemetry_reviews tr'));
  assert.ok(query,'warnings are read from the existing epoch-scoped review table');
  assert.match(query.sql,/WHERE tr.state='warning'/);
  assert.match(query.sql,/tr.owner_epoch/);
  assert.match(query.sql,/LEFT JOIN sport_card_ownership_events e/);
  assert.match(query.sql,/COALESCE\(pref.show_challenges,1\)=1/);
  assert.deepEqual(query.args,[25,25]);
  assert(f.queries.every(x=>/^\s*SELECT/.test(x.sql)),'warning moderation remains read-only');
});
test('admin warning filters reject unexpected parameters and invalid pagination',async()=>{
  const f=fixture();
  for(const path of ['/api/admin/sport/warnings?page=0',
    '/api/admin/sport/warnings?user_id=secret',
    '/api/admin/sport/warnings?page=-1']){
    const res=await f.send(path);
    assert.equal(res.status,400);
  }
  assert(!f.queries.some(x=>x.sql.includes('FROM sport_card_telemetry_reviews')));
});
