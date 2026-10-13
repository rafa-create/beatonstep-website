-- Manual export to Strava. No impact on existing catalogue tables.
-- Apply explicitly through wrangler d1 migrations apply; do NOT auto-run in production.
CREATE TABLE IF NOT EXISTS strava_connections (
  device_hash TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL UNIQUE,
  refresh_nonce TEXT NOT NULL,
  refresh_cipher TEXT NOT NULL,
  access_nonce TEXT NOT NULL,
  access_cipher TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS strava_oauth_pending (
  device_hash TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_strava_pending_expiry ON strava_oauth_pending(expires_at);
CREATE TABLE IF NOT EXISTS strava_exports (
  athlete_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','complete')),
  activity_id TEXT,
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  PRIMARY KEY(athlete_id,run_id)
);