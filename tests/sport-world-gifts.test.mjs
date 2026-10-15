import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createSportGift,previewSportGift,claimSportGift} from '../worker/sport-world-gifts.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

function dbMock({gift=null,created=null,preview=null,changes=[1,1,1]}={}){
  const state={queries:[],actions:[],batchCalls:0};
  const db={
    prepare(sql){return {bind(...args){
      state.queries.push({sql,args});
      return {async first(){
        if(sql.includes('INSERT INTO sport_card_gift_links'))return created;
        if(sql.includes('SELECT g.card_id,g.donor_epoch'))return preview;
        if(sql.includes('SELECT g.card_id,g.donor_user_id'))return gift;
        return null;
      }};
    }}},
    async batch(statements){
      state.batchCalls++;
      // Cloudflare D1 batches execute one transaction; for these tests
      // statement result counts are controlled (including a stale link).
      state.actions=state.queries.slice(-3);
      return statements.map((_,index)=>({meta:{changes:changes[index]}}));
    },
  };
  return {db,state};
}
test('sport gift issuance uses the current owner and epoch without TTL',async()=>{
  const {db,state}=dbMock({created:{card_id:42,donor_epoch:3}});
  const response=await createSportGift(db,'runner-a',42);
  assert.equal(response.status,201);
  const payload=await response.json();
  assert.equal(payload.expiresAt,null);
  assert.equal(payload.ownerEpoch,3);
  assert.match(payload.url,/^https:\/\/beatonstep\.app\/cadeau-sport\.html#gift=[a-f0-9]{64}$/);
  assert.match(state.queries[0].sql,/current_owner_id=\?/);
  assert.match(state.queries[0].sql,/owner_epoch>=1/);
  assert.doesNotMatch(state.queries[0].sql,/expires_at|workout_card_gifts/);
  assert.notEqual(state.queries[0].args[0],payload.url.split('gift=')[1],
    'gift must store only the digest, never the bearer token');
});
test('a bearer preview shows only public donor handle, and remains readable after loss',async()=>{
  const {db}=dbMock({preview:{
    card_id:42,distance_cm:500000,time_unit:'minute',sub_value:19,
    difficulty:'expert',donor_epoch:2,owner_epoch:3,
    current_owner_id:'runner-b',donor_user_id:'runner-a',
    donor_handle:'a',created_at:1790000000000,claimed_at:null,
  }});
  const r=await previewSportGift(db,'a'.repeat(64));
  const p=await r.json();
  assert.equal(p.available,false);
  assert.equal(p.reason,'ownership_changed');
  assert.equal(p.card.name,'5 km · SUB 19 min');
  assert.equal(p.donorHandle,'a');
  assert.equal(JSON.stringify(p).includes('runner-b'),false);
  assert.equal(JSON.stringify(p).includes('runner-a'),false);
});
test('gift recipient cannot be donor, and stale ownership never executes a transfer',async()=>{
  const {db,state}=dbMock({gift:{
    card_id:42,donor_epoch:1,donor_user_id:'runner-a',
    current_owner_id:'runner-b',owner_epoch:2,claimed_at:null,
  }});
  const r=await claimSportGift(db,'runner-c','f'.repeat(64));
  assert.equal(r.status,409);
  assert.equal(state.batchCalls,0);
  assert.equal((await r.json()).error,'gift_unavailable');
  const self=await claimSportGift(db,'runner-a','f'.repeat(64));
  assert.equal(self.status,409);
  assert.equal(state.batchCalls,0);
});
test('a valid claimant gets one guarded D1 batch: epoch event, owner update, token consumption',async()=>{
  const {db,state}=dbMock({gift:{
    card_id:42,donor_epoch:7,donor_user_id:'runner-a',
    current_owner_id:'runner-a',owner_epoch:7,claimed_at:null,
  }});
  const response=await claimSportGift(db,'runner-b','e'.repeat(64));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{claimed:true,id:42,ownerEpoch:8});
  assert.equal(state.batchCalls,1);
  const sql=state.actions.map(x=>x.sql);
  assert.match(sql[0],/INSERT INTO sport_card_ownership_events/);
  assert.match(sql[0],/c.owner_epoch=g.donor_epoch/);
  assert.match(sql[0],/g.claimed_at IS NULL/);
  assert.match(sql[1],/UPDATE sport_world_cards SET/);
  assert.match(sql[1],/owner_epoch=owner_epoch\+1/);
  assert.match(sql[1],/current_owner_id=\? AND owner_epoch=\?/);
  assert.match(sql[2],/UPDATE sport_card_gift_links SET claimed_at=\?,claimed_by=\?/);
  assert.match(sql[2],/claimed_at IS NULL/);
});
test('world gift schema is independent, durable and never changes musical gifts',()=>{
  const sql=readFileSync(new URL('../migrations/0009_sport_card_gift_links.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS sport_card_gift_links/);
  assert.match(sql,/donor_epoch INTEGER NOT NULL/);
  assert.doesNotMatch(sql,/expires_at|ALTER TABLE workout_card_gifts|DROP TABLE/i);
  const account=readFileSync(new URL('../worker/account.js',import.meta.url),'utf8');
  assert.match(account,/SPORT_WORLD_GIFTS_ENABLED!=='true'/);
  assert.match(account,/creating\?'sport-gift-create':'sport-gift-claim'/);
  assert.match(account,/browser&&!sameOrigin\(request\)/);
  assert.match(account,/return creating\?createSportGift\(db,member.id,input.id\)/);
  const html=readFileSync(new URL('../cadeau-sport.html',import.meta.url),'utf8');
  assert.match(html,/id="open-app" class="primary"/);
  assert.equal((html.match(/<a\b[^>]*>/g)||[]).length,1,
    'the only link on a sport gift landing is Open in the app');
  assert.doesNotMatch(html,/<button\b|id="claim"|id="prove"|Se connecter au site|\/api\/account\/sport\/gift\/claim/,
    'web gift must not offer sign-in, racing or ownership-transfer actions');
  assert.match(html,/beatonstep:\/\/sport-gift\?code=/);
  assert.doesNotMatch(html,/La carte est consultable dans BeatOnStep sans compte|Tu pourras te connecter dans l’application|class="note"/,
    'the landing should not repeat sign-in explanations beneath the app button');
  assert.match(html,/if\(!valid\)\{status\('Ce lien est incomplet ou incorrect\.\'\);return\}/);
  assert.doesNotMatch(html,/expir(e|ation)|sept jours/i);
});
