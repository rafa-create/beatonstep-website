-- BeatOnStep catalogue: profils facultatifs, comptes web et signatures des séances.
-- À exécuter MANUELLEMENT dans Cloudflare > D1 > beatonstep-catalog-prod
-- (ID 278e152c-3338-4e0d-adfd-673eac7c60cb).
-- Aucune suppression ni modification des partages anonymes historiques.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_sessions_user ON community_sessions(user_id);
CREATE INDEX IF NOT EXISTS community_sessions_expiry ON community_sessions(expires_at);

CREATE TABLE IF NOT EXISTS community_auth_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_link_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_link_codes_expiry ON community_link_codes(expires_at);

CREATE TABLE IF NOT EXISTS community_devices (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_devices_user ON community_devices(user_id);
CREATE INDEX IF NOT EXISTS community_devices_expiry ON community_devices(expires_at);

CREATE TABLE IF NOT EXISTS signed_shares (
  share_id INTEGER PRIMARY KEY REFERENCES shared_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS signed_shares_creator ON signed_shares(user_id, share_id DESC);
