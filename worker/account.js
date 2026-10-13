import { cardsEnabled } from './cards.js';
import { accountLibraryRequest } from './account-library.js';
import { readSportWorldCollection } from './sport-world-collection.js';
import { packState,openPack,myCollection,myChallengeAchievements,giftStatus,claimGift,createGift } from './pack.js';

// Optional community identities for the public catalogue.
// Browser sessions and mobile publish-only grants are intentionally separate from admin.
const enc = new TextEncoder();
const COOKIE = '__Host-bos_community';
const DAY = 86400000;
const SESSION_MS = 30 * DAY;
const LINK_MS = 3 * 60 * 1000;
// The schema is installed manually with migrations/0003_community_profiles.sql.
// Never mutate production D1 schema during a public HTTP request.
export async function ensureCommunitySchema(db) {
  if (!db) throw Error('database_unavailable');
  await db.prepare('SELECT id FROM community_users LIMIT 1').first();
}
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: {
    'content-type':'application/json; charset=utf-8', 'cache-control':'no-store',
    'x-content-type-options':'nosniff', ...headers,
  },
});
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
const decodeHex = input => new Uint8Array((input.match(/../g) || []).map(v => parseInt(v, 16)));
async function passHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({
    name:'PBKDF2', hash:'SHA-256', salt:decodeHex(salt), iterations:100000,
  }, key, 256)));
}
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length,b.length); i++) diff |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0);
  return diff === 0;
};
const cookie = (token, seconds) => COOKIE + '=' + token +
  '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + seconds;
function browserToken(request) {
  const entry = (request.headers.get('cookie') || '').split(';').map(s=>s.trim())
    .find(x=>x.startsWith(COOKIE+'='));
  const value = entry?.slice(COOKIE.length+1) || '';
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}
const bearerToken = request => {
  const value = request.headers.get('authorization') || '';
  const match = /^Bearer ([a-f0-9]{64})$/.exec(value);
  return match?.[1] || '';
};
const sameOrigin = request => request.headers.get('origin') === new URL(request.url).origin;
async function jsonBody(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return null;
  if (Number(request.headers.get('content-length') || '0') > 4096) return null;
  const raw = await request.text();
  if (enc.encode(raw).length > 4096) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
async function personByToken(db, token, table) {
  if (!token) return null;
  return db.prepare(`SELECT u.id,u.email,u.handle FROM ${table} s
    JOIN community_users u ON u.id = s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`)
    .bind(await hash(token), Date.now()).first();
}
async function webUser(db, req) { return personByToken(db, browserToken(req), 'community_sessions'); }
export async function devicePublisher(db, request) {
  return personByToken(db, bearerToken(request), 'community_devices');
}
async function limited(db, env, request, kind, limit, period, identity = null) {
  if (!env.CATALOG_RATE_SALT) return false;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now(), bucket = await hash(env.CATALOG_RATE_SALT + ':community:' + kind + ':' + (identity===null?ip:'identity:'+identity));
  const row = await db.prepare(`INSERT INTO community_auth_limits(bucket,count,expires_at)
    VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET
    count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
    RETURNING count`).bind(bucket, now+period, now, now).first();
  return Boolean(row && row.count <= limit);
}
async function createSession(db, user) {
  const token=randomToken();
  await db.prepare('INSERT INTO community_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .bind(await hash(token), user.id, Date.now()+SESSION_MS).run();
  return reply({authenticated:true,handle:user.handle},200,{'set-cookie':cookie(token,SESSION_MS/1000)});
}
async function signup(db,env,req) {
  // Public signup is opt-in until the legal notices and acceptance tests are complete.
  if (env.COMMUNITY_SIGNUPS_ENABLED !== 'true') return reply({error:'registration_closed'},503);
  if (!(await limited(db,env,req,'register',5,DAY))) return reply({error:'retry_later'},429);
  const b=await jsonBody(req);
  const email=typeof b?.email==='string'?b.email.trim().toLowerCase():'';
  const handle=typeof b?.handle==='string'?b.handle.trim().toLowerCase():'';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 ||
      !/^[a-z0-9][a-z0-9_.-]{2,23}$/.test(handle) ||
      typeof b?.password!=='string' || b.password.length<6 || b.password.length>128 ||
      b.accept_terms!==true) return reply({error:'invalid_registration'},400);
  const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
  const user={id:crypto.randomUUID(),email,handle};
  try {
    await db.prepare(`INSERT INTO community_users(id,email,handle,password_salt,password_hash,created_at)
      VALUES(?,?,?,?,?,?)`).bind(user.id,email,handle,salt,await passHash(b.password,salt),Date.now()).run();
  } catch(error) {
    if (/unique/i.test(String(error))) return reply({error:'account_exists'},409);
    throw error;
  }
  return createSession(db,user);
}
async function signin(db,env,req) {
  if (!(await limited(db,env,req,'login',8,15*60000))) return reply({error:'retry_later'},429);
  const b=await jsonBody(req);
  const email=typeof b?.email==='string'?b.email.trim().toLowerCase():'';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof b?.password!=='string' || b.password.length>128) return reply({error:'invalid_credentials'},401);
  const user=await db.prepare('SELECT * FROM community_users WHERE email=?').bind(email).first();
  const digest=await passHash(b.password,user?.password_salt||'00'.repeat(16));
  if (!user || !safeEqual(digest,user.password_hash)) return reply({error:'invalid_credentials'},401);
  return createSession(db,user);
}
// Password reset never authenticates the caller or exposes whether an e-mail
// exists. E-mail sends run after the generic response in the Worker context.
// A verified sender/domain and provider credentials must be configured first.
const RESET_MS = 20 * 60 * 1000;
const RESET_LINK_ORIGIN = 'https://beatonstep.app';
const resetGeneric = () => reply({accepted:true});
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254;
const validResetPassword = value => typeof value==='string' &&
  value.length>=6&&value.length<=128;

