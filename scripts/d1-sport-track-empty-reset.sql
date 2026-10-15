-- BeatOnStep / D1 production — REINITIALISATION des TABLES SPORTIVES UNIQUEMENT.
-- Script destructif : interdit si l'une des sept tables contient une ligne.
-- Exécuter d'abord scripts/d1-sport-track-preflight.sql puis faire une
-- sauvegarde D1 et arrêter tout nouvel enregistrement de carte pendant l'opération.
-- Ne touche jamais aux comptes, courses utilisateur, séances et musique.
-- Ce script ne crée pas les cartes 800m/1500m/mile : leur activation demeure
-- un second déploiement cohérent site + Worker + mobile, avec tests.
-- Prévu UNIQUEMENT pour tables sportives déjà créées, et toutes VIDES.
-- Les tables membres community_users et autres schémas doivent déjà exister.

-- Sécurité : SQL stoppe ici sur une violation CHECK si une ligne subsiste.
-- Ne pas contourner cette vérification.
CREATE TEMP TABLE _bos_empty_sport_guard
  (row_count INTEGER NOT NULL CHECK(row_count=0));
INSERT INTO _bos_empty_sport_guard(row_count)
SELECT
 (SELECT COUNT(*) FROM sport_world_cards)
 +(SELECT COUNT(*) FROM sport_verified_runs)
 +(SELECT COUNT(*) FROM sport_card_achievements)
 +(SELECT COUNT(*) FROM sport_card_ownership_events)
 +(SELECT COUNT(*) FROM sport_card_gift_links)
 +(SELECT COUNT(*) FROM sport_card_telemetry_reviews)
 +(SELECT COUNT(*) FROM sport_card_telemetry_reason_details);

-- Libérer les dépendances dans l'ordre descendant (0 ligne garantie).
DROP TRIGGER IF EXISTS sport_card_owner_account_deletion;
DROP TRIGGER IF EXISTS sport_verified_run_award_v1;
DROP TABLE IF EXISTS sport_card_telemetry_reason_details;
DROP TABLE IF EXISTS sport_card_telemetry_reviews;
DROP TABLE IF EXISTS sport_card_gift_links;
DROP TABLE IF EXISTS sport_card_ownership_events;
DROP TABLE IF EXISTS sport_card_achievements;
DROP TABLE IF EXISTS sport_verified_runs;
DROP TABLE IF EXISTS sport_world_cards;

-- Reconstruire le sous-schéma tel que versionné sur main.

-- ==== migrations/0008_sport_world_cards.sql ====
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


