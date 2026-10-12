-- #421 — additive VERSIONED sports clock ledger for DISTANCE challenges.
-- NOT FOR PRODUCTION until v2 authenticated verification, transfers and
-- device GPS testing are complete; backup existing D1 first.
--
-- Migration 0005 was confirmed as applied by the project owner. Its original
-- attempt constraint compared elapsed_music_sec with playlist_duration_sec.
-- That cannot decide a CANONICAL 5 km / 30 min sporting challenge because
-- every runner can use a different playlist. Do NOT falsify those old columns,
-- drop those old tables, rewrite historic records or reapply migration 0005.
--
-- The v2 tables below are ADDITIVE. Once API acceptance is implemented, all
-- new sporting attempts/achievements/captures must use ONLY v2 tables. No
-- automatic ownership change is enabled by this SQL alone.
CREATE TABLE IF NOT EXISTS workout_distance_attempts_v2 (
  attempt_id TEXT PRIMARY KEY NOT NULL,
  share_id INTEGER NOT NULL REFERENCES workout_cards(share_id) ON DELETE CASCADE,
  user_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  result TEXT NOT NULL CHECK(result IN ('won','lost','unverified')),
  completed_at INTEGER NOT NULL CHECK(completed_at>0),
  accepted_at INTEGER NOT NULL CHECK(accepted_at>0),
  goal_distance_m INTEGER NOT NULL CHECK(goal_distance_m BETWEEN 100 AND 200000),
  deadline_sec INTEGER NOT NULL CHECK(deadline_sec BETWEEN 60 AND 86400),
  measured_distance_m INTEGER NOT NULL CHECK(measured_distance_m>=0),
  elapsed_sport_sec INTEGER NOT NULL CHECK(elapsed_sport_sec>=0),
  sample_count INTEGER NOT NULL CHECK(sample_count>=0),
  evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64),
  location_source TEXT NOT NULL CHECK(location_source='phone_gps'),
  evidence_status TEXT NOT NULL CHECK(evidence_status IN ('plausible','unverified')),
  CHECK(result <> 'won' OR (
    measured_distance_m>=goal_distance_m AND
    elapsed_sport_sec<=deadline_sec AND
    evidence_status='plausible' AND sample_count>=3
  ))
);
CREATE INDEX IF NOT EXISTS workout_distance_attempts_v2_runner
  ON workout_distance_attempts_v2(user_id,completed_at DESC);
CREATE INDEX IF NOT EXISTS workout_distance_attempts_v2_card
  ON workout_distance_attempts_v2(share_id,accepted_at DESC);

-- First successful attempt is permanent during the life of the account, even
-- if the collectible is later transferred to another runner or given away.
CREATE TABLE IF NOT EXISTS workout_distance_validations_v2 (
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  share_id INTEGER NOT NULL REFERENCES workout_cards(share_id) ON DELETE CASCADE,
  first_attempt_id TEXT NOT NULL UNIQUE
    REFERENCES workout_distance_attempts_v2(attempt_id),
  first_validated_at INTEGER NOT NULL CHECK(first_validated_at>0),
  PRIMARY KEY(user_id,share_id)
);
CREATE INDEX IF NOT EXISTS workout_distance_validations_v2_card
  ON workout_distance_validations_v2(share_id);

-- The source of ownership truth stays workout_cards.owner_user_id. Existing
-- workout_card_history_change trigger records the actual transfer. An attempt
-- can cause at most one capture; this ledger is NOT another owner column.
CREATE TABLE IF NOT EXISTS workout_distance_transfers_v2 (
  attempt_id TEXT PRIMARY KEY
    REFERENCES workout_distance_attempts_v2(attempt_id),
  share_id INTEGER NOT NULL REFERENCES workout_cards(share_id) ON DELETE CASCADE,
  previous_owner_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  new_owner_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  transferred_at INTEGER NOT NULL CHECK(transferred_at>0)
);
CREATE INDEX IF NOT EXISTS workout_distance_transfers_v2_card
  ON workout_distance_transfers_v2(share_id,transferred_at DESC);

-- SECURE ACCEPTANCE ROUTE STILL REQUIRED:
-- * authenticated user; compare canonical rule with immutable card payload;
-- * reject spoofed/impossible/duplicated samples, unknown GPS, pauses/gaps;
-- * server clock, short-term quota, one-time attempt, validated evidence;
-- * transactional attempt + first validation + guarded owner change + transfer;
-- * no raw GPS fixes, music tokens or full routes in D1;
-- * no success from client-provided result/status alone.
