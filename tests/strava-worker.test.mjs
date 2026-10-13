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
