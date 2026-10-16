-- 0013 — advisory sport GPS peaks, admin decisions and Resend alerts.
-- Apply in Cloudflare D1 SQL console after a database backup.
-- Additive only: never deletes world cards or ownership/achievement events.
CREATE TABLE IF NOT EXISTS sport_card_telemetry_speed_details (
  card_id INTEGER NOT NULL,
  owner_epoch INTEGER NOT NULL,
  peak_speed_kmh REAL NOT NULL CHECK(peak_speed_kmh>=0 AND peak_speed_kmh<=10000),
  PRIMARY KEY(card_id,owner_epoch),
  FOREIGN KEY(card_id,owner_epoch)
    REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sport_card_telemetry_admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  owner_epoch INTEGER NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('lift_warning')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY(card_id,owner_epoch)
    REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sport_card_telemetry_mail_delivery (
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
);
