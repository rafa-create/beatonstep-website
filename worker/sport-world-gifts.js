// #447: durable world-sport bearer gifts. NEVER imports musical gift TTL,
// signed shares or the user-controlled activity-history/sport reward path.
import {displaySportCard} from './sport-world-collection.js';

const text=new TextEncoder();
const hex=data=>[...data].map(b=>b.toString(16).padStart(2,'0')).join('');
const validToken=token=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
const digest=async token=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',text.encode(token))));
const res=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
}});
const validCard=id=>Number.isSafeInteger(id)&&id>0&&id<=Number.MAX_SAFE_INTEGER;
const giftUrl=token=>'https://beatonstep.app/cadeau-sport.html#gift='+token;

export async function createSportGift(db,userId,cardId){
  if(!validCard(cardId))return res({error:'invalid_card'},400);
  const code=hex(crypto.getRandomValues(new Uint8Array(32)));
  const now=Date.now();
  const inserted=await db.prepare(`INSERT INTO sport_card_gift_links
    (token_hash,card_id,donor_user_id,donor_epoch,created_at)
    SELECT ?,c.id,c.current_owner_id,c.owner_epoch,?
    FROM sport_world_cards c
    WHERE c.id=? AND c.current_owner_id=? AND c.owner_epoch>=1
    RETURNING card_id,donor_epoch`)
    .bind(await digest(code),now,cardId,userId).first();
  return inserted?res({url:giftUrl(code),id:inserted.card_id,
    ownerEpoch:inserted.donor_epoch,expiresAt:null},201)
    :res({error:'card_not_owned'},403);
}

export async function previewSportGift(db,code){
  if(!validToken(code))return res({error:'invalid_gift'},400);
  const row=await db.prepare(`SELECT g.card_id,g.donor_epoch,g.created_at,
      g.claimed_at,g.donor_user_id,
      c.distance_cm,c.time_unit,c.sub_value,c.difficulty,
      c.current_owner_id,c.owner_epoch,
      u.handle AS donor_handle
    FROM sport_card_gift_links g
    JOIN sport_world_cards c ON c.id=g.card_id
    LEFT JOIN community_users u ON u.id=g.donor_user_id
    WHERE g.token_hash=?`).bind(await digest(code)).first();
  if(!row)return res({error:'gift_not_found'},404);
  const available=row.claimed_at==null&&row.donor_user_id!=null&&
    row.current_owner_id===row.donor_user_id&&row.owner_epoch===row.donor_epoch;
  return res({available,card:{
    id:row.card_id,name:displaySportCard(row.distance_cm,row.time_unit,row.sub_value),
    distanceCm:row.distance_cm,timeUnit:row.time_unit,subValue:row.sub_value,
    difficulty:row.difficulty,
  },donorHandle:row.donor_handle||null,createdAt:row.created_at,
    reason:available?null:row.claimed_at!=null?'already_claimed':'ownership_changed'});
}
export async function claimSportGift(db,recipientId,code){
  if(!validToken(code))return res({error:'invalid_gift'},400);
  const hash=await digest(code);
  const gift=await db.prepare(`SELECT g.card_id,g.donor_user_id,g.donor_epoch,
       g.claimed_at,c.current_owner_id,c.owner_epoch
    FROM sport_card_gift_links g
    JOIN sport_world_cards c ON c.id=g.card_id WHERE g.token_hash=?`)
    .bind(hash).first();
  if(!gift)return res({error:'gift_not_found'},404);
  if(gift.donor_user_id===recipientId)return res({error:'gift_self_claim'},409);
  if(gift.claimed_at!=null||gift.donor_user_id==null||
    gift.current_owner_id!==gift.donor_user_id||
    gift.owner_epoch!==gift.donor_epoch)return res({error:'gift_unavailable'},409);

  const now=Date.now();
  // D1 batch is transactional. First claim the UNIQUE ownership epoch,
  // then update that same guarded card, then consume the bearer token.
  // Concurrent claims / captures / old URLs cannot transfer twice.
  const results=await db.batch([
    db.prepare(`INSERT INTO sport_card_ownership_events
      (card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
      SELECT c.id,c.current_owner_id,?,c.owner_epoch,c.owner_epoch+1,
         'gift_claim',?
      FROM sport_card_gift_links g
      JOIN sport_world_cards c ON c.id=g.card_id
      WHERE g.token_hash=? AND g.claimed_at IS NULL
        AND g.donor_user_id=? AND c.current_owner_id=g.donor_user_id
        AND c.owner_epoch=g.donor_epoch AND c.current_owner_id<>?`)
      .bind(recipientId,now,hash,gift.donor_user_id,recipientId),
    db.prepare(`UPDATE sport_world_cards SET
       current_owner_id=?,owner_since=?,owner_epoch=owner_epoch+1
      WHERE id=? AND current_owner_id=? AND owner_epoch=?
        AND EXISTS(SELECT 1 FROM sport_card_ownership_events e
          WHERE e.card_id=? AND e.previous_epoch=? AND e.new_epoch=?
            AND e.new_owner_id=? AND e.reason='gift_claim'
            AND e.changed_at=?)`)
      .bind(recipientId,now,gift.card_id,gift.donor_user_id,
        gift.donor_epoch,gift.card_id,gift.donor_epoch,
        gift.donor_epoch+1,recipientId,now),
    db.prepare(`UPDATE sport_card_gift_links SET claimed_at=?,claimed_by=?
      WHERE token_hash=? AND claimed_at IS NULL
        AND card_id=? AND donor_user_id=? AND donor_epoch=?
        AND EXISTS(SELECT 1 FROM sport_world_cards c
          WHERE c.id=? AND c.current_owner_id=?
            AND c.owner_epoch=? AND c.owner_since=?)`)
      .bind(now,recipientId,hash,gift.card_id,gift.donor_user_id,
        gift.donor_epoch,gift.card_id,recipientId,gift.donor_epoch+1,now),
  ]);
  if(!results.every(r=>r?.meta?.changes===1))
    throw Error('sport_gift_transfer_invariant_failed');
  return res({claimed:true,id:gift.card_id,ownerEpoch:gift.donor_epoch+1});
}
