import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountRequest} from '../worker/account.js';

const ROOT='https://beatonstep.app';
const token='b'.repeat(64);
function setup({signedIn=true,enabled=true,adminExists=true}={}){
  const queries=[];
  const db={prepare(sql){
    queries.push(sql);
    return {bind(){return this},async first(){
      if(sql==='SELECT id FROM community_users LIMIT 1')return {id:'u1'};
      if(sql.includes('FROM community_sessions s'))return signedIn
        ?{id:'u1',email:'owner@example.test',handle:'runner'}:null;
      if(sql==='SELECT email FROM admin_users WHERE email=? AND disabled=0')
        return adminExists&&enabled?{email:'owner@example.test'}:null;
      throw Error('unexpected SQL: '+sql);
    }};
  }};
  const target=new URL(ROOT+'/api/account/me');
  const req=new Request(target,{headers:signedIn
    ?{cookie:'__Host-bos_community='+token}:{}});
  return {queries,call:()=>accountRequest(req,{DB:db,CATALOG_BACKEND:'d1'},target)};
}
test('admin entry appears only for signed-in users already provisioned in admin_users',async()=>{
  const eligible=setup(),yes=await eligible.call();
  assert.equal(yes.status,200);
  assert.deepEqual(await yes.json(),{authenticated:true,handle:'runner',adminEligible:true});
  assert(eligible.queries.some(q=>q.includes('FROM admin_users WHERE email=? AND disabled=0')));
  const ordinary=await setup({adminExists:false}).call();
  assert.equal((await ordinary.json()).adminEligible,false);
  const disabled=await setup({enabled:false}).call();
  assert.equal((await disabled.json()).adminEligible,false);
  const visitor=setup({signedIn:false});
  assert.deepEqual(await (await visitor.call()).json(),{authenticated:false});
  assert(!visitor.queries.some(q=>q.includes('FROM admin_users')));
});
test('community login never creates or converts an admin session',()=>{
  const code=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../compte.html',import.meta.url),'utf8');
  assert.match(html,/id="admin-entry"[^>]*href="\/admin.html" hidden/);
  assert.match(html,/\$\('admin-entry'\)\.hidden=me.adminEligible!==true/);
  assert.match(html,/\$\('admin-entry'\)\.hidden=true/);
  assert.match(code,/adminEligible=Boolean\(match\)/);
  assert.doesNotMatch(code,/INSERT INTO admin_sessions|UPDATE admin_users SET disabled=0/);
});
