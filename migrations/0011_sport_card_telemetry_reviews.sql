-- #98 — Optional, asynchronous sporting-performance review; never an award gate.
-- Apply manually to beatonstep-catalog-prod after a D1 backup.
-- A review belongs to ONE ownership epoch, not the transferable world card.
-- No raw GPS coordinates, route history, account IDs, or audio.
CREATE TABLE IF NOT EXISTS sport_card_telemetry_reviews (
  card_id INTEGER NOT NULL REFERENCES sport_world_cards(id) ON DELETE CASCADE,
  owner_epoch INTEGER NOT NULL CHECK(owner_epoch>=1),
  needs_warning INTEGER NOT NULL CHECK(needs_warning IN (0,1)),
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','clear','warning')),
  created_at INTEGER NOT NULL CHECK(created_at>0),
  reviewed_at INTEGER,
  PRIMARY KEY(card_id,owner_epoch)
);
CREATE INDEX IF NOT EXISTS sport_telemetry_review_pending
  ON sport_card_telemetry_reviews(state,created_at);
