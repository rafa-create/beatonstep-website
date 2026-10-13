-- #460: personal workout templates and completed-run archives.
-- Apply once by the owner in Cloudflare D1 on beatonstep-catalog-prod BEFORE
-- enabling the corresponding mobile sync. Additive: existing shared_items,
-- workout_cards, signed_shares, packs and gifts are not modified.
-- These tables are private account data, NOT sporting attestation.
-- A user-supplied run snapshot can NEVER award/steal a world challenge card.

CREATE TABLE IF NOT EXISTS account_workouts (
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL CHECK(length(workout_id) BETWEEN 1 AND 128),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY(user_id,workout_id)
);
CREATE INDEX IF NOT EXISTS account_workouts_updated
  ON account_workouts(user_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS account_run_records (
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL CHECK(length(run_id) BETWEEN 1 AND 128),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  source_workout_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,run_id),
  CHECK(ended_at >= started_at),
  CHECK(ended_at - started_at <= 604800000)
);
CREATE INDEX IF NOT EXISTS account_run_records_latest
  ON account_run_records(user_id,ended_at DESC,run_id DESC);

-- Deliberately no INSERT trigger into sporting ledgers or public shares.
-- Account deletion cascades. No GPS trace or musical account credentials
-- should ever appear in logs, public endpoints or exported challenge data.
