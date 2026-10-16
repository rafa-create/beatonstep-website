// #98: Asynchronous optional review. Ownership is NEVER contingent on this.
// Each warning is scoped to the epoch that earned the trophy; gifts reset it.
// No GPS routes, user identifiers or detailed diagnostics are stored.
// Idempotent additive initialization for an independently deployed Worker.
// Warning reasons use a small, stable public vocabulary, not raw GPS data.
const REASON_CODES=new Set([
  'implausible_speed','invalid_pause_duration','inconsistent_crossings',
  'strava_flagged',
]);
export function readSportWarningReasons(raw){
  try{
    const values=Array.isArray(raw)?raw:JSON.parse(raw||'[]');
    return Array.isArray(values)
      ?[...new Set(values.filter(value=>REASON_CODES.has(value)))].slice(0,3)
      :[];
  }catch{return [];}
}
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
  // Additive companion table works even when the original 0011 table already exists.
  await db.prepare(`CREATE TABLE IF NOT EXISTS sport_card_telemetry_reason_details (
    card_id INTEGER NOT NULL,
    owner_epoch INTEGER NOT NULL,
    reason_codes TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY(card_id,owner_epoch),
    FOREIGN KEY(card_id,owner_epoch)
      REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS sport_card_telemetry_speed_details (
    card_id INTEGER NOT NULL,
    owner_epoch INTEGER NOT NULL,
    peak_speed_kmh REAL NOT NULL CHECK(peak_speed_kmh>=0 AND peak_speed_kmh<=10000),
    PRIMARY KEY(card_id,owner_epoch),
    FOREIGN KEY(card_id,owner_epoch)
      REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS sport_card_telemetry_admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    owner_epoch INTEGER NOT NULL,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('lift_warning')),
    created_at INTEGER NOT NULL,
    FOREIGN KEY(card_id,owner_epoch)
      REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS sport_card_telemetry_mail_delivery (
    card_id INTEGER NOT NULL,
    owner_epoch INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending'
      CHECK(state IN ('pending','sending','sent')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER,
    PRIMARY KEY(card_id,owner_epoch),
    FOREIGN KEY(card_id,owner_epoch)
      REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
  )`).run();
}

export async function enqueueSportTelemetryReview(db,cardId,epoch,needsWarning,{
  now=Date.now(),reasonCodes=[],peakSpeedKmh=null,
}={}){
  if(!Number.isSafeInteger(cardId)||cardId<1||!Number.isSafeInteger(epoch)||epoch<1)
    return false;
  // Attach the review to the original SPORT WIN, even if a later runner
  // acquired the card while this asynchronous review was being queued.
  const result=await db.prepare(`INSERT INTO sport_card_telemetry_reviews
      (card_id,owner_epoch,needs_warning,state,created_at)
      SELECT e.card_id,e.new_epoch,?,'pending',?
      FROM sport_card_ownership_events e
      WHERE e.card_id=? AND e.new_epoch=? AND e.reason='sport_win'
      ON CONFLICT(card_id,owner_epoch) DO NOTHING`)
    .bind(needsWarning?1:0,now,cardId,epoch).run();
  const reasons=readSportWarningReasons(reasonCodes);
  if(needsWarning&&reasons.length){
    // Immutable first explanation, retried if the base review was inserted
    // but the optional detail write failed. Never overwrite historical proof.
    await db.prepare(`INSERT INTO sport_card_telemetry_reason_details
      (card_id,owner_epoch,reason_codes) VALUES(?,?,?)
      ON CONFLICT(card_id,owner_epoch) DO NOTHING`)
      .bind(cardId,epoch,JSON.stringify(reasons)).run();
  }
  if(needsWarning&&typeof peakSpeedKmh==='number'&&
     Number.isFinite(peakSpeedKmh)&&peakSpeedKmh>=0&&peakSpeedKmh<=10000){
    await db.prepare(`INSERT INTO sport_card_telemetry_speed_details
      (card_id,owner_epoch,peak_speed_kmh)
      VALUES(?,?,?) ON CONFLICT(card_id,owner_epoch) DO NOTHING`)
      .bind(cardId,epoch,Math.round(peakSpeedKmh*10)/10).run();
  }
  // One notification per award epoch, not per reconciliation or ownership.
  if(needsWarning){
    await db.prepare(`INSERT INTO sport_card_telemetry_mail_delivery
      (card_id,owner_epoch,state)
      SELECT card_id,owner_epoch,'pending' FROM sport_card_telemetry_reviews
      WHERE card_id=? AND owner_epoch=? AND needs_warning=1
      ON CONFLICT(card_id,owner_epoch) DO NOTHING`).bind(cardId,epoch).run();
  }
  return (result?.meta?.changes||0)>0;
}

// The Cloudflare cron reviews queued results independently of the app, VM,
// award transaction or HTTP response. A prior owner's review cannot mark
// a gift recipient's epoch or revoke their card.
export async function processPendingSportTelemetryReviews(db,{now=Date.now()}={}){
  const result=await db.prepare(`UPDATE sport_card_telemetry_reviews
    SET state=CASE WHEN needs_warning=1 THEN 'warning' ELSE 'clear' END,
      reviewed_at=?
    WHERE (card_id,owner_epoch) IN (
      SELECT card_id,owner_epoch FROM sport_card_telemetry_reviews
      WHERE state='pending' ORDER BY created_at ASC LIMIT 100
    )`).bind(now).run();
  return Number(result?.meta?.changes)||0;
}
