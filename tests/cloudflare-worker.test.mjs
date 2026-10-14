import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { validate, publicRow } from '../worker/index.js';
import { existsSync, readFileSync } from 'node:fs';

test('site header profile entry and catalogue popular default', () => {
  for (const name of ['index.html', 'seances-programmees.html', 'garmin.html', 'privacy.html', 'music-credits.html']) {
    const html = readFileSync(name, 'utf8');
    assert.match(html, /class="profile-link" href="compte\.html"/, name + ' links to the optional account');
    assert.match(html, /class="profile-link-label" data-fr>Profil<\/span>/, name + ' has French profile label');
    assert.match(html, /class="profile-link-label" data-en>Profile<\/span>/, name + ' has English profile label');
  }
  const catalogue = readFileSync('partages.html', 'utf8');
  assert.match(catalogue, /class="community-link" href="compte\.html"/);
  assert.match(catalogue, /<option value="popular" selected>/);
  assert.match(catalogue, /params\.get\('sort'\)\)\?params\.get\('sort'\):'popular'/);
  assert.match(catalogue, /'&sort='\+sort/);
  assert.match(readFileSync('site.css', 'utf8'), /\.profile-link:focus-visible/);
});

test('worker reports mode without requiring a D1 binding', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/health'), {
    CATALOG_BACKEND: 'legacy',
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.catalog, 'legacy');
});

test('time and distance popular workouts are separately ranked by verified imports', async () => {
  const timed={v:1,n:'Fractionné',s:'spotify',
    p:[['Effort',600,160,null]],t:[]};
  const distance={...timed,n:'5 km endurance',g:'distance',m:[5000]};
  assert.equal(validate('workout',timed).goalMode,'time');
  assert.deepEqual({
    goalMode:validate('workout',distance).goalMode,
    distanceMeters:validate('workout',distance).distanceMeters,
  },{goalMode:'distance',distanceMeters:5000});
  for(const invalid of [
    {...distance,m:[]},{...distance,m:[5]},
    {...distance,m:[200001]},{...timed,m:[5000]},
    {...distance,g:'time'},
  ])assert.equal(validate('workout',invalid),null,
    'an invalid or ambiguous sporting goal is not a distance recommendation');
  const sample={
    id:5,kind:'workout',source:'spotify',name:'5 km endurance',duration_sec:1800,
    bpm:null,tracks:0,phases:1,profile_json:null,created_at:1,views:0,imports:7,
    payload_v:1,workout_goal:'distance',workout_distance_meters:5000,
  };
  const compact=publicRow(sample);
  assert.equal(compact.goalMode,'distance');
  assert.equal(compact.distanceMeters,5000);
  assert.equal(compact.imports,7);
  const timedLegacy=publicRow({...sample,workout_goal:null,workout_distance_meters:null});
  assert.equal(timedLegacy.goalMode,'time');
  const statements=[];
  const env={
    CATALOG_BACKEND:'d1',
    DB:{prepare(sql){
      statements.push(sql);
      return {bind(){return {
        first:async()=>({total:1}),
        all:async()=>({results:[sample]}),
      }}};
    }},
    ASSETS:{fetch:()=>new Response('STATIC')},
  };
  const response=await worker.fetch(new Request(
    'https://beatonstep.app/api/shared?kind=workout&sort=popular&goalMode=distance&page=1'
  ),env);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.items[0].goalMode,'distance');
  assert.equal(result.items[0].distanceMeters,5000);
  assert.ok(statements.filter(s=>s.includes('FROM shared_items')).every(s=>
    s.includes("json_extract(payload_json,'$.g')='distance'")),
    'the goal filter must apply before sorting and pagination, including count');
  assert.ok(statements.some(s=>s.includes('ORDER BY imports DESC, id DESC')),
    'the community rank is the actual import count');
});

test('missing D1 binding never silently creates a new catalogue', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/shared'), {
    CATALOG_BACKEND: 'd1',
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(response.status, 503);
});

test('static site assets are served without backend dependencies', async () => {
  const response = await worker.fetch(new Request('https://example.com/privacy.html'), {
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(await response.text(), 'STATIC');
});

test('wrangler routes API first and excludes private sources from static output', async () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.name, 'beatonstep-website');
  assert.equal(config.vars.CATALOG_BACKEND, 'd1');
  assert.deepEqual(config.assets.run_worker_first,
    ['/api/*', '/partages.html', '/cadeau', '/cadeau/'],
    'gift short URLs must reach the Worker alongside the API and catalog');
  assert.ok(!existsSync('dist/worker/index.js'));
  assert.ok(!existsSync('dist/migrations/0001_shared_catalog.sql'));
  assert.ok(existsSync('dist/partages.html'));
  assert.ok(existsSync('dist/admin.html'));
  assert.ok(!existsSync('dist/scripts/provision-admin-sql.py'));
  assert.ok(!existsSync('dist/worker/admin.js'));
  assert.ok(!existsSync('dist/migrations/0002_catalog_admin.sql'));
});

