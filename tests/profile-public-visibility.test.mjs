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
  const state={setting:null,worldReads:0,ghostReads:0,writes:0};
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
          if(sql.includes('FROM account_run_records WHERE user_id=?')){
            assert.deepEqual(args,['u1']);
            return {results:[{snapshot_json:JSON.stringify({
              endedAtMs:1792000000000,durationSeconds:1517,
              distanceMeters:5200,averagePaceSecPerKm:291,
              tracks:[{title:'PRIVATE SONG'}],runRoute:[[1,2],[3,4]],
            })}]};
          }
          if(sql.includes('JOIN sport_card_achievements a ON a.card_id=c.id AND a.user_id=?')){
            state.ghostReads++;
            assert.deepEqual(args,['u1','u1','u1']);
            return {results:[{id:43,distance_cm:1000000,time_unit:'minute',
              sub_value:60,difficulty:'regular'}]};
          }
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

test('explicit public consent shares signed cards and sanitized sessions',async()=>{
  const f=fixture();
  await dispatch(f,'/api/account/profile/preferences',{
    method:'POST',loggedIn:true,data:{showChallenges:true}});
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
  assert.deepEqual(publicData.ghosts,[{id:43,distanceCm:1000000,timeUnit:'minute',
    subValue:60,difficulty:'regular',ghost:true}]);
  assert.equal(f.state.ghostReads,1);
  assert.deepEqual(publicData.challenges[0],{
    id:42,distanceCm:500000,timeUnit:'minute',subValue:25,difficulty:'intermediate',
  });
  assert.equal(f.state.worldReads,1);
  assert.deepEqual(publicData.runs,[{at:1792000000000,durationSeconds:1517,
    distanceMeters:5200,averagePaceSecPerKm:291}]);
  assert.ok(!JSON.stringify(publicData).includes('u1'),'no private D1 user IDs');
  assert.doesNotMatch(JSON.stringify(publicData),/PRIVATE SONG|runRoute|snapshot_json|runId/);
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
  assert.equal(Object.hasOwn(data,'ghosts'),false);
  assert.equal(f.state.ghostReads,0,'private histories are not queried');
  assert.equal(f.state.worldReads,0,'do not even read private profile cards');
  assert.equal(data.items.length,0,'private profile hides its signed creations');
  assert.deepEqual(data.runs,[],'private profile never exposes saved runs');
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
  assert.match(page,/id="show-public-challenges" type="checkbox">Rendre mon profil privé/);
  assert.doesNotMatch(page,/id="show-public-challenges" type="checkbox" checked/);
  assert.match(page,/api\('\/api\/account\/profile\/preferences','POST',\{showChallenges\}\)/);
  assert.match(page,/const showChallenges=!input\.checked/);
  assert.match(page,/\$\('show-public-challenges'\)\.checked=!storedShowChallenges/);
  assert.match(page,/\$\('public-show-challenges'\)\.hidden=!visible/);
  assert.match(page,/if\(data\.showChallenges===true\)/);
  assert.match(page,/id="public-show-history"/);
  assert.match(page,/id="public-private-notice"/);
  assert.match(page,/function renderPublicRuns\(items\)/);
  assert.match(page,/publicSelectedDeck='sessions'/);
  assert.match(page,/renderPublicChallenges\(data\.challenges\|\|\[\],data\.ghosts\|\|\[\]\)/);
  assert.match(page,/\/partages\.html\?kind=challenge&sport=/);
  assert.match(page,/item\.kind==='workout'/);
});

test('missing preference defaults to public; explicit opt-out stays private',async()=>{
  const f=fixture();
  const visitor=await dispatch(f,'/api/account/profile?handle=runner');
  const data=await visitor.json();
  assert.equal(data.showChallenges,true);
  assert.equal(data.items.length,1);
  assert.equal(data.runs.length,1);
  assert.equal(data.challenges.length,1);
  assert.equal(data.ghosts.length,1);
  const prefs=await dispatch(f,'/api/account/profile/preferences',{loggedIn:true});
  assert.deepEqual(await prefs.json(),{showChallenges:true,settingsReady:true});
  await dispatch(f,'/api/account/profile/preferences',{method:'POST',
    loggedIn:true,data:{showChallenges:false}});
  const masked=await (await dispatch(f,'/api/account/profile?handle=runner')).json();
  assert.equal(masked.showChallenges,false);
  assert.deepEqual(masked.items,[]);
  assert.deepEqual(masked.runs,[]);
  assert.equal(Object.hasOwn(masked,'ghosts'),false);
  const owner=await dispatch(f,'/api/account/profile?handle=runner',{loggedIn:true});
  const mine=await owner.json();
  assert.equal(mine.items.length,1);
  assert.equal(mine.challenges.length,1);
  assert.equal(mine.ghosts.length,1);
  assert.deepEqual(mine.runs,[]);
});

test('private checkbox is opt-in, mirrors persisted visibility and reverts errors',async()=>{
  const page=readFileSync(new URL('../compte.html',import.meta.url),'utf8');
  const start=page.indexOf('  async function loadProfileVisibility(){');
  const end=page.indexOf('  async function account(){',start);
  assert.ok(start>0&&end>start);
  const code=page.slice(start,end);
  const input={checked:false,disabled:false};
  const status={textContent:''};
  const nodes={'show-public-challenges':input,'visibility-status':status};
  let storedShowChallenges=true,showChallenges=true,shouldFail=false;
  const writes=[];
  const api=async(path,method,data)=>{
    assert.equal(path,'/api/account/profile/preferences');
    if(!method)return {showChallenges};
    assert.equal(method,'POST');
    if(shouldFail)throw Error('network_error');
    writes.push(data.showChallenges);
    showChallenges=data.showChallenges;
    return {showChallenges};
  };
  const $=key=>nodes[key];
  const vmSource=code.replaceAll('storedShowChallenges','state.showChallenges');
  const state={showChallenges:storedShowChallenges};
  const context={$,api,state};
  vm.runInNewContext(vmSource,context);
  await context.loadProfileVisibility();
  assert.equal(input.checked,false,'public account starts unchecked');
  input.checked=true;await input.onchange();
  assert.deepEqual(writes,[false],'checking private opt-in writes showChallenges=false');
  assert.equal(input.checked,true);
  assert.equal(status.textContent,'Profil privé activé.');
  input.checked=false;await input.onchange();
  assert.deepEqual(writes,[false,true],'unchecking restores public without a migration');
  assert.equal(input.checked,false);
  assert.equal(status.textContent,'Profil public activé.');
  shouldFail=true;input.checked=true;await input.onchange();
  assert.equal(input.checked,false,'failed privacy change restores persisted state');
  assert.equal(input.disabled,false);
  assert.match(status.textContent,/Modification impossible/);
  showChallenges=false;shouldFail=false;
  await context.loadProfileVisibility();
  assert.equal(input.checked,true,'existing private account stays checked');
});
