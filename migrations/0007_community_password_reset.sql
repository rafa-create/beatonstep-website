-- BeatOnStep #454: additive one-time password reset tokens.
-- NEW MIGRATION, DO NOT run 0005 or 0006 again. Requires verified D1 backup.
-- Apply manually once to the same beatonstep-catalog-prod database after review.
-- No change to existing community_users, sessions, cards or sports histories.
CREATE TABLE IF NOT EXISTS community_password_reset_tokens (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_password_reset_expiry
  ON community_password_reset_tokens(expires_at);
