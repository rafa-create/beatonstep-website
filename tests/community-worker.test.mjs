import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';

const ROOT='https://beatonstep.app';
const example={kind:'runmix',payload:{
  v:1,i:'abcdefabcdefabcd',s:'spotify',n:'Run',t:[['A song']],
}};
function mockDb({publisher=false}={}) {
  const queries=[],batched=[];
  const db={
    prepare(sql) {
      const statement=(args=[])=>({
        sql,args,
        bind(...values){return statement(values)},
        async first(){
          queries.push({sql,args,kind:'first'});
          if(sql.startsWith('INSERT INTO publish_quotas'))return {uses:1};
          if(sql.startsWith('SELECT id FROM community_users'))return {id:'u1'};
          if(sql.includes('FROM community_devices s'))return publisher
            ? {id:'u1',email:'test@example.test',handle:'runner'}:null;
          return null;
        },
        async run(){
          queries.push({sql,args,kind:'run'});
          if(sql.startsWith('INSERT INTO shared_items'))return {meta:{last_row_id:9}};
          return {meta:{changes:1}};
        },
        async all(){return {results:[]}},
      });
      return statement();
    },
    async batch(statements) {
      batched.push(statements);
      assert.equal(statements.length,2);
      assert.match(statements[0].sql,/INSERT INTO shared_items/);
      assert.match(statements[1].sql,/INSERT INTO signed_shares/);
      assert.deepEqual(statements[1].args,['u1']);
      return [{meta:{last_row_id:9}},{meta:{changes:1}}];
    },
  };
  return {db,queries,batched};
}
function request(token) {
  return new Request(ROOT+'/api/shared',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'cf-connecting-ip':'192.0.2.42',
      ...(token?{authorization:'Bearer '+token}:{}),
    },
    body:JSON.stringify(example),
  });
}
function env(db) {return {DB:db,CATALOG_BACKEND:'d1',CATALOG_RATE_SALT:'tests-only',
  ASSETS:{fetch:()=>new Response('STATIC')}}}

test('manual migration is additive, never rewrites existing unsigned cards',()=>{
  const sql=readFileSync('migrations/0003_community_profiles.sql','utf8');
  for(const name of ['community_users','community_sessions','community_auth_limits',
    'community_link_codes','community_devices','signed_shares']) {
    assert.match(sql,new RegExp('CREATE TABLE IF NOT EXISTS '+name));
  }
  assert.doesNotMatch(sql,/ALTER TABLE shared_items|DELETE FROM shared_items|DROP TABLE/);
});

test('existing unsigned publication requires neither account nor new tables',async()=>{
  const {db,batched}=mockDb();
  const response=await worker.fetch(request(),env(db));
  assert.equal(response.status,201);
  assert.equal((await response.json()).id,1_000_000_000_009);
  assert.equal(batched.length,0);
});

test('invalid signed credentials fail closed instead of publishing anonymously',async()=>{
  const {db,queries,batched}=mockDb({publisher:false});
  const response=await worker.fetch(request('a'.repeat(64)),env(db));
  assert.equal(response.status,401);
  assert.equal((await response.json()).error,'account_session_expired');
  assert.equal(batched.length,0);
  assert.ok(!queries.some(({sql})=>sql.startsWith('INSERT INTO shared_items')));
});

test('signed card and ownership are committed in the same D1 batch',async()=>{
  const {db,batched}=mockDb({publisher:true});
  const response=await worker.fetch(request('b'.repeat(64)),env(db));
  assert.equal(response.status,201);
  assert.equal((await response.json()).id,1_000_000_000_009);
  assert.equal(batched.length,1);
});

test('account endpoints stay isolated from the admin login',async()=>{
  const response=await worker.fetch(new Request(ROOT+'/api/account/me'),
    {CATALOG_BACKEND:'legacy',ASSETS:{fetch:()=>new Response('STATIC')}});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'account_unavailable');
});
