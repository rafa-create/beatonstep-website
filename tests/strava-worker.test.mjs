import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stravaRequest } from '../worker/strava.js';

const ROOT = 'https://beatonstep.app';
const SECRET = 'a'.repeat(64);
const DEVICE = '1'.repeat(64);
const env = db => ({
  DB: db, STRAVA_EXPORT_ENABLED: 'true', STRAVA_CLIENT_ID: '123456',
  STRAVA_CLIENT_SECRET: 'test-only-secret', STRAVA_ENCRYPTION_KEY: SECRET,
  STRAVA_ATHLETE_CAPACITY: '10',
});
function request(path, method = 'GET', key = DEVICE) {
  return new Request(ROOT + '/api/strava/' + path, {
    method, headers:{'x-bos-strava-key':key},
  });
}
const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function hashedState(state) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(state))));
}
function fakeDb(initialUsed = 10, connected = false) {
  const connections = new Map();
  for (let i=0; i<initialUsed; i++) {
    connections.set('existing'+i, {device_hash:'existing'+i,athlete_id:String(i+1)});
  }
  const pending = new Map();
  const db = {
    connections,pending,
    prepare(sql) {
      let args=[];
      return {
        bind(...v) { args=v;return this; },
        async first() {
          if (sql.startsWith('SELECT COUNT(*) AS used')) return {used:connections.size};
          if (sql.startsWith('SELECT * FROM strava_connections')) {
            if (connected) return {device_hash:args[0],athlete_id:'1'};
            return connections.get(args[0])||null;
          }
          if (sql.startsWith('DELETE FROM strava_oauth_pending')) {
            const entry=pending.get(args[0]);
            if (!entry || entry.expires_at <= args[1]) return null;
            pending.delete(args[0]);
            return {device_hash:entry.device_hash};
          }
          throw Error('Unexpected SQL first: '+sql);
        },
        async run() {
          if (sql.startsWith('INSERT INTO strava_connections')) {
            const [device,athlete,,,,,,,cap]=args;
            if (connections.size>=cap && ![...connections.values()].some(x=>x.athlete_id===athlete)) {
              return {meta:{changes:0}};
            }
            connections.set(device,{device_hash:device,athlete_id:athlete});
            return {meta:{changes:1}};
          }
          if (sql.startsWith('DELETE FROM strava_oauth_pending')) return {meta:{changes:0}};
          if (sql.startsWith('INSERT INTO strava_oauth_pending')) {
            pending.set(args[1],{device_hash:args[0],expires_at:args[2]});
            return {meta:{changes:1}};
          }
          throw Error('Unexpected SQL run: '+sql);
        },
      };
    },
  };
  return db;
}
test('new users see the server-side limit, connected users can still publish', async () => {
  const db = fakeDb(10);
  const status = await stravaRequest(request('status'),env(db),new URL(ROOT+'/api/strava/status'));
  assert.equal(status.status,200);
  assert.deepEqual(await status.json(), {enabled:true,used:10,capacity:10,connected:false,canConnect:false});
  const blocked = await stravaRequest(request('start','POST'),env(db),new URL(ROOT+'/api/strava/start'));
  assert.equal(blocked.status,409);
  assert.deepEqual(await blocked.json(),{error:'capacity_reached'});

  const connectedDb = fakeDb(10,true);
  const existing = await stravaRequest(request('status'),env(connectedDb),new URL(ROOT+'/api/strava/status'));
  const data = await existing.json();
  assert.equal(data.connected,true);
  assert.equal(data.canConnect,true);
  assert.equal(data.used,10);
});
test('a forged/absent device key is rejected before status or OAuth', async () => {
  const db=fakeDb(0);
  const response=await stravaRequest(request('status','GET','bad'),env(db),new URL(ROOT+'/api/strava/status'));
  assert.equal(response.status,401);
});
test('two concurrent callbacks at 9/10 cannot admit an eleventh athlete', async () => {
  const db=fakeDb(9);
  const s1='a'.repeat(64),s2='b'.repeat(64);
  db.pending.set(await hashedState(s1),{device_hash:'new-device-a',expires_at:Date.now()+50000});
  db.pending.set(await hashedState(s2),{device_hash:'new-device-b',expires_at:Date.now()+50000});
  const nativeFetch=globalThis.fetch;
  let deauthorizations=0;
  globalThis.fetch=async (url,init) => {
    if (String(url).endsWith('/oauth/token')) {
      const code=new URLSearchParams(init.body).get('code');
      return {ok:true,json:async()=>({
        athlete:{id:code==='code_a'?100:101},refresh_token:'test-refresh',
        access_token:'test-access',expires_at:Math.floor(Date.now()/1000)+3600,
      })};
    }
    if (String(url).endsWith('/oauth/deauthorize')) {
      deauthorizations++;
      return {ok:true};
    }
    throw Error('Unexpected remote call');
  };
  try {
    const callback = (state,code) => {
      const url = new URL(ROOT+'/api/strava/callback?state='+state+
        '&code='+code+'&scope=activity%3Awrite');
      return stravaRequest(new Request(url),env(db),url);
    };
    const results=await Promise.all([callback(s1,'code_a'),callback(s2,'code_b')]);
    assert.equal(db.connections.size,10);
    const outcomes=results.map(x=>new URL(x.headers.get('location')).searchParams.get('result')).sort();
    assert.deepEqual(outcomes,['connected','full']);
    assert.equal(deauthorizations,1);
  } finally { globalThis.fetch=nativeFetch; }
});