test('public share page uses same-origin API, never a VM hostname', async () => {
  const page = readFileSync('partages.html', 'utf8');
  assert.match(page, /const API='\/api\/shared';/);
  assert.doesNotMatch(page, /beatonstep\.tail09d8d8\.ts\.net/);
});

test('D1 publish fails closed without the publishing salt', async () => {
  const response = await worker.fetch(new Request('https://beatonstep.app/api/shared', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'runmix', payload: {
      v: 1, i: '0123456789abcdef', s: 'spotify', t: [['Song A']], n: 'Test'
    } }),
  }), {
    CATALOG_BACKEND: 'd1',
    DB: { prepare: () => { throw Error('A write was attempted'); } },
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'catalog_write_not_configured');
});

test('D1 health checks both database tables and the publishing secret', async () => {
  const prepared = [];
  const response = await worker.fetch(new Request('https://beatonstep.app/api/health'), {
    CATALOG_BACKEND: 'legacy',
    CATALOG_RATE_SALT: 'test-only-secret',
    DB: { prepare: sql => {
      prepared.push(sql);
      return { first: async () => null };
    } },
    ASSETS: { fetch: () => new Response('STATIC') }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.schemaReady, true);
  assert.equal(data.publishingConfigured, true);
  assert.equal(prepared.length, 3);
  assert.equal(prepared.filter(sql=>sql.includes('sqlite_master')&&
    sql.includes('sport_verified_run_award_v1')).length,1,
    'Health must check the sport trigger once alongside existing catalogue checks');
});

test('public health verifies world sport tables and triggers without exposing runner data', async () => {
  const queries=[];
  const env={
    CATALOG_BACKEND:'d1',CATALOG_RATE_SALT:'private-test-only',
    SPORT_WORLD_CARDS_ENABLED:'false',
    SPORT_WORLD_GIFTS_ENABLED:'false',
    SPORT_AUTO_AWARDS_ENABLED:'false',
    DB:{prepare(sql){
      queries.push(sql);
      return {first:async()=>sql.includes('sqlite_master')?{found:7}:null};
    }},
    ASSETS:{fetch:()=>new Response('STATIC')},
  };
  const response=await worker.fetch(new Request('https://beatonstep.app/api/health'),env);
  assert.equal(response.status,200);
  const value=await response.json();
  assert.equal(value.schemaReady,true);
  assert.deepEqual(value.sport,{
    schemaReady:true,worldCardsEnabled:false,giftsEnabled:false,autoAwardsEnabled:false,
  });
  assert.match(queries.at(-1),/sport_card_gift_links/);
  assert.match(queries.at(-1),/sport_verified_run_award_v1/);
  assert.equal(JSON.stringify(value).includes('runner'),false);
  assert.equal(JSON.stringify(value).includes('private-test-only'),false);

  env.DB.prepare=sql=>({first:async()=>sql.includes('sqlite_master')?{found:6}:null});
  const incomplete=await worker.fetch(new Request('https://beatonstep.app/api/health'),env);
  assert.equal((await incomplete.json()).sport.schemaReady,false);

  env.DB.prepare=()=>{throw Error('D1 temporarily offline')};
  const offline=await worker.fetch(new Request('https://beatonstep.app/api/health'),env);
  assert.equal(offline.status,200);
  assert.equal((await offline.json()).sport.schemaReady,false);
});

test('D1 publishes separate numeric IDs and old VM IDs never resolve to new cards', async () => {
  const publicId = 1_000_000_000_007;
  const row = {
    id: 7, kind: 'runmix', source: 'spotify', name: 'D1 playlist',
    duration_sec: 300, bpm: 128, tracks: 1, phases: 0, profile_json: null,
    payload_json: JSON.stringify({ v: 1, i: 'a'.repeat(32), s: 'spotify',
      n: 'D1 playlist', t: [['Track']] }),
    created_at: 100, views: 0, imports: 0,
  };
  const boundIds = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          if (sql.startsWith('INSERT INTO publish_quotas')) {
            return { first: async () => ({ uses: 1 }) };
          }
          if (sql.startsWith('INSERT INTO shared_items')) {
            return { run: async () => ({ meta: { last_row_id: 7 } }) };
          }
          if (sql.startsWith('SELECT COUNT(*)')) {
            return { first: async () => ({ total: 1 }) };
          }
          if (sql.startsWith('SELECT id,kind,source,name')) {
            return { all: async () => ({ results: [row] }) };
          }
          if (sql.startsWith('SELECT * FROM shared_items')) {
            boundIds.push(args[0]);
            return { first: async () => row };
          }
          if (sql.startsWith('SELECT id FROM shared_items')) {
            boundIds.push(args[0]);
            return { first: async () => ({ id: 7 }) };
          }
          if (sql.startsWith('UPDATE shared_items')) {
            boundIds.push(args[0]);
            return { run: async () => ({}) };
          }
          throw Error('Unexpected query in test: ' + sql);
        }
      };
    },
  };
  const env = {
    CATALOG_BACKEND: 'd1', CATALOG_RATE_SALT: 'unit-test-only',
    DB: db, ASSETS: { fetch: () => new Response('STATIC') },
  };
  const payload = JSON.parse(row.payload_json);
  const published = await worker.fetch(new Request('https://beatonstep.app/api/shared', {
    method: 'POST', headers: {
      'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.4'
    }, body: JSON.stringify({ kind: 'runmix', payload })
  }), env);
  assert.equal(published.status, 201);
  assert.deepEqual(await published.json(), {
    id: publicId,
    url: 'https://beatonstep.app/partages.html?id=' + publicId,
  });
  const legacy = await worker.fetch(new Request('https://beatonstep.app/api/shared/7'), env);
  assert.equal(legacy.status, 404);
  assert.equal((await legacy.json()).error, 'expired_share');
  const list = await worker.fetch(new Request('https://beatonstep.app/api/shared'), env);
  assert.equal(list.status, 200);
  const listData = await list.json();
  assert.equal(listData.items[0].id, publicId);
  assert.equal('profile' in listData.items[0], false,
    'Run Mix without per-track BPM must not invent a profile');
  const detail = await worker.fetch(new Request(
    'https://beatonstep.app/api/shared/' + publicId), env);
  assert.equal(detail.status, 200);
  const detailData = await detail.json();
  assert.equal(detailData.id, publicId);
  assert.equal('profile' in detailData, false,
    'legacy playlist with unknown BPM stays uncharted');
  const view = await worker.fetch(new Request(
    'https://beatonstep.app/api/shared/' + publicId + '/view', {
      method: 'POST', headers: { 'cf-connecting-ip': '192.0.2.4' },
    }), env);
  assert.equal(view.status, 200);
  assert.equal((await view.json()).counted, true);
  assert.deepEqual(boundIds, [7, 7, 7]);
});


