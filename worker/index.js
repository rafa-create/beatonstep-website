import { adminRequest } from './admin.js';
import { accountRequest, ensureCommunitySchema, devicePublisher, authorFor } from './account.js';
import { sharePageResponse } from './share-preview.js';
import { cardsEnabled, requireCardSchema, canonicalShareId, cardPeople, publishUniqueWorkout } from './cards.js';
import { runMixBpmProfile, legacyRunMixBpmProfile } from './runmix-profile.js';
import { stravaRequest } from './strava.js';
import { challengeRule } from './distance-challenge.js';
import { readPublicSportCards } from './sport-public-catalog.js';
import {ensureSportTelemetrySchema,processPendingSportTelemetryReviews} from './sport-card-telemetry.js';

// BeatOnStep Cloudflare Worker: static website + optional D1 public catalogue.
// The legacy mode is intentional until the mobile app and website are switched together.
const LEGACY_API = 'https://beatonstep.tail09d8d8.ts.net';
// New D1 links use a separate numeric range so old VM links never open a wrong card.
// Both the mobile deep link and website support 15-digit numeric identifiers.
const D1_ID_OFFSET = 1_000_000_000_000;
const PUBLIC_SOURCES = ['spotify', 'deezer', 'youtube', 'apple', 'amazon'];
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'cache-control': 'no-store',
    ...extra,
  },
});
const clean = (value, n = 80) => typeof value === 'string'
  ? [...value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()].slice(0, n).join('') : '';
const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function validate(kind, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      new TextEncoder().encode(JSON.stringify(payload)).length > 512 * 1024) return null;
  if (kind === 'workout' && payload.v === 2) {
    const rule=challengeRule(payload);
    // A public canonical card never stores anybody's personal playlist,
    // GPS samples, account identity or other arbitrary client data.
    if (!rule || Object.keys(payload).length !== 4 ||
        Object.keys(payload).some(key=>!['v','goalMode','targetMeters','deadlineSec'].includes(key))) return null;
    const minutes=Math.floor(rule.deadlineSec/60);
    const seconds=String(rule.deadlineSec%60).padStart(2,'0');
    return {
      name:(rule.targetMeters/1000)+' km · '+minutes+':'+seconds,
      source:'mixed',durationSec:rule.deadlineSec,bpm:null,
      tracks:0,phases:1,profile:null,
      canonicalPayload:{
        v:2,goalMode:'distance',targetMeters:rule.targetMeters,deadlineSec:rule.deadlineSec,
      },
    };
  }
  if (kind === 'runmix') {
    if (payload.v !== 1 || !/^[a-f0-9]{16,64}$/i.test(payload.i || '') ||
        !['spotify', 'deezer', 'youtube', 'apple'].includes(payload.s) ||
        !Array.isArray(payload.t) || payload.t.length < 1 || payload.t.length > 250 ||
        payload.t.some(t => !Array.isArray(t) || !clean(t[0], 180))) return null;
    return { name: clean(payload.n) || 'Run Mix', source: payload.s,
      durationSec: positive(payload.d) ? Math.round(payload.d) : 0,
      bpm: positive(payload.b) ? Math.round(payload.b) : null,
      tracks: payload.t.length, phases: 0, profile: runMixBpmProfile(payload.t) };
  }
  if (kind !== 'workout' || !PUBLIC_SOURCES.includes(payload.s) ||
      payload.v !== 1 || !Array.isArray(payload.p) ||
      payload.p.length < 1 || payload.p.length > 32 ||
      !Array.isArray(payload.t) || payload.t.length > 600 ||
      payload.p.some(p => !Array.isArray(p) || !clean(p[0]) ||
        !positive(p[1]) || p[1] < 30 || p[1] > 14400 ||
        !positive(p[2]) || p[2] < 30 || p[2] > 300) ||
      payload.t.some(t => !t || !Number.isInteger(t.p) || t.p < 0 ||
        t.p >= payload.p.length || !clean(t.n, 160))) return null;
  const duration = payload.p.reduce((sum, p) => sum + p[1], 0);
  if (duration < 60 || duration > 14400) return null;
  const isDistance = payload.g === 'distance';
  if (payload.g !== undefined && !isDistance) return null;
  // A signed GPS workout must create a real collectible identity, never
  // quietly fall back to a non-collectible link with missing song metadata.
  if (isDistance && (!payload.t.length ||
      payload.t.some(song=>!clean(song.a,120)))) return null;
  if (isDistance && (!Array.isArray(payload.m) || payload.m.length !== payload.p.length ||
      payload.m.some(m => !Number.isSafeInteger(m) || m < 50 || m > 100000)))
    return null;
  const meters = isDistance ? payload.m.reduce((sum,m)=>sum+m,0) : null;
  if (isDistance && (meters < 1000 || meters > 200000)) return null;
  if (!isDistance && payload.m !== undefined) return null;
  return { name: clean(payload.n) || 'Séance musicale', source: payload.s,
    durationSec: Math.round(duration), bpm: null, tracks: payload.t.length,
    phases: payload.p.length,
    goalMode: isDistance ? 'distance' : 'time',
    ...(isDistance ? {distanceMeters:meters} : {}),
    profile: payload.p.map(p => [Math.round(p[1]), Math.round(p[2])]) };
}

