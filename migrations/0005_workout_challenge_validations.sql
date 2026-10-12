-- #421: owner-scoped validations for DISTANCE challenge collectible cards.
-- STAGED ONLY: apply manually after backup/approval. Do not run on production yet.
-- Additive, no changes to shared_items, workout_cards or existing ownership triggers.
--
-- A challenge card is still the existing workout_cards.share_id.
-- This table stores a runner's achieved status, NEVER card ownership.
-- Old 'time' workout cards must never have rows in this table;
-- enforce that in authenticated API route using the versioned public payload.
-- Users must own the canonical card at the time of recording a validation.
-- Each owner can validate the same challenge independently. A gift only moves
-- workout_cards.owner_user_id; do not copy or delete historical validation.
-- The owned collection API will LEFT JOIN this table with BOTH c.share_id and
-- authenticated current user ID. Public catalog/gift preview never uses it.
-- Store no GPS coordinates or music-provider credentials.
CREATE TABLE IF NOT EXISTS workout_challenge_validations (
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  share_id INTEGER NOT NULL REFERENCES workout_cards(share_id) ON DELETE CASCADE,
  validated_at INTEGER NOT NULL CHECK(validated_at > 0),
  verified_distance_m INTEGER NOT NULL CHECK(verified_distance_m > 0),
  music_elapsed_sec INTEGER NOT NULL CHECK(music_elapsed_sec >= 0),
  PRIMARY KEY (user_id, share_id)
);
CREATE INDEX IF NOT EXISTS workout_challenge_validations_share
  ON workout_challenge_validations(share_id);
