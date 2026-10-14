-- #98 — immutable human-explainable reasons for each historical sport win.
-- Additive to 0011: safe for existing review rows, never touches ownership.
-- This table is also created idempotently by the optional Cloudflare cron.
-- reason_codes is a JSON array of fixed codes, never raw GPS or personal data.
CREATE TABLE IF NOT EXISTS sport_card_telemetry_reason_details (
  card_id INTEGER NOT NULL,
  owner_epoch INTEGER NOT NULL,
  reason_codes TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY(card_id,owner_epoch),
  FOREIGN KEY(card_id,owner_epoch)
    REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
);