async function sendResetMail(env,email,token) {
  const link=RESET_LINK_ORIGIN+'/compte.html#reset='+token;
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      authorization:'Bearer '+env.RESEND_API_KEY,
      'content-type':'application/json',
    },
    body:JSON.stringify({
      from:env.PASSWORD_RESET_EMAIL_FROM,
      to:[email],
      subject:'BeatOnStep — réinitialiser votre mot de passe',
      text:'Vous avez demandé un nouveau mot de passe BeatOnStep.\n\n'+
        'Ouvrez ce lien dans les 20 minutes :\n'+link+'\n\n'+
        'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.\n',
    }),
  });
  if(!response.ok)throw Error('reset_email_provider_rejected');
}

async function requestPasswordReset(db,env,req,ctx) {
  // Fail closed for ALL visitors when the service has not been provisioned.
  if(typeof env.RESEND_API_KEY!=='string'||!env.RESEND_API_KEY||
     typeof env.PASSWORD_RESET_EMAIL_FROM!=='string'||
     !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.PASSWORD_RESET_EMAIL_FROM)){
    return reply({error:'password_reset_unavailable'},503);
  }
  if(!(await limited(db,env,req,'password-reset-ip',8,60*60*1000))){
    return reply({error:'retry_later'},429);
  }
  const b=await jsonBody(req);
  const email=typeof b?.email==='string'?b.email.trim().toLowerCase():'';
  if(!validEmail(email))return resetGeneric();
  // A salted identity bucket protects mailboxes against distributed abuse;
  // neither this hash nor the account ID is sent to clients.
  if(!(await limited(db,env,req,'password-reset-address',3,DAY,email))){
    return resetGeneric();
  }
  const user=await db.prepare('SELECT id FROM community_users WHERE email=?')
    .bind(email).first();
  if(!user)return resetGeneric();
  const token=randomToken();
  const tokenHash=await hash(token);
  const now=Date.now();
  await db.prepare(`INSERT INTO community_password_reset_tokens
    (user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      token_hash=excluded.token_hash,
      created_at=excluded.created_at,expires_at=excluded.expires_at`)
    .bind(user.id,tokenHash,now,now+RESET_MS).run();

  // Route timing and response do not disclose account existence. Never log
  // the e-mail address, secret token or reset URL.
  const delivery=sendResetMail(env,email,token).catch(async()=>{
    console.error('password reset delivery failed');
    try{
      await db.prepare('DELETE FROM community_password_reset_tokens WHERE token_hash=?')
        .bind(tokenHash).run();
    }catch{console.error('password reset cleanup failed')}
  });
  if(ctx?.waitUntil)ctx.waitUntil(delivery);
  else await delivery; // supported when accountRequest is invoked directly.
  return resetGeneric();
}

