import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {accountRequest} from '../worker/account.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const ROOT='https://beatonstep.app', token='a'.repeat(64);
const request=(route,{method='GET',data,loggedIn=false,origin=ROOT}={})=>
  new Request(ROOT+route,{
    method,
    headers:{
      ...(loggedIn?{cookie:'__Host-bos_community='+token}:{}),
      ...(method!=='GET'?{origin,'content-type':'application/json'}:{}),
    },
    ...(data!==undefined?{body:JSON.stringify(data)}:{}),
  });

function fixture({migrationReady=true,legacyChallenge=false}={}){
  const state={setting:null,worldReads:0,writes:0};
  const DB={
    prepare(sql){
      const statement=(args=[])=>({
        sql,args,bind(...v){return statement(v)},
        async first(){
          if(sql==='SELECT id FROM community_users LIMIT 1')return {id:'u1'};
          if(sql.startsWith('SELECT id,handle FROM community_users WHERE handle=?'))
            return args[0]==='runner'?{id:'u1',handle:'runner'}:null;
          if(sql.includes('FROM community_sessions s'))
            return {id:'u1',email:'x@example.test',handle:'runner'};
          if(sql==='SELECT show_challenges FROM community_profile_settings WHERE user_id=?'){
            if(!migrationReady)throw Error('D1_ERROR: no such table: community_profile_settings');
            assert.equal(args[0],'u1');
            return state.setting===null?null:{show_challenges:state.setting};
          }
          throw Error('unexpected first SQL: '+sql);
        },
        async all(){
          if(sql.includes('FROM signed_shares s JOIN shared_items x'))
            return {results:[
              {id:2,name:'Run 10 km',kind:'workout',source:'spotify',
                created_at:1000,imports:4,workout_goal:'distance',workout_distance_meters:10000,
                profile_json:JSON.stringify([['Warmup',300,125,130],['Fast',180,172,165]])},
              ...(legacyChallenge?[{id:3,name:'Legacy challenge secret',
                kind:'challenge',source:'none',created_at:2000,imports:0}]:[]),
            ]};
          if(sql.includes('FROM sport_world_cards WHERE current_owner_id=?')){
            state.worldReads++;
            assert.deepEqual(args,['u1']);
            assert.match(sql,/LIMIT 100/);
            return {results:[{id:42,distance_cm:500000,time_unit:'minute',
              sub_value:25,difficulty:'intermediate'}]};
          }
          throw Error('unexpected all SQL: '+sql);
        },
        async run(){
          if(sql.startsWith('INSERT INTO community_profile_settings')){
            assert.equal(args[0],'u1');
            assert.ok(args[1]===1||args[1]===0);
            if(!migrationReady)throw Error('no such table: community_profile_settings');
            state.setting=args[1];state.writes++;
            return {meta:{changes:1}};
          }
          throw Error('unexpected run SQL: '+sql);
        },
      });
      return statement();
    },
  };
  const env={DB,CATALOG_BACKEND:'d1',SPORT_WORLD_CARDS_ENABLED:'true',
    ASSETS:{fetch:()=>new Response('STATIC')}};
  return {env,state,request:(route,opts)=>request(route,opts)};
}
const dispatch=(f,route,opts)=>accountRequest(f.request(route,opts),f.env,
  new URL(ROOT+route));

