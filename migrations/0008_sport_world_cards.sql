-- #445 #448 #449 #450 #460 — Independent world-wide SPORT TROPHY ledger, v1.
-- Apply manually on beatonstep-catalog-prod only after backup and review.
-- Does not modify any historic workout_cards, signed_shares, workout_card_gifts,
-- published musical templates, or account_run_records (untrusted memories).
-- Adds read-only account views initially: awards / theft / gift claim remain
-- DISABLED until a separate, trusted sport-evidence acceptance service exists.
-- All dates are UTC milliseconds and all sports thresholds are strict sub N.
CREATE TABLE IF NOT EXISTS sport_world_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distance_cm INTEGER NOT NULL CHECK(distance_cm BETWEEN 40000 AND 20000000),
  time_unit TEXT NOT NULL CHECK(time_unit IN ('second','minute')),
  sub_value INTEGER NOT NULL CHECK(sub_value BETWEEN 1 AND 1000000),
  difficulty TEXT NOT NULL CHECK(difficulty IN
    ('world_elite','legend','expert','intermediate','regular','amateur','beginner')),
  ruleset TEXT NOT NULL CHECK(ruleset='sport-cards-v1'),
  created_at INTEGER NOT NULL CHECK(created_at>0),
  current_owner_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  owner_since INTEGER,
  owner_epoch INTEGER NOT NULL DEFAULT 0 CHECK(owner_epoch>=0),
  CHECK((current_owner_id IS NULL AND owner_since IS NULL) OR
    (current_owner_id IS NOT NULL AND owner_since IS NOT NULL)),
  -- Track events use an exact-second SUB, never a minute-rounded sprint.
  CHECK((distance_cm IN (40000,80000,150000,160934) AND time_unit='second') OR
    (distance_cm NOT IN (40000,80000,150000,160934) AND time_unit='minute')),
  UNIQUE(distance_cm,time_unit,sub_value)
);
CREATE INDEX IF NOT EXISTS sport_world_cards_owner
  ON sport_world_cards(current_owner_id,id);

-- Verified sporting achievements are separate from CURRENT possession:
-- gaining a card through a gift does not create one.
CREATE TABLE IF NOT EXISTS sport_verified_runs (
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL CHECK(length(run_id) BETWEEN 1 AND 128),
  card_id INTEGER NOT NULL REFERENCES sport_world_cards(id) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL CHECK(completed_at>0),
  verified_at INTEGER NOT NULL CHECK(verified_at>0),
  evidence_digest TEXT NOT NULL CHECK(length(evidence_digest)=64),
  evidence_source TEXT NOT NULL CHECK(evidence_source IN
    ('attested_phone','verified_import')),
  PRIMARY KEY(user_id,run_id)
);
CREATE INDEX IF NOT EXISTS sport_verified_runs_card
  ON sport_verified_runs(card_id,verified_at DESC);

CREATE TABLE IF NOT EXISTS sport_card_achievements (
  user_id TEXT NOT NULL REFERENCES community_users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES sport_world_cards(id) ON DELETE CASCADE,
  first_run_id TEXT NOT NULL,
  first_validated_at INTEGER NOT NULL CHECK(first_validated_at>0),
  successful_runs INTEGER NOT NULL DEFAULT 1 CHECK(successful_runs>=1),
  last_validated_at INTEGER NOT NULL CHECK(last_validated_at>=first_validated_at),
  PRIMARY KEY(user_id,card_id),
  FOREIGN KEY(user_id,first_run_id)
    REFERENCES sport_verified_runs(user_id,run_id)
);
CREATE INDEX IF NOT EXISTS sport_card_achievements_card
  ON sport_card_achievements(card_id,first_validated_at);

-- Immutable ownership timeline. Several epochs may belong to one runner;
-- the final ghost shows their LAST completed holding period, not lifetime sum.
CREATE TABLE IF NOT EXISTS sport_card_ownership_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES sport_world_cards(id) ON DELETE CASCADE,
  previous_owner_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  new_owner_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  previous_epoch INTEGER NOT NULL CHECK(previous_epoch>=0),
  new_epoch INTEGER NOT NULL CHECK(new_epoch=previous_epoch+1),
  reason TEXT NOT NULL CHECK(reason IN
    ('sport_win','gift_claim','account_closed')),
  changed_at INTEGER NOT NULL CHECK(changed_at>0),
  -- Historical identity references can be anonymised on account deletion.
  CHECK(previous_owner_id IS NOT new_owner_id OR
    previous_owner_id IS NULL OR new_owner_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS sport_ownership_once_per_epoch
  ON sport_card_ownership_events(card_id,new_epoch);
CREATE INDEX IF NOT EXISTS sport_ownership_in
  ON sport_card_ownership_events(new_owner_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS sport_ownership_out
  ON sport_card_ownership_events(previous_owner_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS sport_ownership_timeline
  ON sport_card_ownership_events(card_id,changed_at DESC,id DESC);

-- When deleting a runner's account, release their active world trophy.
-- A BEFORE DELETE trigger is required: the owner FK SET NULL alone would
-- conflict with owner_since remaining set, blocking account deletion.
-- The event is anonymised by FK actions when the account is removed.
CREATE TRIGGER IF NOT EXISTS sport_card_owner_account_deletion
BEFORE DELETE ON community_users
BEGIN
  INSERT INTO sport_card_ownership_events
    (card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
    SELECT id,OLD.id,NULL,owner_epoch,owner_epoch+1,
      'account_closed',CAST(strftime('%s','now') AS INTEGER)*1000
    FROM sport_world_cards WHERE current_owner_id=OLD.id;
  UPDATE sport_world_cards
    SET current_owner_id=NULL,owner_since=NULL,owner_epoch=owner_epoch+1
    WHERE current_owner_id=OLD.id;
END;

-- Free bearer links will be a separate follow-up. They reference card_id +
-- owner_epoch (so a later re-win never revives an expired opportunity to claim)
-- and retain a public-only snapshot after a transfer; no personal recipient.
-- Do NOT reuse the old seven-day musical workout_card_gifts schema.