async function publishingFixture() {
  const iv = new Uint8Array(12).fill(7);
  const key = await crypto.subtle.importKey('raw',new Uint8Array(32).fill(0xaa),
    {name:'AES-GCM'},false,['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM',iv},key,new TextEncoder().encode('mock-access-token')));
  const row = {
    athlete_id:'athlete-123',device_hash:DEVICE,
    access_nonce:hex(iv),access_cipher:hex(cipher),
    expires_at:Math.floor(Date.now()/1000)+3600,
  };
  const exports = new Map();
  const db = {
    exports,
    prepare(sql) {
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){
          if(sql.startsWith('SELECT * FROM strava_connections')) return row;
          if(sql.startsWith('SELECT status,activity_id FROM strava_exports'))
            return exports.get(args[0]+'|'+args[1])||null;
          throw Error('Unexpected SQL first: '+sql);
        },
        async run(){
          if(sql.startsWith('INSERT INTO strava_exports')){
            const identity=args[0]+'|'+args[1];
            if(exports.has(identity))return {meta:{changes:0}};
            exports.set(identity,{status:'pending',activity_id:null});
            return {meta:{changes:1}};
          }
          if(sql.startsWith('DELETE FROM strava_exports')){
            const identity=args[0]+'|'+args[1];
            if(exports.get(identity)?.status!=='pending')return {meta:{changes:0}};
            exports.delete(identity);
            return {meta:{changes:1}};
          }
          if(sql.startsWith('UPDATE strava_exports')){
            const identity=args[2]+'|'+args[3];
            exports.set(identity,{status:'complete',activity_id:args[0]});
            return {meta:{changes:1}};
          }
          throw Error('Unexpected SQL run: '+sql);
        },
      };
    },
  };
  const startedAtMs=Date.now()-120000;
  const payload={runId:'bos-'+startedAtMs,startedAtMs,elapsedTime:90,distanceMeters:null};
  const call=(changes={})=>stravaRequest(new Request(ROOT+'/api/strava/publish',{
    method:'POST',
    headers:{'x-bos-strava-key':DEVICE,'content-type':'application/json'},
    body:JSON.stringify({...payload,...changes}),
  }),env(db),new URL(ROOT+'/api/strava/publish'));
  return {db,call};
}