-- ==== migrations/0009_sport_card_gift_links.sql ====
-- #447: bearer gifts for world SPORT cards, independent of musical 7-day gifts.
-- Install after 0008, only after a D1 backup. No existing tables modified.
-- A token remains viewable for archival purposes after a card changes hands;
-- claim requires donor's CURRENT ownership epoch and an unclaimed token.
CREATE TABLE IF NOT EXISTS sport_card_gift_links (
  token_hash TEXT PRIMARY KEY NOT NULL
    CHECK(length(token_hash)=64),
  card_id INTEGER NOT NULL REFERENCES sport_world_cards(id) ON DELETE CASCADE,
  donor_user_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  donor_epoch INTEGER NOT NULL CHECK(donor_epoch>=1),
  created_at INTEGER NOT NULL CHECK(created_at>0),
  claimed_at INTEGER CHECK(claimed_at IS NULL OR claimed_at>=created_at),
  claimed_by TEXT REFERENCES community_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS sport_gift_links_donor
  ON sport_card_gift_links(donor_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sport_gift_links_card_epoch
  ON sport_card_gift_links(card_id,donor_epoch,claimed_at);


-- ==== migrations/0010_sport_verified_award_trigger.sql ====
-- #445 #448 #450. Apply AFTER 0008; backup D1 first.
-- This trigger is an atomic ledger primitive, NOT an evidence-verification
-- endpoint. The only way to invoke it is an INSERT into sport_verified_runs,
-- which MUST remain private to a trusted server-side attestation adapter.
-- account_run_records, unsigned GPS payloads and browser/mobile recaps must
-- never insert into sport_verified_runs.
--
-- The AFTER INSERT trigger runs INSIDE the same SQLite statement:
--   1. preserve a new personal achievement (or increment its run count),
--   2. transfer the ONE exact tier only if the athlete is not already owner,
--   3. retain personal achievements and past ownership epochs.
-- The PK (user_id,run_id) makes run replay a no-op, not a second theft.
-- A gift recipient who later truly performs the same tier receives credit
-- without a second card or an extra ownership epoch.
CREATE TRIGGER IF NOT EXISTS sport_verified_run_award_v1
AFTER INSERT ON sport_verified_runs
BEGIN
  INSERT INTO sport_card_achievements
    (user_id,card_id,first_run_id,first_validated_at,
     successful_runs,last_validated_at)
  VALUES
    (NEW.user_id,NEW.card_id,NEW.run_id,NEW.verified_at,1,NEW.verified_at)
  ON CONFLICT(user_id,card_id) DO UPDATE SET
    successful_runs=sport_card_achievements.successful_runs+1,
    last_validated_at=MAX(sport_card_achievements.last_validated_at,
                          excluded.last_validated_at);

  INSERT INTO sport_card_ownership_events
    (card_id,previous_owner_id,new_owner_id,previous_epoch,
     new_epoch,reason,changed_at)
  SELECT c.id,c.current_owner_id,NEW.user_id,c.owner_epoch,
         c.owner_epoch+1,'sport_win',NEW.verified_at
  FROM sport_world_cards c
  WHERE c.id=NEW.card_id AND c.current_owner_id IS NOT NEW.user_id;

  UPDATE sport_world_cards
  SET current_owner_id=NEW.user_id,owner_since=NEW.verified_at,
      owner_epoch=owner_epoch+1
  WHERE id=NEW.card_id AND current_owner_id IS NOT NEW.user_id;
END;


-- ==== migrations/0011_sport_card_telemetry_reviews.sql ====
-- #98 — Optional, asynchronous sporting-performance review; never an award gate.
-- Apply manually to beatonstep-catalog-prod after a D1 backup.
-- A review belongs to ONE ownership epoch, not the transferable world card.
-- No raw GPS coordinates, route history, account IDs, or audio.
CREATE TABLE IF NOT EXISTS sport_card_telemetry_reviews (
  card_id INTEGER NOT NULL REFERENCES sport_world_cards(id) ON DELETE CASCADE,
  owner_epoch INTEGER NOT NULL CHECK(owner_epoch>=1),
  needs_warning INTEGER NOT NULL CHECK(needs_warning IN (0,1)),
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','clear','warning')),
  created_at INTEGER NOT NULL CHECK(created_at>0),
  reviewed_at INTEGER,
  PRIMARY KEY(card_id,owner_epoch)
);
CREATE INDEX IF NOT EXISTS sport_telemetry_review_pending
  ON sport_card_telemetry_reviews(state,created_at);


-- ==== migrations/0012_sport_card_telemetry_reason_details.sql ====
-- #98 — immutable human-explainable reasons for each historical sport win.
-- Additive to 0011: safe for existing review rows, never touches ownership.
-- This table is also created idempotently by the optional Cloudflare cron.
-- reason_codes is a JSON array of fixed codes, never raw GPS or personal data.
CREATE TABLE IF NOT EXISTS sport_card_telemetry_reason_details (
  card_id INTEGER NOT NULL,
  owner_epoch INTEGER NOT NULL,
  reason_codes TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY(card_id,owner_epoch),
  FOREIGN KEY(card_id,owner_epoch)
    REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
);

-- Verification finale :
PRAGMA foreign_key_check;
SELECT sql FROM sqlite_master
WHERE type='table' AND name='sport_world_cards';
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sport_%'
ORDER BY name;