test('old Run Mix shares show real BPM graphs on catalog and detail without a D1 migration', async () => {
  const row = {
    id: 4, kind: 'runmix', source: 'spotify', name: 'Old Run Mix',
    duration_sec: 620, bpm: 140, tracks: 3, phases: 0,
    profile_json: null,
    payload_json: JSON.stringify({ v: 1, i: 'a'.repeat(32), s: 'spotify',
      n: 'Old Run Mix', t: [
        ['a','Song 1','A','Album',120,180],
        ['b','Song 2','A','Album',null,240],
        ['c','Song 3','A','Album',160,200],
      ] }),
    created_at: 100, views: 0, imports: 0,
  };
  const db = {
    prepare(sql) {
      return {
        bind() {
          if (sql.startsWith('SELECT COUNT(*)')) return {first: async () => ({total:1})};
          if (sql.startsWith('SELECT id,kind,source,name')) {
            assert.match(sql,/payload_json/, 'legacy list must have old track metadata');
            return {all: async () => ({results:[row]})};
          }
          if (sql.startsWith('SELECT * FROM shared_items')) return {first:async()=>row};
          throw Error('Unexpected SQL '+sql);
        },
      };
    },
  };
  const env={DB:db,CATALOG_BACKEND:'d1',ASSETS:{fetch:()=>new Response('STATIC')}};
  const list=await worker.fetch(new Request('https://beatonstep.app/api/shared?kind=runmix'),env);
  assert.equal(list.status,200);
  const item=(await list.json()).items[0];
  assert.deepEqual(item.profile,[[180,120],[240,null],[200,160]]);
  assert.equal('payload' in item,false,'catalog cards remain compact public responses');
  const detail=await worker.fetch(new Request('https://beatonstep.app/api/shared/1000000000004'),env);
  assert.equal(detail.status,200);
  assert.deepEqual((await detail.json()).profile,item.profile);
});