test('a definite Strava 400 refusal releases the pending marker and allows a later successful retry',async()=>{
  const {db,call}=await publishingFixture();
  const realFetch=globalThis.fetch;
  let attempts=0;
  globalThis.fetch=async(url,request)=>{
    assert.equal(String(url),'https://www.strava.com/api/v3/activities');
    const form=new URLSearchParams(request.body);
    assert.equal(form.get('sport_type'),'Run');
    assert.equal(form.get('distance'),null,'unmeasured distance must not be invented');
    attempts++;
    if(attempts===1)return {ok:false,status:400,json:async()=>({message:'not logged',errors:[{field:'elapsed_time',code:'invalid'}]})};
    return {ok:true,status:201,json:async()=>({id:123456789})};
  };
  try{
    const rejected=await call();
    assert.equal(rejected.status,502);
    assert.deepEqual(await rejected.json(),{error:'strava_activity_rejected',upstreamStatus:400});
    assert.equal(db.exports.size,0,'definitely rejected activity must not remain stuck');
    const success=await call();
    assert.equal(success.status,200);
    assert.deepEqual(await success.json(),{
      ok:true,url:'https://www.strava.com/activities/123456789',
    });
    const duplicate=await call();
    assert.deepEqual(await duplicate.json(),{
      ok:true,alreadyPublished:true,url:'https://www.strava.com/activities/123456789',
    });
    assert.equal(attempts,2,'completed activity must never be posted twice');
  }finally{globalThis.fetch=realFetch;}
});

test('Strava 429/403 refusals safely release the pending record with a distinct error',async()=>{
  for(const status of [429,403]){
    const {db,call}=await publishingFixture();
    const realFetch=globalThis.fetch;
    globalThis.fetch=async()=>({ok:false,status});
    try{
      const response=await call();
      assert.equal(response.status,502);
      assert.deepEqual(await response.json(),{
        error:status===429?'strava_rate_limited':'strava_permission_denied',
        upstreamStatus:status,
      });
      assert.equal(db.exports.size,0,'rejected activity must not leave a pending marker');
    }finally{globalThis.fetch=realFetch;}
  }
});

test('ambiguous Strava 503 response remains pending and blocks duplicate submissions',async()=>{
  const {db,call}=await publishingFixture();
  const realFetch=globalThis.fetch;
  let attempts=0;
  globalThis.fetch=async()=>{attempts++;return {ok:false,status:503};};
  try{
    const first=await call();
    assert.equal(first.status,502);
    assert.deepEqual(await first.json(),{error:'strava_publication_failed_verify'});
    assert.equal(db.exports.size,1);
    const repeated=await call();
    assert.equal(repeated.status,409);
    assert.deepEqual(await repeated.json(),{error:'publication_pending_verify_strava'});
    assert.equal(attempts,1,'potentially created activity must not be retried blindly');
  }finally{globalThis.fetch=realFetch;}
});


async function disconnectFixture() {
  const iv=new Uint8Array(12).fill(9);
  const key=await crypto.subtle.importKey('raw',new Uint8Array(32).fill(0xaa),
    {name:'AES-GCM'},false,['encrypt']);
  const cipher=new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM',iv},key,new TextEncoder().encode('mock-refresh-token')));
  let connectionRow={
    device_hash:await hashedState('strava-device-v1:'+DEVICE),
    athlete_id:'12345',refresh_nonce:hex(iv),refresh_cipher:hex(cipher),
  };
  const exports=new Map([['12345|bos-123',{status:'pending',activity_id:null}]]);
  const db={
    prepare(sql){
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){
          if(sql.startsWith('SELECT * FROM strava_connections'))return connectionRow;
          throw Error('Unexpected SQL first: '+sql);
        },
        async run(){
          if(sql.startsWith('DELETE FROM strava_connections')){
            assert.equal(args[0],await hashedState('strava-device-v1:'+DEVICE));
            connectionRow=null;
            return {meta:{changes:1}};
          }
          throw Error('Unexpected SQL run: '+sql);
        },
      };
    },
  };
  const call=async(localOnly=false)=>{
    const url=ROOT+'/api/strava/disconnect';
    return stravaRequest(new Request(url,{
      method:'POST',headers:{'x-bos-strava-key':DEVICE,
        ...(localOnly?{'content-type':'application/json'}:{})},
      ...(localOnly?{body:JSON.stringify({localOnly:true})}:{}),
    }),env(db),new URL(url));
  };
  return {db,call,exports,getConnection:()=>connectionRow};
}

