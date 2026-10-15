-- BeatOnStep public profile: voluntary visibility for the challenge-card collection.
-- Apply MANUALLY on Cloudflare D1 production before deploying the API/UI update.
-- Default for an account without a settings row: challenges are public.
-- Does NOT affect card ownership, historical results, catalogue, or music shares.
CREATE TABLE IF NOT EXISTS community_profile_settings (
  user_id TEXT PRIMARY KEY REFERENCES community_users(id) ON DELETE CASCADE,
  show_challenges INTEGER NOT NULL DEFAULT 1 CHECK (show_challenges IN (0,1))
);
