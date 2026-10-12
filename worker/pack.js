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
  const share=await db.prepare("SELECT name,imports,COALESCE(profile_json,json_extract(payload_json,'$.p')) AS profile_json FROM shared_items WHERE id=?")
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
    if(!Array.isArray(phases)||phases.length<1||phases.length>32)return null;
    const compact=phases.map(phase=>{
      if(!Array.isArray(phase))return null;
      // Stored catalogue graph: [duration,PPM].
      // Historic signed workout payload: [label,duration,PPM,track BPM].
      const fromWorkout=phase.length>=3&&typeof phase[0]==='string';
      const duration=fromWorkout?phase[1]:phase[0];
      const ppm=fromWorkout?phase[2]:phase[1];
      return Number.isFinite(duration)&&duration>=30&&duration<=14400&&
        Number.isFinite(ppm)&&ppm>=30&&ppm<=300
        ? [duration,ppm] : null;
    });
    return compact.every(Boolean)?compact:null;
  } catch { return null; }
};

export async function myCollection(db,userId) {
  await requireCardSchema(db);
  const results=await db.prepare(`SELECT c.share_id,x.name,x.imports,x.created_at,COALESCE(x.profile_json,json_extract(x.payload_json,'$.p')) AS profile_json,
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
 * Authenticated PRIVATE achievements. A successful distance challenge remains
 * in this list even after its unique card is gifted or captured by someone else.
 * Do not infer sporting success from ownership history, gifts or pack openings.
 * No GPS route, coordinates or other runner IDs are returned.
 *
 * This is read-only: existing D1 0005 is the legacy achievements ledger until
 * the separate v2 sporting clock/proof acceptance path is deployed.
 */
export async function myChallengeAchievements(db,userId) {
  await requireCardSchema(db);
  const rows=await db.prepare(`SELECT v.share_id,v.first_validated_at,
      s.name,c.owner_user_id,
      (SELECT COUNT(*) FROM workout_challenge_attempts a
       WHERE a.user_id=? AND a.share_id=v.share_id AND a.result='won') AS win_count
    FROM workout_challenge_validations v
    JOIN workout_cards c ON c.share_id=v.share_id
    JOIN shared_items s ON s.id=v.share_id
    WHERE v.user_id=?
      AND json_extract(s.payload_json,'$.v')=2
      AND json_extract(s.payload_json,'$.goalMode')='distance'
    ORDER BY v.first_validated_at DESC,v.share_id DESC LIMIT 200`)
    .bind(userId,userId).all();
  return json({items:(rows.results||[]).map(r=>({
    id:publicId(r.share_id),name:r.name,firstValidatedAt:r.first_validated_at,
    successfulAttempts:Number(r.win_count)||0,
    currentlyOwned:r.owner_user_id===userId,
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
  // Three unclaimed invitations is the maximum stored per card and owner.
  // If the sender lost the URL, allow regeneration by retiring the oldest
  // pending invitation, rather than blocking all future gifts indefinitely.
  const needsRotation=(Number(count?.total)||0)>=3;
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  // The owner check is re-evaluated inside the INSERT to handle a concurrent
  // transfer that happens between the initial SELECT and link creation.
  const insert=db.prepare(`INSERT INTO workout_card_gifts
    (token_hash,share_id,expected_owner_id,expires_at)
    SELECT ?,share_id,owner_user_id,? FROM workout_cards
    WHERE share_id=? AND owner_user_id=?`)
    .bind(await hashGiftToken(token),now+7*86400000,shareId,userId);
  // D1 batch commits atomically: never retire an earlier code without issuing
  // its replacement, and never touch an accepted or another owner's gift.
  const results=needsRotation?await db.batch([
    db.prepare(`DELETE FROM workout_card_gifts WHERE token_hash=(
      SELECT token_hash FROM workout_card_gifts
      WHERE share_id=? AND expected_owner_id=? AND redeemed_at IS NULL AND expires_at>?
      ORDER BY expires_at ASC LIMIT 1
    ) AND EXISTS(SELECT 1 FROM workout_cards
      WHERE share_id=? AND owner_user_id=?)`).bind(shareId,userId,now,shareId,userId),
    insert,
  ]):[await insert.run()];
  if(results.at(-1)?.meta?.changes!==1) return json({error:'card_not_owned'},409);
  return json({url:'https://beatonstep.app/cadeau.html#gift='+token,
    expiresAt:now+7*86400000,id});
}

export async function giftStatus(db,token) {
  if (!validGiftToken(token)) return json({error:'invalid_gift'},400);
  await requireCardSchema(db);
  const row=await db.prepare(`SELECT g.share_id,x.name,COALESCE(x.profile_json,json_extract(x.payload_json,'$.p')) AS profile_json,x.duration_sec,g.expires_at
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
    db.prepare(`UPDATE workout_cards SET owner_user_id=?,last_reason='gift',acquired_at=?,pack_eligible=0
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
