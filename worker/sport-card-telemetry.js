// #98: Asynchronous optional review. Ownership is NEVER contingent on this.
// Each warning is scoped to the epoch that earned the trophy; gifts reset it.
// No GPS routes, user identifiers or detailed diagnostics are stored.
// Idempotent additive initialization for an independently deployed Worker.
// A scheduled task or post-award background task can initialize the new table
// without VM access. Migration 0011 remains the canonical, declarative schema.
export async function ensureSportTelemetrySchema(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS sport_card_telemetry_reviews (
    card_id INTEGER NOT NULL REFERENCES sport_world_cards(id) ON DELETE CASCADE,
    owner_epoch INTEGER NOT NULL CHECK(owner_epoch>=1),
    needs_warning INTEGER NOT NULL CHECK(needs_warning IN (0,1)),
    state TEXT NOT NULL DEFAULT 'pending'
      CHECK(state IN ('pending','clear','warning')),
    created_at INTEGER NOT NULL CHECK(created_at>0),
    reviewed_at INTEGER,
    PRIMARY KEY(card_id,owner_epoch)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS sport_telemetry_review_pending
    ON sport_card_telemetry_reviews(state,created_at)`).run();
}

export async function enqueueSportTelemetryReview(db,cardId,epoch,needsWarning,{now=Date.now()}={}){
  if(!Number.isSafeInteger(cardId)||cardId<1||!Number.isSafeInteger(epoch)||epoch<1)
    return false;
  const result=await db.prepare(`INSERT INTO sport_card_telemetry_reviews
      (card_id,owner_epoch,needs_warning,state,created_at)
      SELECT c.id,c.owner_epoch,?,'pending',?
      FROM sport_world_cards c
      WHERE c.id=? AND c.owner_epoch=? AND c.current_owner_id IS NOT NULL
      ON CONFLICT(card_id,owner_epoch) DO NOTHING`)
    .bind(needsWarning?1:0,now,cardId,epoch).run();
  return (result?.meta?.changes||0)>0;
}

// The Cloudflare cron reviews queued results independently of the app, VM,
// award transaction or HTTP response. A prior owner's review cannot mark
// a gift recipient's epoch or revoke their card.
export async function processPendingSportTelemetryReviews(db,{now=Date.now()}={}){
  const result=await db.prepare(`UPDATE sport_card_telemetry_reviews
    SET state=CASE
      WHEN needs_warning=1 AND EXISTS(
        SELECT 1 FROM sport_world_cards c
        WHERE c.id=sport_card_telemetry_reviews.card_id
          AND c.owner_epoch=sport_card_telemetry_reviews.owner_epoch
          AND c.current_owner_id IS NOT NULL
      ) THEN 'warning' ELSE 'clear' END,
      reviewed_at=?
    WHERE (card_id,owner_epoch) IN (
      SELECT card_id,owner_epoch FROM sport_card_telemetry_reviews
      WHERE state='pending' ORDER BY created_at ASC LIMIT 100
    )`).bind(now).run();
  return Number(result?.meta?.changes)||0;
}
