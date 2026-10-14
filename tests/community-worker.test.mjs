import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

test('mobile account pairing issues a permanent revocable device grant',async()=>{
  const verifier='V'.repeat(43), code='c'.repeat(64);
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  let saved=null, consumed=false;
  const db={
    prepare(sql){
      return {
        args:[],
        bind(...values){this.args=values;return this;},
        async first(){
          if(sql==='SELECT id FROM community_users LIMIT 1')return {id:'user1'};
          if(sql.includes('FROM community_link_codes WHERE code_hash='))
            return {user_id:'user1',challenge};
          if(sql==='SELECT handle FROM community_users WHERE id=?')
            return {handle:'runner'};
          throw Error('Unexpected SQL: '+sql);
        },
        async run(){
          if(sql.startsWith('DELETE FROM community_link_codes')){
            consumed=true;return {meta:{changes:1}};
          }
          if(sql.startsWith('INSERT INTO community_devices')){
            saved=this.args;return {meta:{changes:1}};
          }
          throw Error('Unexpected SQL: '+sql);
        },
      };
    },
  };
  const response=await worker.fetch(new Request(ROOT+'/api/account/exchange',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({code,verifier}),
  }),env(db));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.match(data.token,/^[a-f0-9]{64}$/);
  assert.equal(data.handle,'runner');
  assert.equal(data.expiresAt,Number.MAX_SAFE_INTEGER,
    'older mobile clients already understand a finite expiresAt');
  assert.ok(consumed,'the one-time link is consumed');
  assert.equal(saved?.[1],'user1');
  assert.equal(saved?.[2],Number.MAX_SAFE_INTEGER,
    'D1 must not invalidate the device after 30 days');
});