export function publicRow(row) {
  const storedProfile = row.profile_json ? JSON.parse(row.profile_json) : null;
  // Older playlists already contain per-track BPMs in their payload_json.
  // Reconstruct their graph at read time: no migration and no rewritten shares.
  const profile = storedProfile || (row.kind === 'runmix'
    ? legacyRunMixBpmProfile(row.legacy_runmix_json ?? row.payload_json) : null);
  return {
    id: row.id + D1_ID_OFFSET, kind: row.kind, source: row.source, name: row.name,
    durationSec: row.duration_sec, bpm: row.bpm, tracks: row.tracks,
    phases: row.phases, ...(profile ? { profile } : {}),
    createdAt: row.created_at, views: row.views, imports: row.imports,
    ...(row.payload_v===1 && row.kind==='workout' ? {
      goalMode: row.workout_goal==='distance' ? 'distance' : 'time',
      ...(row.workout_goal==='distance' && Number.isSafeInteger(row.workout_distance_meters)
        ? {distanceMeters:row.workout_distance_meters} : {}),
    } : {}),
    ...(row.payload_v===2 && row.goal_mode==='distance' &&
        Number.isSafeInteger(row.target_meters) &&
        Number.isSafeInteger(row.deadline_sec)
      ? {goalMode:'distance',targetMeters:row.target_meters,deadlineSec:row.deadline_sec}
      : {}),
  };
}

