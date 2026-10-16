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


function renameFixture() {
  const token='a'.repeat(64);
  const owner={id:'u1',email:'runner@example.test',handle:'runner'};
  const taken='already_taken';
  const updates=[],lookups=[];
  let writeCount=0;
  const db={
    prepare(sql){
      const statement=(args=[])=>({
        sql,args,
        bind(...values){return statement(values)},
        async first(){
          lookups.push({sql,args});
          if(sql==='SELECT id FROM community_users LIMIT 1')return {id:owner.id};
          if(sql.includes('FROM community_sessions s') ||
             sql.includes('FROM community_devices s'))
            return args[0]===createHash('sha256').update(token).digest('hex')
              ?{...owner}:null;
          if(sql.startsWith('INSERT INTO community_auth_limits'))return {count:1};
          if(sql==='SELECT id,handle FROM community_users WHERE handle=?')
            return args[0]===owner.handle?{id:owner.id,handle:owner.handle}:null;
          if(sql==='SELECT show_challenges FROM community_profile_settings WHERE user_id=?')
            return null; // First-time public profile: challenges are visible by default.
          throw Error('Unexpected first: '+sql);
        },
        async all(){
          if(sql.includes('FROM signed_shares s JOIN shared_items x'))
            return {results:[]};
          if(sql.includes('FROM account_run_records WHERE user_id=?'))
            return {results:[]};
          throw Error('Unexpected all: '+sql);
        },
        async run(){
          if(sql==='UPDATE community_users SET handle=? WHERE id=? AND handle=?'){
            updates.push({sql,args});
            const [next,id,previous]=args;
            if(next===taken)throw Error('UNIQUE constraint failed: community_users.handle');
            if(id!==owner.id||previous!==owner.handle)return {meta:{changes:0}};
            owner.handle=next;
            writeCount++;
            return {meta:{changes:1}};
          }
          throw Error('Unexpected run: '+sql);
        }
      });
      return statement();
    }
  };
  const env={DB:db,CATALOG_BACKEND:'d1',CATALOG_RATE_SALT:'test-only',
    ASSETS:{fetch:()=>new Response('STATIC')}};
  const request=(handle,{origin=ROOT,cookie=token}={})=>new Request(ROOT+'/api/account/handle',{
    method:'POST',
    headers:{origin,'content-type':'application/json',
      ...(cookie?{cookie:'__Host-bos_community='+cookie}:{})},
    body:JSON.stringify({handle}),
  });
  return {owner,env,request,updates,lookups,writeCount:()=>writeCount,token};
}

test('public handle can be changed without touching cards or login grants',async()=>{
  const f=renameFixture();
  const response=await worker.fetch(f.request(' New_Runner '),f.env);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{handle:'new_runner',changed:true});
  assert.equal(f.owner.id,'u1');
  assert.equal(f.owner.handle,'new_runner');
  assert.deepEqual(f.updates[0].args,['new_runner','u1','runner']);
  assert.equal(f.updates.length,1);
  const me=await worker.fetch(new Request(ROOT+'/api/account/me',{
    headers:{cookie:'__Host-bos_community='+f.token},
  }),f.env);
  assert.equal((await me.json()).handle,'new_runner');
  const mobile=await worker.fetch(new Request(ROOT+'/api/account/device/me',{
    headers:{authorization:'Bearer '+f.token},
  }),f.env);
  assert.equal((await mobile.json()).handle,'new_runner',
    'mobile session reads the current handle from the same stable account');
  const profile=await worker.fetch(new Request(ROOT+'/api/account/profile?handle=new_runner'),f.env);
  assert.equal(profile.status,200);
  assert.equal((await profile.json()).handle,'new_runner');
  const oldLink=await worker.fetch(new Request(ROOT+'/api/account/profile?handle=runner'),f.env);
  assert.equal(oldLink.status,404,'an old handle is no longer a valid profile URL');
});

test('pseudo editing requires a valid same-origin logged-in web session',async()=>{
  const f=renameFixture();
  const csrf=await worker.fetch(f.request('change_me',{origin:'https://elsewhere.test'}),f.env);
  assert.equal(csrf.status,403);
  assert.equal((await csrf.json()).error,'origin_forbidden');
  const guest=await worker.fetch(f.request('change_me',{cookie:''}),f.env);
  assert.equal(guest.status,401);
  assert.equal((await guest.json()).error,'login_required');
  for(const invalid of ['ab','spaces not allowed','éclair','admin@site',
    '.leading','_'.repeat(25)]){
    const r=await worker.fetch(f.request(invalid),f.env);
    assert.equal(r.status,400,invalid);
    assert.equal((await r.json()).error,'invalid_handle');
  }
  assert.equal(f.writeCount(),0,'invalid and unauthenticated changes never write');
});

test('same username is harmless and an occupied one returns conflict',async()=>{
  const f=renameFixture();
  const same=await worker.fetch(f.request('Runner'),f.env);
  assert.equal(same.status,200);
  assert.deepEqual(await same.json(),{handle:'runner',changed:false});
  assert.equal(f.writeCount(),0);
  const taken=await worker.fetch(f.request('already_taken'),f.env);
  assert.equal(taken.status,409);
  assert.equal((await taken.json()).error,'handle_taken');
  assert.equal(f.owner.handle,'runner');
  assert.equal(f.writeCount(),0);
});
