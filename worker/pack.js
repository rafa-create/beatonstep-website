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
    SET owner_user_id=?,acquired_at=?,last_reason='pack'
    WHERE share_id=(
      SELECT share_id FROM workout_cards
      WHERE pack_eligible=1 AND owner_user_id IS NULL
      ORDER BY RANDOM() LIMIT 1
    ) AND owner_user_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM workout_pack_claims WHERE user_id=?)
    RETURNING share_id`).bind(userId,now,userId).first();
  if (!card) return json({error:'pack_unavailable',...(await packState(db,userId))},409);
  const share=await db.prepare('SELECT name,imports FROM shared_items WHERE id=?')
    .bind(card.share_id).first();
  return json({opened:true,card:{
    id:publicId(card.share_id),name:share.name,imports:share.imports,
    url:'https://beatonstep.app/partages.html?id='+publicId(card.share_id),
  }});
}

export async function myCollection(db,userId) {
  await requireCardSchema(db);
  const results=await db.prepare(`SELECT c.share_id,x.name,x.imports,x.created_at,
    creator.handle AS creator
    FROM workout_cards c JOIN shared_items x ON x.id=c.share_id
    LEFT JOIN community_users creator ON creator.id=c.creator_user_id
    WHERE c.owner_user_id=? ORDER BY c.acquired_at DESC,c.share_id DESC
    LIMIT 200`).bind(userId).all();
  return json({items:(results.results||[]).map(r=>({
    id:publicId(r.share_id),name:r.name,imports:r.imports,
    createdAt:r.created_at,creator:r.creator||null,
  }))});
}

export async function giftStatus(db,token) {
  if (!validGiftToken(token)) return json({error:'invalid_gift'},400);
  await requireCardSchema(db);
  const row=await db.prepare(`SELECT g.share_id,x.name,g.expires_at
    FROM workout_card_gifts g JOIN shared_items x ON x.id=g.share_id
    JOIN workout_cards c ON c.share_id=g.share_id
    WHERE g.token_hash=? AND g.expires_at>? AND g.redeemed_at IS NULL
    AND c.owner_user_id IS g.expected_owner_id`)
    .bind(await hashGiftToken(token),Date.now()).first();
  return row?json({available:true,card:{id:publicId(row.share_id),name:row.name}})
    :json({error:'gift_unavailable'},404);
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
  // D1 batch = one transaction. Only the expected current owner may transfer;
  // a second redemption or an older link cannot override a newer owner.
  const actions=await db.batch([
    db.prepare(`UPDATE workout_cards SET owner_user_id=?,last_reason='admin_gift',acquired_at=?
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
