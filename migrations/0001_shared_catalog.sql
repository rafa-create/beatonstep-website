-- Fresh D1 catalogue. Deliberately does not import JSON from the original VM.
CREATE TABLE IF NOT EXISTS shared_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('runmix', 'workout')),
  source TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  bpm INTEGER,
  tracks INTEGER NOT NULL DEFAULT 0,
  phases INTEGER NOT NULL DEFAULT 0,
  profile_json TEXT,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  imports INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS shared_items_kind_source_recent
  ON shared_items(kind, source, id DESC);
CREATE INDEX IF NOT EXISTS shared_items_popular
  ON shared_items(imports DESC, id DESC);
CREATE TABLE IF NOT EXISTS publish_quotas (
  bucket TEXT PRIMARY KEY,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS publish_quotas_expiration ON publish_quotas(expires_at);
