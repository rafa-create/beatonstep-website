import { CARD_ID_OFFSET, requireCardSchema } from './cards.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
}});
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
export const hashGiftToken=async token=>hex(new Uint8Array(
  await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))
));
export const validGiftToken=token=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
const publicId=id=>id+CARD_ID_OFFSET;

export async function packState(db,userId) {
  await requireCardSchema(db);
  const claim=await db.prepare('SELECT share_id FROM workout_pack_claims WHERE user_id=?')
    .bind(userId).first();
  const stock=await db.prepare(`SELECT COUNT(*) AS total FROM workout_cards
    WHERE pack_eligible=1 AND owner_user_id IS NULL`).first();
  const available=Number(stock?.total)||0;
  return {
    available:available>0&&!claim,
    remaining:available,
    alreadyOpened:Boolean(claim),
    // A conservative introductory anti-hoarding rule.
    maxPacksPerAccount:1,
  };
}

export async function openPack(db,userId) {
  await requireCardSchema(db);
  const now=Date.now();
  // The history and first-pack claim are inserted by SQL triggers, atomically
  // with this single guarded UPDATE; no SELECT-then-UPDATE lottery race.
  const card=await db.prepare(`UPDATE workout_cards
    SET owner_user_id=?,acquired_at=?,last_reason='pack',pack_eligible=0
    WHERE share_id=(
      SELECT share_id FROM workout_cards
      WHERE pack_eligible=1 AND owner_user_id IS NULL
      ORDER BY RANDOM() LIMIT 1
    ) AND owner_user_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM workout_pack_claims WHERE user_id=?)
    RETURNING share_id`).bind(userId,now,userId).first();
  if (!card) return json({error:'pack_unavailable',...(await packState(db,userId))},409);
  const share=await db.prepare('SELECT name,imports,profile_json FROM shared_items WHERE id=?')
    .bind(card.share_id).first();
  return json({opened:true,card:{
    id:publicId(card.share_id),name:share.name,imports:share.imports,
    profile:cardProfile(share.profile_json),
    url:'https://beatonstep.app/partages.html?id='+publicId(card.share_id),
  }});
}

// Public workout profiles are a compact ordered list of [duration in seconds,
// target cadence]. Never fabricate an effort curve from imports or card IDs.
const cardProfile=value=>{
  if (!value) return null;
  try {
    const phases=JSON.parse(value);
    return Array.isArray(phases)&&phases.length>=1&&phases.length<=32&&
      phases.every(p=>Array.isArray(p)&&p.length===2&&
        Number.isFinite(p[0])&&p[0]>0&&Number.isFinite(p[1])&&p[1]>0)
      ?phases:null;
  } catch { return null; }
};

export async function myCollection(db,userId) {
  await requireCardSchema(db);
  const results=await db.prepare(`SELECT c.share_id,x.name,x.imports,x.created_at,x.profile_json,
    creator.handle AS creator
    FROM workout_cards c JOIN shared_items x ON x.id=c.share_id
    LEFT JOIN community_users creator ON creator.id=c.creator_user_id
    WHERE c.owner_user_id=? ORDER BY c.acquired_at DESC,c.share_id DESC
    LIMIT 200`).bind(userId).all();
  return json({items:(results.results||[]).map(r=>({
    id:publicId(r.share_id),name:r.name,imports:r.imports,
    createdAt:r.created_at,creator:r.creator||null,
    profile:cardProfile(r.profile_json),
  }))});
}

/**
 * A card owner can issue a short-lived single-use gift link. Ownership is NOT
 * changed here: the recipient must sign in/create a community account and
 * explicitly accept. Old links expire or become unusable after a transfer.
 */
