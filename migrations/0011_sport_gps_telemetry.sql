-- #450 Option A — progressive, privacy-minimised GPS telemetry.
-- Apply after 0010. Do NOT enable automatic awards without real iPhone trials.
-- No raw latitude, longitude, map or musical provider credentials are stored.
CREATE TABLE IF NOT EXISTS sport_telemetry_sessions (
  id TEXT PRIMARY KEY CHECK(length(id)=32),
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  client_run_key TEXT NOT NULL CHECK(length(client_run_key) BETWEEN 16 AND 128),
  started_at INTEGER NOT NULL CHECK(started_at>0),
  last_received_at INTEGER NOT NULL CHECK(last_received_at>=started_at),
  last_seq INTEGER NOT NULL DEFAULT 0 CHECK(last_seq>=0),
  last_elapsed_ms INTEGER NOT NULL DEFAULT 0 CHECK(last_elapsed_ms>=0),
  last_distance_cm INTEGER NOT NULL DEFAULT 0 CHECK(last_distance_cm>=0),
  last_accepted_fixes INTEGER NOT NULL DEFAULT 0 CHECK(last_accepted_fixes>=0),
  last_signal TEXT NOT NULL DEFAULT 'waiting' CHECK(last_signal IN ('good','waiting','paused')),
  status TEXT NOT NULL DEFAULT 'tracking'
    CHECK(status IN ('tracking','rejected','completed')),
  reject_reason TEXT,
  ended_at INTEGER CHECK(ended_at IS NULL OR ended_at>=started_at),
  UNIQUE(user_id,client_run_key)
);
CREATE INDEX IF NOT EXISTS sport_telemetry_active
  ON sport_telemetry_sessions(user_id,status,started_at DESC);

CREATE TABLE IF NOT EXISTS sport_telemetry_points (
  session_id TEXT NOT NULL REFERENCES sport_telemetry_sessions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK(seq>=1),
  received_at INTEGER NOT NULL CHECK(received_at>0),
  elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms>=0),
  distance_cm INTEGER NOT NULL CHECK(distance_cm>=0),
  paused INTEGER NOT NULL CHECK(paused IN (0,1)),
  signal TEXT NOT NULL CHECK(signal IN ('good','waiting','paused')),
  accepted_fixes INTEGER NOT NULL CHECK(accepted_fixes>=0),
  rejected_fixes INTEGER NOT NULL CHECK(rejected_fixes>=0),
  PRIMARY KEY(session_id,seq)
);
CREATE INDEX IF NOT EXISTS sport_telemetry_points_time
  ON sport_telemetry_points(session_id,received_at);