async function confirmPasswordReset(db,env,req) {
  if(!(await limited(db,env,req,'password-reset-confirm',12,15*60*1000))){
    return reply({error:'retry_later'},429);
  }
  const b=await jsonBody(req);
  const token=b?.token;
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||
     !validResetPassword(b?.password)){
    return reply({error:'invalid_password_reset'},400);
  }
  const tokenHash=await hash(token);
  const now=Date.now();
  // Cheap preflight for expired/replayed tokens; critical safety still comes
  // from the conditional statements inside the ONE atomic D1 batch below.
  const existing=await db.prepare(`SELECT user_id FROM community_password_reset_tokens
    WHERE token_hash=? AND expires_at>?`).bind(tokenHash,now).first();
  if(!existing)return reply({error:'invalid_password_reset'},400);
  const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
  const digest=await passHash(b.password,salt);
  const eligible=`SELECT user_id FROM community_password_reset_tokens
    WHERE token_hash=? AND expires_at>?`;
  const results=await db.batch([
    db.prepare(`UPDATE community_users SET password_salt=?,password_hash=?
      WHERE id=(${eligible})`).bind(salt,digest,tokenHash,now),
    db.prepare(`DELETE FROM community_sessions
      WHERE user_id=(${eligible})`).bind(tokenHash,now),
    db.prepare(`DELETE FROM community_devices
      WHERE user_id=(${eligible})`).bind(tokenHash,now),
    db.prepare(`DELETE FROM community_link_codes
      WHERE user_id=(${eligible})`).bind(tokenHash,now),
    db.prepare('DELETE FROM community_password_reset_tokens WHERE token_hash=? AND expires_at>?')
      .bind(tokenHash,now),
  ]);
  // Concurrent attempts can see the preflight, but only one batch can
  // consume the token and update the password; another does zero writes.
  if(results[0]?.meta?.changes!==1||results[4]?.meta?.changes!==1)
    return reply({error:'invalid_password_reset'},400);
  return reply({reset:true},200,{'set-cookie':cookie('',0)});
}