async function rateLimit(request, env, action, windowMs, cap) {
  if (!env.CATALOG_RATE_SALT || !request.headers.get('cf-connecting-ip')) return false;
  const now = Date.now();
  const client = request.headers.get('cf-connecting-ip');
  const agent = (request.headers.get('user-agent') || '').slice(0, 120);
  const window = Math.floor(now / windowMs);
  const source = `${env.CATALOG_RATE_SALT}:${client}:${agent}:${action}:${window}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const bucket = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  const row = await env.DB.prepare(
    'INSERT INTO publish_quotas (bucket, uses, expires_at) VALUES (?, 1, ?) ' +
    'ON CONFLICT(bucket) DO UPDATE SET uses = uses + 1 WHERE uses < ? RETURNING uses'
  ).bind(bucket, (window + 1) * windowMs, cap).first();
  // Opportunistic cleanup; the hashes never contain raw IP addresses.
  if (Math.random() < 0.005) {
    try { await env.DB.prepare('DELETE FROM publish_quotas WHERE expires_at < ?')
      .bind(now - 86400000).run(); } catch { /* availability beats cleanup */ }
  }
  return Boolean(row);
}

async function d1Request(request, env, url) {
  const path = url.pathname;
  const db = env.DB;
  if (!db) return json({ error: 'catalog_database_unavailable' }, 503);
  if (path === '/api/shared' && request.method === 'GET') {
    const kind = ['runmix', 'workout'].includes(url.searchParams.get('kind'))
      ? url.searchParams.get('kind') : 'all';
    const source = PUBLIC_SOURCES.includes(url.searchParams.get('source'))
      ? url.searchParams.get('source') : 'all';
    const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'recent';
    const goalMode = ['time','distance'].includes(url.searchParams.get('goalMode'))
      ? url.searchParams.get('goalMode') : 'all';
    const rawPage = Number(url.searchParams.get('page'));
    const page = Number.isSafeInteger(rawPage) ? Math.max(1, Math.min(rawPage, 10000)) : 1;
    const predicates = [], args = [];
    if (cardsEnabled(env)) predicates.push('NOT EXISTS(SELECT 1 FROM workout_card_aliases a WHERE a.alias_share_id=shared_items.id)');
    if (kind !== 'all') { predicates.push('kind = ?'); args.push(kind); }
    // The workout catalogue lists only PLAYABLE musical sessions. Historical
    // V2 publishable sporting challenge rules never belong in this collection.
    if (kind === 'workout') predicates.push(
      "json_valid(payload_json) AND json_extract(payload_json,'$.v')=1");
    if (source !== 'all') { predicates.push('source = ?'); args.push(source); }
    // Filter before sorting/page 1. Legacy v1 workout shares are timed.
    // Distinct from the existing v2 sporting challenge cards.
    if (goalMode !== 'all') {
      predicates.push("kind='workout' AND json_valid(payload_json) AND " +
        "json_extract(payload_json,'$.v')=1 AND " +
        (goalMode==='distance'
          ? "json_extract(payload_json,'$.g')='distance'"
          : "COALESCE(json_extract(payload_json,'$.g'),'time')='time'"));
    }
    const where = predicates.length ? ' WHERE ' + predicates.join(' AND ') : '';
    const count = await db.prepare('SELECT COUNT(*) AS total FROM shared_items' + where)
      .bind(...args).first();
    const order = sort === 'popular' ? 'imports DESC, id DESC' : 'id DESC';
    const result = await db.prepare(
      'SELECT id,kind,source,name,duration_sec,bpm,tracks,phases,profile_json,created_at,views,imports, ' +
      "CASE WHEN kind='runmix' AND profile_json IS NULL THEN payload_json ELSE NULL END AS legacy_runmix_json, " +
      "CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.v') END AS payload_v, " +
      "CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.goalMode') END AS goal_mode, " +
      "CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.targetMeters') END AS target_meters, " +
      "CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.deadlineSec') END AS deadline_sec, " +
      "CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.g') END AS workout_goal, " +
      "CASE WHEN json_valid(payload_json) AND json_extract(payload_json,'$.g')='distance' " +
      "THEN (SELECT SUM(value) FROM json_each(payload_json,'$.m')) END AS workout_distance_meters " +
      'FROM shared_items' + where + ' ORDER BY ' + order + ' LIMIT 20 OFFSET ?'
    ).bind(...args, (page - 1) * 20).all();
    const items = (result.results || []).map(publicRow);
    try {
      const names = await authorFor(db, (result.results || []).map(row => row.id));
      for (const item of items) {
        const name = names.get(item.id - D1_ID_OFFSET);
        if (name) item.author = name;
      }
    } catch { /* Old public catalogue must stay available until D1 migration. */ }
    if (cardsEnabled(env)) {
      const people=await cardPeople(db,(result.results||[]).map(x=>x.id));
      for (const item of items) {
        const info=people.get(item.id-D1_ID_OFFSET);
        if (info) { item.owner=info.owner; item.creator=info.creator; }
      }
    }
    return json({ total: count?.total ?? 0, page, pageSize: 20,
      items }, 200, { 'cache-control': 'public, max-age=30' });
  }
  if (path === '/api/shared' && request.method === 'POST') {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 512 * 1024 + 256) {
      return json({ error: 'invalid_share' }, 400);
    }
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: 'invalid_share' }, 400); }
    const isDistanceV2=input?.kind==='workout' && input?.payload?.v===2;
    const isMusicalDistance=input?.kind==='workout' && input?.payload?.v===1 &&
      input?.payload?.g==='distance';
    if (isMusicalDistance && !cardsEnabled(env))
      return json({error:'collection_not_ready'},503);
    if (isDistanceV2 && (!cardsEnabled(env) || env.DISTANCE_CHALLENGES_ENABLED!=='true')) {
      return json({error:'distance_challenges_not_ready'},503);
    }
    const meta = validate(input?.kind, input?.payload);
    if (!meta) return json({ error: 'invalid_share' }, 400);
    // Canonical challenge publication requires a valid device account.
    // Creating a card never grants the achievement or ownership.
    if ((isDistanceV2 || isMusicalDistance) &&
        !request.headers.has('authorization')) {
      return json({error:'login_required'},401);
    }
    if (!env.CATALOG_RATE_SALT) return json({ error: 'catalog_write_not_configured' }, 503);
    if (!(await rateLimit(request, env, 'publish', 86400000, 20))) {
      return json({ error: 'retry_later' }, 429);
    }
    const hasIdentity = request.headers.has('authorization');
    let author = null;
    if (hasIdentity) {
      // A stale or revoked login MUST fail, not silently become an anonymous post.
      await ensureCommunitySchema(db);
      author = await devicePublisher(db, request);
      if (!author) return json({ error: 'account_session_expired' }, 401);
    }
    if (input.kind === 'workout' && cardsEnabled(env)) {
      await requireCardSchema(db);
      const unique = await publishUniqueWorkout(db,meta.canonicalPayload??input.payload,meta,author);
      if (unique) {
        const publicId=unique.id+D1_ID_OFFSET;
        return json({id:publicId,created:unique.created,
          url:'https://beatonstep.app/partages.html?id='+publicId}, unique.created?201:200);
      }
      if (isMusicalDistance) return json({error:'workout_identity_unavailable'},422);
    }
    const createdAt = Date.now();
    const insert = db.prepare(
      'INSERT INTO shared_items ' +
      '(kind,source,name,duration_sec,bpm,tracks,phases,profile_json,payload_json,created_at) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).bind(input.kind, meta.source, meta.name, meta.durationSec, meta.bpm, meta.tracks,
      meta.phases, meta.profile ? JSON.stringify(meta.profile) : null,
      JSON.stringify(input.payload), createdAt);
    // D1 batches are transactional. Either BOTH the card and its signature
    // commit, or neither is published. Keep the anonymous path unchanged.
    const result = author
      ? (await db.batch([
          insert, db.prepare('INSERT INTO signed_shares(share_id,user_id) VALUES(last_insert_rowid(),?)')
            .bind(author.id),
        ]))[0]
      : await insert.run();
    const id = result.meta?.last_row_id;
    const publicId = id + D1_ID_OFFSET;
    if (!Number.isSafeInteger(id) || id < 1 || publicId > 999_999_999_999_999) {
      throw Error('missing_insert_id');
    }
    return json({ id: publicId, url: 'https://beatonstep.app/partages.html?id=' + publicId }, 201);
  }
  const match = /^\/api\/shared\/([1-9][0-9]{0,14})(?:\/(view|import))?$/.exec(path);
  if (!match) return json({ error: 'not_found' }, 404);
  const publicId = Number(match[1]);
  // Legacy numeric URLs must expire, never silently resolve to another D1 item.
  if (!Number.isSafeInteger(publicId) || publicId <= D1_ID_OFFSET) {
    return json({ error: 'expired_share' }, 404);
  }
  const incomingId = publicId - D1_ID_OFFSET;
  const id = cardsEnabled(env) ? await canonicalShareId(db,incomingId) : incomingId;
  const action = match[2];
  if (!action && request.method === 'GET') {
    const row = await db.prepare('SELECT * FROM shared_items WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'expired_share' }, 404);
    const payload=JSON.parse(row.payload_json);
    const rule=challengeRule(payload);
    const item = { ...publicRow(row), ...(rule ?? {}), payload,
      ...(row.kind==='workout' && payload.v===1 ? {
        goalMode:payload.g==='distance'?'distance':'time',
        ...(payload.g==='distance' && Array.isArray(payload.m)
          ? {distanceMeters:payload.m.reduce((sum,m)=>sum+m,0)} : {}),
      } : {}) };
    try {
      const author = (await authorFor(db, [row.id])).get(row.id);
      if (author) item.author = author;
    } catch { /* Pre-migration catalogue remains public. */ }
    if (cardsEnabled(env)) {
      const people=await cardPeople(db,[id]);
      const info=people.get(id);
      if (info) {
        item.owner=info.owner; item.creator=info.creator;
        // #449: a public share can show its current creator and owner, but
        // past owners and gift/steal reasons are private account history.
        // Never include ownershipHistory in an anonymous response (including
        // cacheable catalogue previews).
      }
    }
    return json(item, 200, { 'cache-control': 'public, max-age=30' });
  }
  if (action && request.method === 'POST') {
    const exists = await db.prepare('SELECT id FROM shared_items WHERE id = ?').bind(id).first();
    if (!exists) return json({ error: 'expired_share' }, 404);
    const allowed = await rateLimit(request, env, action + ':' + id,
      action === 'view' ? 1800000 : 86400000, 1);
    if (!allowed) return json({ counted: false });
    await db.prepare('UPDATE shared_items SET ' +
      (action === 'view' ? 'views' : 'imports') + ' = ' +
      (action === 'view' ? 'views' : 'imports') + ' + 1 WHERE id = ?').bind(id).run();
    return json({ counted: true });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

async function legacyRequest(request, url) {
  // Until the D1 rollout, keep the old catalogue endpoint alive for mobile clients.
  // No GitHub Actions, private credentials or persistent Worker storage are involved.
  const upstream = LEGACY_API + url.pathname + url.search;
  const headers = new Headers(request.headers);
  headers.delete('cookie');
  headers.delete('authorization');
  headers.delete('host');
  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });
  const outgoing = new Headers(response.headers);
  outgoing.set('access-control-allow-origin', '*');
  return new Response(response.body, { status: response.status, headers: outgoing });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      let schemaReady = false;
      if (env.DB) {
        try {
          await env.DB.prepare('SELECT id FROM shared_items LIMIT 1').first();
          await env.DB.prepare('SELECT bucket FROM publish_quotas LIMIT 1').first();
          schemaReady = true;
        } catch (error) {
          console.warn('D1 catalogue schema is not ready');
        }
      }
      // Readiness is public schema/flag metadata only: no users, runs, card
      // owners, gifts, tokens or other private account records are returned.
      const sport={
        schemaReady:false,
        worldCardsEnabled:env.SPORT_WORLD_CARDS_ENABLED==='true',
        giftsEnabled:env.SPORT_WORLD_GIFTS_ENABLED==='true',
        autoAwardsEnabled:env.SPORT_AUTO_AWARDS_ENABLED==='true',
      };
      if(env.DB){
        try{
          const row=await env.DB.prepare(`SELECT COUNT(*) AS found FROM sqlite_master
            WHERE (type='table' AND name IN (
              'sport_world_cards','sport_verified_runs',
              'sport_card_achievements','sport_card_ownership_events',
              'sport_card_gift_links'))
            OR (type='trigger' AND name IN (
              'sport_card_owner_account_deletion',
              'sport_verified_run_award_v1'))`).first();
          sport.schemaReady=Number(row?.found)===7;
        }catch{
          // A missing or disconnected D1 never takes down public health.
        }
      }
      return json({ status: 'ok', catalog: env.CATALOG_BACKEND === 'd1' ? 'd1' : 'legacy',
        database: Boolean(env.DB), schemaReady,
        publishingConfigured: Boolean(env.CATALOG_RATE_SALT),
        sport });
    }
    if (url.pathname.startsWith('/api/')) {
      // Private moderation is isolated from the CORS-enabled public share API.
      if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/')) {
        return adminRequest(request, env, url);
      }
      if (url.pathname.startsWith('/api/strava/')) {
        return stravaRequest(request, env, url);
      }
      // Public trophy catalogue: only server-confirmed cards, never V2
      // publishable workout challenges or authenticated private histories.
      if (url.pathname === '/api/sport/cards' ||
          url.pathname.startsWith('/api/sport/cards/')) {
        if (request.method !== 'GET') return json({error:'method_not_allowed'},405);
        if (env.SPORT_WORLD_CARDS_ENABLED !== 'true' || !env.DB ||
            env.CATALOG_BACKEND !== 'd1')
          return json({error:'sport_catalog_unavailable'},503);
        try {
          return await readPublicSportCards(env.DB,url,{
            telemetryEnabled:env.SPORT_ASYNC_TELEMETRY_ENABLED==='true',
          });
        } catch (error) {
          // A new advisory table may not exist until the first review/cron.
          // Never make already-earned world cards disappear because of it.
          if(env.SPORT_ASYNC_TELEMETRY_ENABLED==='true' &&
             String(error).includes('sport_card_telemetry_')){
            try{return await readPublicSportCards(env.DB,url,{telemetryEnabled:false});}
            catch{ /* preserve the normal API failure below */ }
          }
          console.error('sport catalogue read failure',String(error?.name||'unknown'));
          return json({error:'sport_catalog_unavailable'},503);
        }
      }
      if (url.pathname === '/api/account' || url.pathname.startsWith('/api/account/')) {
        return accountRequest(request, env, url, ctx);
      }
      if (request.method === 'OPTIONS') return new Response(null, {
        status: 204, headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type',
        },
      });
      if (!/^\/api\/shared(?:\/|$)/.test(url.pathname)) return json({ error: 'not_found' }, 404);
      if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ error: 'method_not_allowed' }, 405);
      }
      try {
        return env.CATALOG_BACKEND === 'd1'
          ? await d1Request(request, env, url)
          : await legacyRequest(request, url);
      } catch (error) {
        console.error('shared catalog request failed', String(error?.message || error).slice(0, 100));
        return json({ error: 'share_unavailable' }, 503);
      }
    }
    if (url.pathname === '/partages.html') {
      return sharePageResponse(request, env, url);
    }
    // Resolve the friendly gift URL directly, retaining its URL fragment in the browser.
    if ((url.pathname === '/cadeau' || url.pathname === '/cadeau/') &&
        (request.method === 'GET' || request.method === 'HEAD')) {
      const assetUrl = new URL('/cadeau.html', url);
      assetUrl.hash = '';
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event,env,ctx){
    if(env.SPORT_ASYNC_TELEMETRY_ENABLED!=='true' || !env.DB)return;
    ctx.waitUntil((async()=>{
      await ensureSportTelemetrySchema(env.DB);
      await processPendingSportTelemetryReviews(env.DB);
    })().catch(()=>{console.warn('sport telemetry review queue unavailable');}));
  },
};