export async function createGift(db,userId,id) {
  if (!Number.isSafeInteger(id)||id<=CARD_ID_OFFSET) return json({error:'invalid_card'},400);
  await requireCardSchema(db);
  const shareId=id-CARD_ID_OFFSET;
  const owned=await db.prepare('SELECT share_id FROM workout_cards WHERE share_id=? AND owner_user_id=?')
    .bind(shareId,userId).first();
  if(!owned) return json({error:'card_not_owned'},403);
  const now=Date.now();
  const count=await db.prepare(`SELECT COUNT(*) AS total FROM workout_card_gifts
    WHERE share_id=? AND expected_owner_id=? AND redeemed_at IS NULL AND expires_at>?`)
    .bind(shareId,userId,now).first();
  if ((Number(count?.total)||0)>=3) return json({error:'gift_limit'},429);
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  // The owner check is re-evaluated inside the INSERT to handle a concurrent
  // transfer that happens between the initial SELECT and link creation.
  const result=await db.prepare(`INSERT INTO workout_card_gifts
    (token_hash,share_id,expected_owner_id,expires_at)
    SELECT ?,share_id,owner_user_id,? FROM workout_cards
    WHERE share_id=? AND owner_user_id=?`)
    .bind(await hashGiftToken(token),now+7*86400000,shareId,userId).run();
  if(result.meta?.changes!==1) return json({error:'card_not_owned'},409);
  return json({url:'https://beatonstep.app/cadeau.html#gift='+token,
    expiresAt:now+7*86400000,id});
}

export async function giftStatus(db,token) {
  if (!validGiftToken(token)) return json({error:'invalid_gift'},400);
  await requireCardSchema(db);
  const row=await db.prepare(`SELECT g.share_id,x.name,x.profile_json,x.duration_sec,g.expires_at
    FROM workout_card_gifts g JOIN shared_items x ON x.id=g.share_id
    JOIN workout_cards c ON c.share_id=g.share_id
    WHERE g.token_hash=? AND g.expires_at>? AND g.redeemed_at IS NULL
    AND c.owner_user_id IS g.expected_owner_id`)
    .bind(await hashGiftToken(token),Date.now()).first();
  return row?json({available:true,card:{
    id:publicId(row.share_id),name:row.name,profile:cardProfile(row.profile_json),
    durationSec:row.duration_sec,expiresAt:row.expires_at,
  }}):json({error:'gift_unavailable'},404);
}

export async function claimGift(db,userId,token) {
  if (!validGiftToken(token)) return json({error:'invalid_gift'},400);
  await requireCardSchema(db);
  const tokenHash=await hashGiftToken(token);
  const now=Date.now();
  const gift=await db.prepare(`SELECT share_id,expected_owner_id FROM workout_card_gifts
    WHERE token_hash=? AND expires_at>? AND redeemed_at IS NULL`)
    .bind(tokenHash,now).first();
  if (!gift) return json({error:'gift_unavailable'},404);
  if (gift.expected_owner_id===userId) return json({error:'gift_self_claim'},409);
  // D1 batch = one transaction. Only the expected current owner may transfer;
  // a second redemption or an older link cannot override a newer owner.
  const actions=await db.batch([
    db.prepare(`UPDATE workout_cards SET owner_user_id=?,last_reason='gift',acquired_at=?
      WHERE share_id=? AND owner_user_id IS ?
      AND EXISTS(SELECT 1 FROM workout_card_gifts WHERE token_hash=?
        AND redeemed_at IS NULL AND expires_at>?)`)
      .bind(userId,now,gift.share_id,gift.expected_owner_id,tokenHash,now),
    db.prepare(`UPDATE workout_card_gifts SET redeemed_at=?,redeemed_by=?
      WHERE token_hash=? AND redeemed_at IS NULL AND expires_at>?
        AND EXISTS(SELECT 1 FROM workout_cards WHERE share_id=?
          AND owner_user_id=?)`).bind(now,userId,tokenHash,now,gift.share_id,userId),
  ]);
  if (actions[0]?.meta?.changes!==1||actions[1]?.meta?.changes!==1)
    return json({error:'gift_unavailable'},409);
  return json({claimed:true,id:publicId(gift.share_id)});
}