test('manual migration is additive, default-visible, and changes no sporting ownership',()=>{
  const sql=readFileSync(new URL('../migrations/0010_public_profile_visibility.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS community_profile_settings/);
  assert.match(sql,/user_id TEXT PRIMARY KEY REFERENCES community_users\(id\) ON DELETE CASCADE/);
  assert.match(sql,/DEFAULT 1 CHECK \(show_challenges IN \(0,1\)\)/);
  assert.doesNotMatch(sql,/ALTER TABLE|DELETE FROM|DROP TABLE|sport_world_cards SET|signed_shares SET/i);
});

test('world challenges appear with signed musical sessions by default',async()=>{
  const f=fixture();
  const response=await dispatch(f,'/api/account/profile?handle=runner');
  assert.equal(response.status,200);
  const publicData=await response.json();
  assert.equal(publicData.handle,'runner');
  assert.equal(publicData.showChallenges,true);
  assert.equal(publicData.items.length,1);
  assert.equal(publicData.items[0].goalMode,'distance');
  assert.deepEqual(publicData.items[0].profile,[[300,125],[180,172]],
    'public API reuses signed, persisted cadence/duration phases');
  assert.equal(publicData.challenges.length,1);
  assert.deepEqual(publicData.challenges[0],{
    id:42,distanceCm:500000,timeUnit:'minute',subValue:25,difficulty:'intermediate',
  });
  assert.equal(f.state.worldReads,1);
  assert.ok(!JSON.stringify(publicData).includes('u1'),'no private D1 user IDs');
});

test('authenticated checkbox hides all challenges in public profile JSON',async()=>{
  const f=fixture({legacyChallenge:true});
  const setting=await dispatch(f,'/api/account/profile/preferences',{method:'POST',
    loggedIn:true,data:{showChallenges:false}});
  assert.equal(setting.status,200);
  assert.deepEqual(await setting.json(),{showChallenges:false});
  assert.equal(f.state.writes,1);
  const guest=await dispatch(f,'/api/account/profile?handle=runner');
  const data=await guest.json();
  assert.equal(data.showChallenges,false);
  assert.equal(Object.hasOwn(data,'challenges'),false,'no card IDs or counts are leaked');
  assert.equal(f.state.worldReads,0,'do not even read private profile cards');
  assert.equal(data.items.length,1,'public musical creations remain visible');
  assert.equal(JSON.stringify(data).includes('Legacy challenge secret'),false,
    'legacy challenges must never leak through signed shares when hidden');
  const own=await dispatch(f,'/api/account/profile/preferences',{loggedIn:true});
  assert.equal((await own.json()).showChallenges,false);
  const restored=await dispatch(f,'/api/account/profile/preferences',{method:'POST',
    loggedIn:true,data:{showChallenges:true}});
  assert.equal(restored.status,200);
  const after=(await (await dispatch(f,'/api/account/profile?handle=runner')).json());
  assert.equal(after.challenges.length,1,'public challenges return when reenabled');
});

test('visibility toggle is owner-only, origin protected and requires boolean',async()=>{
  const f=fixture();
  const guest=await dispatch(f,'/api/account/profile/preferences',{method:'POST',
    data:{showChallenges:false}});
  assert.equal(guest.status,401);
  const csrf=await dispatch(f,'/api/account/profile/preferences',{method:'POST',
    loggedIn:true,origin:'https://other.test',data:{showChallenges:false}});
  assert.equal(csrf.status,403);
  const invalid=await dispatch(f,'/api/account/profile/preferences',{method:'POST',
    loggedIn:true,data:{showChallenges:'false'}});
  assert.equal(invalid.status,400);
  assert.equal(f.state.writes,0);
  const read=await dispatch(f,'/api/account/profile/preferences');
  assert.equal(read.status,401,'guest cannot read private settings endpoint');
});

test('staged deployment does not break public profiles before D1 migration',async()=>{
  const f=fixture({migrationReady:false});
  const publicResponse=await dispatch(f,'/api/account/profile?handle=runner');
  assert.equal(publicResponse.status,200);
  assert.equal((await publicResponse.json()).showChallenges,true);
  const settings=await dispatch(f,'/api/account/profile/preferences',{loggedIn:true});
  assert.deepEqual(await settings.json(),{showChallenges:true,settingsReady:false});
});

test('public profile tabs are hidden when challenges are disabled',()=>{
  const page=readFileSync(new URL('../compte.html',import.meta.url),'utf8');
  const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.match(page,/id="public-show-challenges"/);
  assert.match(page,/id="public-show-sessions"/);
  assert.match(page,/id="show-public-challenges" type="checkbox"/);
  assert.match(page,/api\('\/api\/account\/profile\/preferences','POST',\{showChallenges:choice\}\)/);
  assert.match(page,/\$\('public-show-challenges'\)\.hidden=!visible/);
  assert.match(page,/if\(data\.showChallenges===false\)/);
  assert.match(page,/publicSelectedDeck='sessions'/);
  assert.match(page,/renderPublicChallenges\(data\.challenges\|\|\[\]\)/);
  assert.match(page,/\/partages\.html\?kind=challenge&sport=/);
  assert.match(page,/item\.kind==='workout'/);
});
