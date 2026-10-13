import { workoutCardFingerprint } from './workout-identity.js';

export const CARD_ID_OFFSET = 1_000_000_000_000;
export const cardsEnabled = env => env.CARDS_ENABLED === 'true';

// D1 migration 0004 is deliberately manual. No public request may create tables.
const CARD_TABLES = ['workout_cards','workout_card_aliases',
  'workout_card_history','workout_pack_claims','workout_card_gifts'];
const CARD_TRIGGERS = ['workout_card_history_first','workout_card_history_change',
  'workout_card_pack_claim','workout_card_alias_imports'];

// Fail closed if D1 migration has only been partially applied. In particular,
// a missing ownership trigger must NEVER allow packs or reconciliation.
export async function requireCardSchema(db) {
  const rows=await db.prepare(`SELECT name,type FROM sqlite_master
    WHERE (type='table' AND name IN ('workout_cards','workout_card_aliases',
      'workout_card_history','workout_pack_claims','workout_card_gifts'))
       OR (type='trigger' AND name IN ('workout_card_history_first',
         'workout_card_history_change','workout_card_pack_claim',
         'workout_card_alias_imports'))`).all();
  const present=new Set((rows.results||[]).map(row=>row.type+':'+row.name));
  const complete=CARD_TABLES.every(name=>present.has('table:'+name))&&
    CARD_TRIGGERS.every(name=>present.has('trigger:'+name));
  if (!complete) throw Error('workout_card_schema_incomplete');
}
export async function canonicalShareId(db, id) {
  const alias = await db.prepare(
    'SELECT canonical_share_id FROM workout_card_aliases WHERE alias_share_id=?'
  ).bind(id).first();
  return alias?.canonical_share_id ?? id;
}
export async function cardPeople(db, shareIds) {
  if (!shareIds.length) return new Map();
  const q = shareIds.map(() => '?').join(',');
  const res = await db.prepare(`SELECT c.share_id,owner.handle AS owner,
    creator.handle AS creator,c.pack_eligible,c.owner_user_id
    FROM workout_cards c
    LEFT JOIN community_users owner ON owner.id=c.owner_user_id
    LEFT JOIN community_users creator ON creator.id=c.creator_user_id
    WHERE c.share_id IN (${q})`).bind(...shareIds).all();
  return new Map((res.results||[]).map(r=>[r.share_id,{
    owner:r.owner||null,creator:r.creator||null,
    unclaimed:r.owner_user_id===null,packEligible:r.pack_eligible===1,
  }]));
}

export async function publishUniqueWorkout(db, payload, meta, author) {
  const distanceV2=payload?.v===2 && payload?.goalMode==='distance';
  const fingerprint=await workoutCardFingerprint(payload);
  // Not every old client sends complete music metadata. These invalid identities
  // remain in legacy publishing rather than being merged incorrectly.
  if (!fingerprint) return null;
  const existing=await db.prepare('SELECT share_id FROM workout_cards WHERE fingerprint=?')
    .bind(fingerprint).first();
  if (existing) return {id:existing.share_id,created:false};
  const createdAt=Date.now();
  const publish=db.prepare(`INSERT INTO shared_items
    (kind,source,name,duration_sec,bpm,tracks,phases,profile_json,payload_json,created_at)
    VALUES('workout',?,?,?,?,?,?,?,?,?)`).bind(
    meta.source,meta.name,meta.durationSec,meta.bpm,meta.tracks,meta.phases,
    meta.profile?JSON.stringify(meta.profile):null,JSON.stringify(payload),createdAt
  );
  // A D1 batch is transactional. last_insert_rowid stays on the batch's
  // connection. A concurrent publisher may win the UNIQUE fingerprint; in
  // that case delete the new (unclaimed) row in the same transaction.
  const write=[
    publish,
    db.prepare(`INSERT OR IGNORE INTO workout_cards
      (share_id,fingerprint,creator_user_id,owner_user_id,pack_eligible,last_reason,created_at,acquired_at)
      VALUES(last_insert_rowid(),?,?,?,?,?,?,?)`)
      .bind(fingerprint,author?.id||null,
        distanceV2?null:author?.id||null,
        distanceV2?0:author?0:1,
        distanceV2?'challenge_created':'created',
        createdAt,distanceV2?null:author?createdAt:null),
  ];
  if (author) write.push(db.prepare(`INSERT INTO signed_shares(share_id,user_id)
    SELECT last_insert_rowid(),? WHERE EXISTS
    (SELECT 1 FROM workout_cards WHERE share_id=last_insert_rowid())`).bind(author.id));
  write.push(db.prepare(`DELETE FROM shared_items WHERE id=last_insert_rowid()
    AND NOT EXISTS(SELECT 1 FROM workout_cards WHERE share_id=last_insert_rowid())`));
  const results=await db.batch(write);
  const final=await db.prepare('SELECT share_id FROM workout_cards WHERE fingerprint=?')
    .bind(fingerprint).first();
  if (!final) throw Error('workout_identity_unavailable');
  return {id:final.share_id,created:final.share_id===results[0]?.meta?.last_row_id};
}

// Admin-only progressive backfill; the oldest publication wins. Every duplicate
// becomes an alias, so its original public URL never breaks. No destructive
// deletion of historic rows, and import totals merge exactly once via trigger.
export async function backfillWorkoutCards(db, afterId=0, limit=40) {
  const rows=await db.prepare(`SELECT id,payload_json,created_at
    FROM shared_items WHERE kind='workout' AND id>?
    ORDER BY id ASC LIMIT ?`).bind(afterId,limit).all();
  const stats={scanned:0,created:0,aliases:0,skipped:0,lastId:afterId,done:true};
  for (const row of rows.results||[]) {
    stats.scanned++;
    stats.lastId=row.id;
    let fingerprint;
    try {
      const historical=JSON.parse(row.payload_json);
      // Backfill is for legacy music cards only. Never award a v2
      // challenge to its uploader merely because it has a signed share.
      if(historical?.v===2){stats.skipped++;continue;}
      fingerprint=await workoutCardFingerprint(historical);
    } catch { /* legacy malformed payload */ }
    if (!fingerprint) {stats.skipped++;continue;}
    let existing=await db.prepare('SELECT share_id FROM workout_cards WHERE fingerprint=?')
      .bind(fingerprint).first();
    if (!existing) {
      const signed=await db.prepare('SELECT user_id FROM signed_shares WHERE share_id=?')
        .bind(row.id).first();
      await db.prepare(`INSERT OR IGNORE INTO workout_cards
        (share_id,fingerprint,creator_user_id,owner_user_id,pack_eligible,last_reason,created_at,acquired_at)
        VALUES(?,?,?,?,?,'created',?,?)`).bind(
          row.id,fingerprint,signed?.user_id||null,signed?.user_id||null,
          signed?0:1,row.created_at,signed?row.created_at:null
        ).run();
      existing=await db.prepare('SELECT share_id FROM workout_cards WHERE fingerprint=?')
        .bind(fingerprint).first();
      if (existing?.share_id===row.id) {stats.created++;continue;}
    }
    if (existing?.share_id!==row.id) {
      const alias=await db.prepare(`INSERT OR IGNORE INTO workout_card_aliases
        (alias_share_id,canonical_share_id,created_at) VALUES(?,?,?)`)
        .bind(row.id,existing.share_id,Date.now()).run();
      if (alias.meta?.changes===1) stats.aliases++;
    }
  }
  stats.done=(rows.results||[]).length<limit;
  return stats;
}
