-- Optional catalogue moderation; additive migration, no changes to public card schema.
-- Run ONLY against production D1 beatonstep-catalog-prod (UUID 278e152c-3338-4e0d-adfd-673eac7c60cb).
-- This migration creates no account and opens no public registrations.
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES admin_users(email) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_email ON admin_sessions(email);
CREATE INDEX IF NOT EXISTS admin_sessions_expiration ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_auth_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_auth_attempts_expiration ON admin_auth_attempts(expires_at);