test('successful Strava revoke uses Basic auth and an encrypted refresh token, then unlinks',async()=>{
  const fixture=await disconnectFixture();
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.equal(url,'https://www.strava.com/oauth/revoke');
    assert.equal(options.method,'POST');
    assert.equal(options.headers.authorization,'Basic '+btoa('123456:test-only-secret'));
    assert.equal(options.headers['content-type'],'application/x-www-form-urlencoded');
    assert.equal(options.body.get('token'),'mock-refresh-token');
    assert.equal(options.body.get('token_type_hint'),'refresh_token');
    return {ok:true,status:200};
  };
  try {
    const response=await fixture.call();
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{ok:true,remoteRevoked:true,
      manualRevocationRequired:false});
    assert.equal(calls,1);
    assert.equal(fixture.getConnection(),null,'credentials must be erased');
    assert.equal(fixture.exports.size,1,'previous export marker must prevent duplicate uploads');
  }finally{globalThis.fetch=originalFetch;}
});

test('Strava 403 during revoke preserves the connection until explicit local unlink',async()=>{
  const fixture=await disconnectFixture();
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    return {ok:false,status:403};
  };
  try {
    const remote=await fixture.call();
    assert.equal(remote.status,502);
    assert.deepEqual(await remote.json(),{error:'strava_disconnect_remote_failed'});
    assert.notEqual(fixture.getConnection(),null,'failed remote revoke must not imply disconnect');
    const local=await fixture.call(true);
    assert.equal(local.status,200);
    assert.deepEqual(await local.json(),{ok:true,remoteRevoked:false,
      manualRevocationRequired:true});
    assert.equal(fixture.getConnection(),null,'explicit local unlink must erase credentials');
    assert.equal(calls,1,'local-only fallback must not access inactive Strava API');
    assert.equal(fixture.exports.size,1,'pending run must stay protected against re-post');
  }finally{globalThis.fetch=originalFetch;}
});

test('OTA: only available measured pace, heart rate and PPM appear in manual activity',async()=>{
  const {call}=await publishingFixture();
  const realFetch=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    assert.equal(String(url),'https://www.strava.com/api/v3/activities',
      'OTA never invokes the GPS TCX upload endpoint');
    const form=new URLSearchParams(init.body);
    const text=form.get('description');
    assert.match(text,/Allure moyenne : 5:20\/km/);
    assert.match(text,/FC moyenne : 142 bpm/);
    assert.match(text,/FC max : 171 bpm/);
    assert.match(text,/Cadence moyenne : 168 pas\/min/);
    assert.equal(form.get('distance'),null,'no source-backed distance must mean no distance');
    return {ok:true,status:201,json:async()=>({id:101112})};
  };
  try{
    const response=await call({
      paceSecPerKm:320,heartRateBpm:142,maxHeartRateBpm:171,cadencePpm:168,
    });
    assert.equal(response.status,200);
    assert.match((await response.json()).url,/\/activities\/101112$/);
  }finally{globalThis.fetch=realFetch;}
});

test('OTA: missing metrics stay omitted, not invented',async()=>{
  const {call}=await publishingFixture();
  const realFetch=globalThis.fetch;
  globalThis.fetch=async(_url,init)=>{
    const description=new URLSearchParams(init.body).get('description');
    assert.doesNotMatch(description,/Allure moyenne|FC moyenne|FC max|Cadence moyenne/);
    return {ok:true,status:201,json:async()=>({id:8888})};
  };
  try{const response=await call(); assert.equal(response.status,200);}
  finally{globalThis.fetch=realFetch;}
});

test('OTA: reject forged out-of-range optional metrics before posting to Strava',async()=>{
  const {call}=await publishingFixture();
  const realFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Strava must not be called');};
  try{
    for(const bad of [{cadencePpm:990},{heartRateBpm:'145'},
                      {paceSecPerKm:-2},{maxHeartRateBpm:Infinity}]){
      const response=await call(bad);
      assert.equal(response.status,400,JSON.stringify(bad));
      assert.deepEqual(await response.json(),{error:'invalid_run'});
    }
  }finally{globalThis.fetch=realFetch;}
});
