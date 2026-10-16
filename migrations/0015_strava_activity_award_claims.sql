-- Additive, requires 20261013_strava_export.sql and 0010 sport trigger.
-- Strava athlete+activity ID is globally unique across BeatOnStep accounts.
-- No raw routes, tokens or heart-rate streams are stored in this table.
CREATE TABLE IF NOT EXISTS strava_activity_award_claims (
  athlete_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','complete','history_only')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  result_json TEXT,
  PRIMARY KEY(athlete_id,activity_id),
  UNIQUE(user_id,run_id)
);
CREATE INDEX IF NOT EXISTS strava_award_claims_by_user
  ON strava_activity_award_claims(user_id,created_at DESC);
