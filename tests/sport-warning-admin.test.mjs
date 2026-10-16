import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {adminRequest} from '../worker/admin.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const URL_ROOT='https://beatonstep.app';
const cookie='__Host-bos_admin='+'b'.repeat(64);

function fixture(){
  const mutations=[],actions=[];
  const state={review:'warning',owner:'runner01',epoch:8};
  const db={
    prepare(sql){
      return {sql,args:[],bind(...args){this.args=args;return this},
        async first(){
          if(sql.startsWith('SELECT u.email FROM admin_sessions'))
            return {email:'same-admin@example.test'};
          throw Error('Unexpected D1 first '+sql);
        },
      };
    },
    async batch(items){
      mutations.push(...items);
      assert.equal(items.length,2,'audit entry and warning clearance are atomic');
      assert.match(items[0].sql,/INSERT INTO sport_card_telemetry_admin_actions/);
      assert.match(items[0].sql,/WHERE card_id=\? AND owner_epoch=\? AND state='warning'/);
      assert.match(items[1].sql,/UPDATE sport_card_telemetry_reviews/);
      assert.doesNotMatch(items.map(x=>x.sql).join('\n'),
        /UPDATE sport_world_cards|DELETE FROM sport_world_cards|DELETE FROM sport_verified_runs/);
      if(state.review!=='warning')return [{meta:{changes:0}},{meta:{changes:0}}];
      state.review='clear';
      actions.push({email:items[0].args[0],cardId:items[0].args[2],
        ownerEpoch:items[0].args[3]});
      return [{meta:{changes:1}},{meta:{changes:1}}];
    },
  };
  const env={DB:db,CATALOG_BACKEND:'d1'};
  const request=(origin=URL_ROOT,loggedIn=true,body={cardId:71,ownerEpoch:8})=>
    new Request(URL_ROOT+'/api/admin/sport/warnings/lift',{
      method:'POST',headers:{origin,'content-type':'application/json',
        ...(loggedIn?{cookie}:{} )},body:JSON.stringify(body),
    });
  const send=(request)=>adminRequest(request,env,new URL(request.url));
  return {state,actions,mutations,request,send};
}

test('admin can lift one warning without cancelling card ownership',async()=>{
  const f=fixture();
  const response=await f.send(f.request());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
    cleared:true,cardId:71,ownerEpoch:8});
  assert.equal(f.state.review,'clear');
  assert.equal(f.state.owner,'runner01');
  assert.equal(f.state.epoch,8);
  assert.deepEqual(f.actions,[{email:'same-admin@example.test',
    cardId:71,ownerEpoch:8}]);
  const repeat=await f.send(f.request());
  assert.equal(repeat.status,409);
  assert.equal(f.actions.length,1,'repeat moderation cannot create a second audit');
});

test('private sport moderation rejects unauthenticated and cross-origin POST',async()=>{
  const f=fixture();
  const forbidden=await f.send(f.request('https://attacker.test'));
  assert.equal(forbidden.status,403);
  const guest=await f.send(f.request(URL_ROOT,false));
  assert.equal(guest.status,401);
  const invalid=await f.send(f.request(URL_ROOT,true,
    {cardId:'71',ownerEpoch:8}));
  assert.equal(invalid.status,400);
  assert.equal(f.actions.length,0);
  assert.equal(f.state.review,'warning');
});