async function exchange(db,req) {
  const b=await jsonBody(req);
  if (!/^[a-f0-9]{64}$/.test(b?.code||'') || !/^[A-Za-z0-9_-]{43,128}$/.test(b?.verifier||'')) {
    return reply({error:'invalid_code'},400);
  }
  const codeHash=await hash(b.code);
  const row=await db.prepare('SELECT * FROM community_link_codes WHERE code_hash=? AND expires_at>?')
    .bind(codeHash,Date.now()).first();
  if (!row) return reply({error:'invalid_code'},401);
  const removed=await db.prepare('DELETE FROM community_link_codes WHERE code_hash=?').bind(codeHash).run();
  if (removed.meta?.changes!==1) return reply({error:'invalid_code'},401);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(b.verifier)));
  const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if (!safeEqual(challenge,row.challenge)) return reply({error:'invalid_code'},401);
  const token=randomToken();
  await db.prepare('INSERT INTO community_devices(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .bind(await hash(token),row.user_id,Date.now()+SESSION_MS).run();
  const user=await db.prepare('SELECT handle FROM community_users WHERE id=?').bind(row.user_id).first();
  return reply({token,handle:user.handle,expiresAt:Date.now()+SESSION_MS});
}
export async function authorFor(db, shareIds) {
  if (!shareIds.length) return new Map();
  const placeholders=shareIds.map(()=>'?').join(',');
  const rows=await db.prepare(`SELECT s.share_id,u.handle FROM signed_shares s
    JOIN community_users u ON u.id=s.user_id WHERE s.share_id IN (${placeholders})`)
    .bind(...shareIds).all();
  return new Map((rows.results||[]).map(x=>[x.share_id,x.handle]));
}
export async function accountRequest(request,env,url,ctx) {
  if (!env.DB || env.CATALOG_BACKEND!=='d1') return reply({error:'account_unavailable'},503);
  try {
    const db=env.DB, path=url.pathname, method=request.method;
    await ensureCommunitySchema(db);
    if (path==='/api/account/profile' && method==='GET') {
      const handle=(url.searchParams.get('handle')||'').toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.-]{2,23}$/.test(handle)) return reply({error:'not_found'},404);
      const user=await db.prepare('SELECT id,handle FROM community_users WHERE handle=?').bind(handle).first();
      if (!user) return reply({error:'not_found'},404);
      const items=await db.prepare(`SELECT x.id,x.name,x.kind,x.source,x.created_at,x.imports
        FROM signed_shares s JOIN shared_items x ON x.id=s.share_id
        WHERE s.user_id=? ORDER BY CASE WHEN x.kind='workout' THEN 0 ELSE 1 END,
          x.imports DESC,x.created_at DESC,x.id DESC LIMIT 100`).bind(user.id).all();
      return reply({handle:user.handle,items:(items.results||[]).map(x=>({
        id:x.id+1000000000000,name:x.name,kind:x.kind,source:x.source,
        createdAt:x.created_at,imports:Number(x.imports)||0,
      }))});
    }
    // Owned musical cards and the original signed creations are different:
    // an author keeps credit and import popularity after giving the card away.
    if (path==='/api/account/device/created-cards' && method==='GET') {
      const member=await devicePublisher(db,request);
      if (!member) return reply({error:'account_session_expired'},401);
      const rows=await db.prepare(`SELECT x.id,x.name,x.imports,x.created_at,
          CASE WHEN c.owner_user_id=? THEN 1 ELSE 0 END AS currently_owned
        FROM signed_shares s JOIN shared_items x ON x.id=s.share_id
        LEFT JOIN workout_cards c ON c.share_id=x.id
        WHERE s.user_id=? AND x.kind='workout'
          AND COALESCE(json_extract(x.payload_json,'$.v'),1)=1
        ORDER BY x.imports DESC,x.created_at DESC,x.id DESC LIMIT 200`)
        .bind(member.id,member.id).all();
      return reply({items:(rows.results||[]).map(x=>({
        id:x.id+1000000000000,name:x.name,imports:Number(x.imports)||0,
        createdAt:x.created_at,owned:x.currently_owned===1
      }))});
    }
    if (path==='/api/account/device/me' && method==='GET') {
      const user=await devicePublisher(db,request);
      return user ? reply({authenticated:true,handle:user.handle}) : reply({authenticated:false},401);
    }
    // #460: personal archives behind the existing, short-lived mobile bearer.
    // These snapshots are never proof for world challenge ownership.
    if (path.startsWith('/api/account/device/library/')) {
      const member=await devicePublisher(db,request);
      if (!member) return reply({error:'account_session_expired'},401);
      return accountLibraryRequest(request,db,url,member.id);
    }
    // Browser account sees the same private archive, using its own session.
    // Writes remain device-only in V1 to avoid cookie-CSRF write paths.
    if (path.startsWith('/api/account/library/') && method==='GET') {
      const member=await webUser(db,request);
      if (!member) return reply({error:'login_required'},401);
      const forwarded=new URL(request.url);
      forwarded.pathname=path.replace('/api/account/library/','/api/account/device/library/');
      return accountLibraryRequest(request,db,forwarded,member.id);
    }
    // #445/#449: new world-sport trophy ledger is NOT the old musical
    // workout_card ledger nor the retired v2 distance musical challenge.
    // Read-only and explicitly gated. Until an independent attestation route
    // is proven, no HTTP endpoint can mint, award or transfer these trophies.
    if (path.startsWith('/api/account/device/sport/') && method==='GET') {
      const member=await devicePublisher(db,request);
      if (!member) return reply({error:'account_session_expired'},401);
      if (env.SPORT_WORLD_CARDS_ENABLED!=='true')
        return reply({error:'world_sport_cards_not_ready'},503);
      return readSportWorldCollection(db,member.id,url);
    }
    if (path.startsWith('/api/account/sport/') && method==='GET') {
      const member=await webUser(db,request);
      if (!member) return reply({error:'login_required'},401);
      if (env.SPORT_WORLD_CARDS_ENABLED!=='true')
        return reply({error:'world_sport_cards_not_ready'},503);
      const forwarded=new URL(request.url);
      forwarded.pathname=path.replace('/api/account/sport/',
        '/api/account/device/sport/');
      return readSportWorldCollection(db,member.id,forwarded);
    }
    // Only the authenticated runner sees their durable sporting achievements.
    // This reads ledger 0005; no challenge-result submission is enabled here.
    if (path==='/api/account/device/achievements' && method==='GET') {
      if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
      const member=await devicePublisher(db,request);
      if (!member) return reply({error:'account_session_expired'},401);
      if (env.DISTANCE_CHALLENGES_ENABLED!=='true') {
        return reply({error:'distance_challenges_not_ready'},503);
      }
      return myChallengeAchievements(db,member.id);
    }
    // Explicit native collection capability. Device bearer grants stay isolated
    // from browser cookies, passwords, account deletion and admin operations.
    if (['/api/account/device/collection','/api/account/device/pack',
         '/api/account/device/pack/open'].includes(path)) {
      if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
      if ((method==='GET' && path.endsWith('/open')) ||
          (method!=='GET' && method!=='POST') ||
          (method==='POST' && !path.endsWith('/open'))) return reply({error:'method_not_allowed'},405);
      const member=await devicePublisher(db,request);
      if (!member) return reply({error:'account_session_expired'},401);
      if (path==='/api/account/device/collection') return myCollection(db,member.id);
      if (path==='/api/account/device/pack') return reply(await packState(db,member.id));
      return openPack(db,member.id);
    }
    if (path==='/api/account/exchange' && method==='POST') return exchange(db,request);
    if (path==='/api/account/gift/preview' && method==='POST') {
      if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
      if (!sameOrigin(request)) return reply({error:'origin_forbidden'},403);
      const data=await jsonBody(request);
      return giftStatus(db,data?.code);
    }
    if (path==='/api/account/device/gift/preview' && method==='POST') {
      if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
      const data=await jsonBody(request);
      // Public preview: no grant necessary, no card transferred by preview.
      return giftStatus(db,data?.code);
    }
    if (path==='/api/account/device/gift/claim' && method==='POST') {
      if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
      const member=await devicePublisher(db,request);
      if (!member) return reply({error:'account_session_expired'},401);
      const data=await jsonBody(request);
      return claimGift(db,member.id,data?.code);
    }
    if (path==='/api/account/device/gift/create' && method==='POST') {
      if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
      const member=await devicePublisher(db,request);
      if (!member) return reply({error:'account_session_expired'},401);
      const data=await jsonBody(request);
      return createGift(db,member.id,data?.id);
    }
    if (path==='/api/account/device/logout' && method==='POST') {
      const token=bearerToken(request);
      if (token) await db.prepare('DELETE FROM community_devices WHERE token_hash=?')
        .bind(await hash(token)).run();
      return reply({ok:true});
    }
    if (path==='/api/account/me' && method==='GET') {
      const user=await webUser(db,request);
      return reply(user?{authenticated:true,handle:user.handle}:{authenticated:false});
    }
    if (['/api/account/pack','/api/account/collection','/api/account/achievements','/api/account/gift'].includes(path)
        && method==='GET') {
      if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
      const user=await webUser(db,request);
      if (!user) return reply({error:'login_required'},401);
      if (path==='/api/account/pack') return reply(await packState(db,user.id));
      if (path==='/api/account/collection') return myCollection(db,user.id);
      if (path==='/api/account/achievements') {
        return env.DISTANCE_CHALLENGES_ENABLED==='true'
          ? myChallengeAchievements(db,user.id)
          : reply({error:'distance_challenges_not_ready'},503);
      }
      return giftStatus(db,url.searchParams.get('code'));
    }
    if (method==='POST'||method==='DELETE') {
      if (!sameOrigin(request)) return reply({error:'origin_forbidden'},403);
      if (path==='/api/account/password-reset/request' && method==='POST')
        return requestPasswordReset(db,env,request,ctx);
      if (path==='/api/account/password-reset/confirm' && method==='POST')
        return confirmPasswordReset(db,env,request);
      if (path==='/api/account/signup' && method==='POST') return signup(db,env,request);
      if (path==='/api/account/login' && method==='POST') return signin(db,env,request);
      if (path==='/api/account/logout' && method==='POST') {
        const token=browserToken(request);
        if (token) await db.prepare('DELETE FROM community_sessions WHERE token_hash=?')
          .bind(await hash(token)).run();
        return reply({authenticated:false},200,{'set-cookie':cookie('',0)});
      }
      const user=await webUser(db,request);
      if (!user) return reply({error:'login_required'},401);
      if (method==='POST' && ['/api/account/pack/open','/api/account/gift/claim','/api/account/gift/create'].includes(path)) {
        if (!cardsEnabled(env)) return reply({error:'collection_not_ready'},503);
        if (path==='/api/account/pack/open') return openPack(db,user.id);
        const data=await jsonBody(request);
        if (path==='/api/account/gift/create') return createGift(db,user.id,data?.id);
        return claimGift(db,user.id,data?.code);
      }
      if (path==='/api/account/connect' && method==='POST') {
        if (!(await limited(db,env,request,'connect',20,15*60000))) return reply({error:'retry_later'},429);
        const b=await jsonBody(request);
        if (!/^[A-Za-z0-9_-]{43}$/.test(b?.challenge||'') ||
            !/^[A-Za-z0-9_-]{16,128}$/.test(b?.state||'')) return reply({error:'invalid_link'},400);
        const code=randomToken();
        await db.prepare('INSERT INTO community_link_codes(code_hash,user_id,challenge,expires_at) VALUES(?,?,?,?)')
          .bind(await hash(code),user.id,b.challenge,Date.now()+LINK_MS).run();
        return reply({code,state:b.state});
      }
      const deleteCard=new RegExp('^/api/account/shared/([1-9][0-9]{0,14})$').exec(path);
      if (deleteCard && method==='DELETE') {
        const publicId=Number(deleteCard[1]);
        if (!Number.isSafeInteger(publicId)||publicId<=1000000000000) {
          return reply({error:'not_found'},404);
        }
        const rowId=publicId-1000000000000;
        if (cardsEnabled(env)) {
          const kind=await db.prepare('SELECT kind FROM shared_items WHERE id=?').bind(rowId).first();
          if (kind?.kind==='workout') return reply({error:'card_is_permanent'},409);
        }
        const deleted=await db.prepare(`DELETE FROM shared_items WHERE id=? AND
          EXISTS (SELECT 1 FROM signed_shares WHERE share_id=? AND user_id=?)`)
          .bind(rowId,rowId,user.id).run();
        return deleted.meta?.changes===1 ? reply({deleted:true})
          : reply({error:'not_found'},404);
      }
      if (path==='/api/account/me' && method==='DELETE') {
        const b=await jsonBody(request);
        if (typeof b?.password!=='string') return reply({error:'invalid_credentials'},401);
        const secret=await db.prepare('SELECT password_hash,password_salt FROM community_users WHERE id=?')
          .bind(user.id).first();
        if (!safeEqual(await passHash(b.password,secret.password_salt),secret.password_hash)) {
          return reply({error:'invalid_credentials'},401);
        }
        // A deleted account cannot leave behind active gift invitations. Its
        // cards become unowned via FK SET NULL, so old links would otherwise
        // unexpectedly match an anonymous card's owner and remain claimable.
        if(cardsEnabled(env)) {
          await db.prepare('DELETE FROM workout_card_gifts WHERE expected_owner_id=?')
            .bind(user.id).run();
        }
        await db.prepare('DELETE FROM signed_shares WHERE user_id=?').bind(user.id).run();
        await db.prepare('DELETE FROM community_devices WHERE user_id=?').bind(user.id).run();
        await db.prepare('DELETE FROM community_link_codes WHERE user_id=?').bind(user.id).run();
        await db.prepare('DELETE FROM community_sessions WHERE user_id=?').bind(user.id).run();
        await db.prepare('DELETE FROM community_users WHERE id=?').bind(user.id).run();
        return reply({deleted:true},200,{'set-cookie':cookie('',0)});
      }
    }
    return reply({error:'not_found'},404);
  } catch(error) {
    console.error('community unavailable',String(error?.message||error).slice(0,90));
    return reply({error:'account_unavailable'},503);
  }
}
