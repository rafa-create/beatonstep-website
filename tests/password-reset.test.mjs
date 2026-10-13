import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountRequest} from '../worker/account.js';

const ORIGIN='https://beatonstep.app';
const resetRequest=(route,body)=>new Request(ORIGIN+'/api/account/password-reset/'+route,{
  method:'POST',headers:{origin:ORIGIN,'content-type':'application/json',
    'cf-connecting-ip':'192.0.2.44'},
  body:JSON.stringify(body),
});

function fixture({known=true,expired=false,configured=true}={}){
  const user={id:'u1',email:'runner@example.test'};
  const tokens=new Map();
  const recorded={writes:[],batch:[],mail:[],queries:[],revoked:false};
  const DB={
    prepare(sql){
      const q=(args=[])=>({
        sql,args,bind(...v){return q(v)},
        async first(){
          recorded.queries.push({sql,args});
          if(sql.startsWith('SELECT id FROM community_users LIMIT'))return {id:'u1'};
          if(sql.startsWith('INSERT INTO community_auth_limits'))return {count:1};
          if(sql.startsWith('SELECT id FROM community_users WHERE email'))return known?{id:user.id}:null;
          if(sql.startsWith('SELECT user_id FROM community_password_reset_tokens')){
            const [digest,now]=args;
            const found=tokens.get(user.id);
            if(!found||found.token_hash!==digest||found.expires_at<=now)return null;
            return {user_id:user.id};
          }
          throw Error('Unexpected first: '+sql);
        },
        async run(){
          recorded.writes.push({sql,args});
          if(sql.startsWith('INSERT INTO community_password_reset_tokens')){
            const [id,token_hash,created_at,expires_at]=args;
            tokens.set(id,{token_hash,expires_at:expired?0:expires_at});
            return {meta:{changes:1}};
          }
          if(sql.startsWith('DELETE FROM community_password_reset_tokens')){
            if(tokens.get(user.id)?.token_hash===args[0])tokens.delete(user.id);
            return {meta:{changes:1}};
          }
          throw Error('Unexpected run: '+sql);
        },
      });
      return q();
    },
    async batch(queries){
      recorded.batch.push(...queries);
      assert.equal(queries.length,5);
      assert.match(queries[0].sql,/UPDATE community_users SET password_salt=/);
      assert.deepEqual(queries.slice(1,4).map(x=>x.sql.match(/DELETE FROM (\w+)/)?.[1]),
        ['community_sessions','community_devices','community_link_codes']);
      assert.match(queries[4].sql,/DELETE FROM community_password_reset_tokens/);
      // Mimic the D1 one-transaction compare-and-consume guarantee. When
      // the proof is absent, every conditional mutation reports 0 changes.
      const [digest,now]=queries[4].args;
      const token=tokens.get(user.id);
      if(!token||token.token_hash!==digest||token.expires_at<=now)
        return queries.map(()=>({meta:{changes:0}}));
      tokens.delete(user.id);
      recorded.revoked=true;
      return queries.map(()=>({meta:{changes:1}}));
    },
  };
  const env={DB,CATALOG_BACKEND:'d1',CATALOG_RATE_SALT:'test-only',
    ...(configured?{RESEND_API_KEY:'dummy-not-real',
      PASSWORD_RESET_EMAIL_FROM:'BeatOnStep <no-reply@beatonstep.app>'}:{})};
  // The confirmed sender can be a display-name + address, as with Resend.
  if(configured)env.PASSWORD_RESET_EMAIL_FROM='no-reply@beatonstep.app';
  const ctx={waitUntil(promise){recorded.mail.push(promise)}};
  return {DB,env,ctx,recorded,tokens,user};
}
async function dispatch(fixture,route,body){
  const req=resetRequest(route,body);
  return accountRequest(req,fixture.env,new URL(req.url),fixture.ctx);
}
function linkFrom(message){
  const link=/https:\/\/beatonstep\.app\/compte\.html#reset=([a-f0-9]{64})/.exec(message);
  assert.ok(link,'expected secret in e-mail body only');
  return link[1];
}
test('new additive SQL contains reset table but does not touch sessions or card schema',()=>{
  const sql=readFileSync('migrations/0007_community_password_reset.sql','utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS community_password_reset_tokens/);
  assert.match(sql,/ON DELETE CASCADE/);
  assert.doesNotMatch(sql,/DROP TABLE|ALTER TABLE|DELETE FROM community_users|UPDATE workout_cards/);
  const ui=readFileSync('compte.html','utf8');
  assert.match(ui,/id="go-forgot"/);
  assert.match(ui,/id="forgot-form"/);
  assert.match(ui,/id="password-reset-form"/);
  assert.match(ui,/id="reset-new"[^>]+minlength="6"/);
  assert.match(ui,/id="reset-confirm"[^>]+minlength="6"/);
  assert.match(ui,/name="referrer" content="no-referrer"/);
});
test('unconfigured provider is fail-closed and never queries account identity',async()=>{
  const f=fixture({configured:false});
  const r=await dispatch(f,'request',{email:'runner@example.test'});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,'password_reset_unavailable');
  assert.equal(f.recorded.writes.length,0);
  assert.equal(f.recorded.mail.length,0);
  assert.equal(f.recorded.queries.some(x=>x.sql.includes('WHERE email=?')),false);
});
test('unknown and known account get same HTTP status and body',async()=>{
  const old=globalThis.fetch;
  const mails=[];
  globalThis.fetch=async(_url,options)=>{
    mails.push(options);return new Response('{}',{status:200});
  };
  try{
    const known=fixture({known:true}),unknown=fixture({known:false});
    const req={email:'runner@example.test'};
    const a=await dispatch(known,'request',req),b=await dispatch(unknown,'request',req);
    assert.equal(a.status,200);assert.equal(b.status,200);
    assert.deepEqual(await a.json(),await b.json());
    assert.equal(known.recorded.mail.length,1);
    assert.equal(unknown.recorded.mail.length,0);
    await Promise.all(known.recorded.mail);
    assert.equal(mails.length,1);
    const raw=JSON.parse(mails[0].body);
    assert.equal(raw.to[0],'runner@example.test');
    const token=linkFrom(raw.text);
    assert.equal(known.tokens.get('u1').token_hash.length,64);
    assert.notEqual(known.tokens.get('u1').token_hash,token);
    assert.ok(known.tokens.get('u1').expires_at>Date.now()+19*60000);
    assert.equal(raw.text.includes('dummy-not-real'),false);
  }finally{globalThis.fetch=old}
});
test('valid reset invalidates all existing session types and token replay',async()=>{
  const originalFetch=globalThis.fetch;
  let sent=null;
  globalThis.fetch=async(_url,options)=>{
    sent=JSON.parse(options.body).text;return new Response('{}',{status:200});
  };
  try{
    const f=fixture(),r=await dispatch(f,'request',{email:'runner@example.test'});
    assert.equal(r.status,200);await Promise.all(f.recorded.mail);
    const token=linkFrom(sent);
    const newPassword='abc123'; // exactly 6 characters must be accepted
    const first=await dispatch(f,'confirm',{token,password:newPassword});
    assert.equal(first.status,200);assert.deepEqual(await first.json(),{reset:true});
    assert.match(first.headers.get('set-cookie')||'',/Max-Age=0/);
    assert.equal(f.recorded.revoked,true);
    assert.equal(f.recorded.batch.length,5);
    assert.equal(f.recorded.batch[0].args[1].length,64);
    assert.notEqual(f.recorded.batch[0].args[1],newPassword);
    const replay=await dispatch(f,'confirm',{token,password:newPassword});
    assert.equal(replay.status,400);
    assert.equal(f.recorded.batch.length,5);
    assert.equal(f.tokens.size,0);
  }finally{globalThis.fetch=originalFetch}
});
test('invalid CSRF origin and expired token never change a password',async()=>{
  const f=fixture();
  const csrfReq=new Request(ORIGIN+'/api/account/password-reset/request',{
    method:'POST',headers:{origin:'https://evil.example.test','content-type':'application/json'},
    body:JSON.stringify({email:'runner@example.test'}),
  });
  const csrf=await accountRequest(csrfReq,f.env,new URL(csrfReq.url),f.ctx);
  assert.equal(csrf.status,403);
  assert.equal(f.recorded.mail.length,0);
  const old=globalThis.fetch;
  let emailBody='';
  globalThis.fetch=async(_,options)=>{
    emailBody=JSON.parse(options.body).text;
    return new Response('{}',{status:200});
  };
  try{
    const another=fixture({expired:true});
    const r=await dispatch(another,'request',{email:'runner@example.test'});
    assert.equal(r.status,200);await Promise.all(another.recorded.mail);
    const token=linkFrom(emailBody);
    const expired=await dispatch(another,'confirm',{
      token,password:'Long-and-unique-password-2026',
    });
    assert.equal(expired.status,400);
    assert.equal(another.recorded.batch.length,0);
  }finally{globalThis.fetch=old}
});
test('weak password, invalid token and expiration fail without changing credentials',async()=>{
  const f=fixture();
  for(const data of [
    {token:'x'.repeat(64),password:'Strong-and-unique-password'},
    {token:'f'.repeat(64),password:'short'},
    {token:'f'.repeat(64),password:'abcde'}, // 5 chars rejected
    {token:'f'.repeat(62),password:'Strong-and-unique-password'},
  ]){
    const r=await dispatch(f,'confirm',data);
    assert.equal(r.status,400);
  }
  assert.equal(f.recorded.batch.length,0);
});
