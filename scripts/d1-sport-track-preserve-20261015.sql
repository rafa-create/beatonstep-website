CREATE TABLE _bos_track_20261015_guard (passed INTEGER NOT NULL CHECK(passed=1));

INSERT INTO _bos_track_20261015_guard(passed)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM sport_world_cards)=2 AND
  (SELECT COUNT(*) FROM sport_verified_runs)=2 AND
  (SELECT COUNT(*) FROM sport_card_achievements)=2 AND
  (SELECT COUNT(*) FROM sport_card_ownership_events)=2 AND
  (SELECT COUNT(*) FROM sport_card_gift_links)=2 AND
  (SELECT COUNT(*) FROM sport_card_telemetry_reviews)=2 AND
  (SELECT COUNT(*) FROM sport_card_telemetry_reason_details)=0 AND
  (SELECT COUNT(*) FROM sqlite_master WHERE type IN ('table','trigger','view')
    AND sql LIKE '%sport_world_cards%')=8 AND
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table'
    AND name='sport_world_cards'
    AND sql LIKE '%distance_cm=40000 AND time_unit=%')=1
  THEN 1 ELSE 0 END;

CREATE TABLE _bos_track_20261015_sport_world_cards AS SELECT * FROM sport_world_cards;
CREATE TABLE _bos_track_20261015_sport_verified_runs AS SELECT * FROM sport_verified_runs;
CREATE TABLE _bos_track_20261015_sport_card_achievements AS SELECT * FROM sport_card_achievements;
CREATE TABLE _bos_track_20261015_sport_card_ownership_events AS SELECT * FROM sport_card_ownership_events;
CREATE TABLE _bos_track_20261015_sport_card_gift_links AS SELECT * FROM sport_card_gift_links;
CREATE TABLE _bos_track_20261015_sport_card_telemetry_reviews AS SELECT * FROM sport_card_telemetry_reviews;
CREATE TABLE _bos_track_20261015_sport_card_telemetry_reason_details AS SELECT * FROM sport_card_telemetry_reason_details;
CREATE TABLE _bos_track_20261015_sequence AS
 SELECT name,seq FROM sqlite_sequence
 WHERE name IN ('sport_world_cards','sport_card_ownership_events');

DROP TRIGGER IF EXISTS sport_verified_run_award_v1;
DROP TRIGGER IF EXISTS sport_card_owner_account_deletion;
DROP TABLE sport_card_telemetry_reason_details;
DROP TABLE sport_card_telemetry_reviews;
DROP TABLE sport_card_gift_links;
DROP TABLE sport_card_achievements;
DROP TABLE sport_verified_runs;
DROP TABLE sport_card_ownership_events;
DROP TABLE sport_world_cards;

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
  CHECK((distance_cm IN (40000,80000,150000,160934) AND time_unit='second') OR
    (distance_cm NOT IN (40000,80000,150000,160934) AND time_unit='minute')),
  UNIQUE(distance_cm,time_unit,sub_value)
);
CREATE INDEX IF NOT EXISTS sport_world_cards_owner
  ON sport_world_cards(current_owner_id,id);

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

CREATE TABLE IF NOT EXISTS sport_card_telemetry_reason_details (
  card_id INTEGER NOT NULL,
  owner_epoch INTEGER NOT NULL,
  reason_codes TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY(card_id,owner_epoch),
  FOREIGN KEY(card_id,owner_epoch)
    REFERENCES sport_card_telemetry_reviews(card_id,owner_epoch) ON DELETE CASCADE
);

INSERT INTO sport_world_cards (id,distance_cm,time_unit,sub_value,difficulty,ruleset,created_at,current_owner_id,owner_since,owner_epoch)
SELECT id,distance_cm,time_unit,sub_value,difficulty,ruleset,created_at,current_owner_id,owner_since,owner_epoch FROM _bos_track_20261015_sport_world_cards;
INSERT INTO sport_verified_runs (user_id,run_id,card_id,completed_at,verified_at,evidence_digest,evidence_source)
SELECT user_id,run_id,card_id,completed_at,verified_at,evidence_digest,evidence_source FROM _bos_track_20261015_sport_verified_runs;
INSERT INTO sport_card_achievements (user_id,card_id,first_run_id,first_validated_at,successful_runs,last_validated_at)
SELECT user_id,card_id,first_run_id,first_validated_at,successful_runs,last_validated_at FROM _bos_track_20261015_sport_card_achievements;
INSERT INTO sport_card_ownership_events (id,card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
SELECT id,card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at FROM _bos_track_20261015_sport_card_ownership_events;
INSERT INTO sport_card_gift_links (token_hash,card_id,donor_user_id,donor_epoch,created_at,claimed_at,claimed_by)
SELECT token_hash,card_id,donor_user_id,donor_epoch,created_at,claimed_at,claimed_by FROM _bos_track_20261015_sport_card_gift_links;
INSERT INTO sport_card_telemetry_reviews (card_id,owner_epoch,needs_warning,state,created_at,reviewed_at)
SELECT card_id,owner_epoch,needs_warning,state,created_at,reviewed_at FROM _bos_track_20261015_sport_card_telemetry_reviews;
INSERT INTO sport_card_telemetry_reason_details (card_id,owner_epoch,reason_codes)
SELECT card_id,owner_epoch,reason_codes FROM _bos_track_20261015_sport_card_telemetry_reason_details;

UPDATE sqlite_sequence
SET seq=MAX(seq,COALESCE((
  SELECT MAX(old.seq) FROM _bos_track_20261015_sequence AS old
  WHERE old.name=sqlite_sequence.name
),0))
WHERE name IN ('sport_world_cards','sport_card_ownership_events');

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

INSERT INTO _bos_track_20261015_guard(passed)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM sport_world_cards)=
  (SELECT COUNT(*) FROM _bos_track_20261015_sport_world_cards) AND
  (SELECT COUNT(*) FROM sport_verified_runs)=
  (SELECT COUNT(*) FROM _bos_track_20261015_sport_verified_runs) AND
  (SELECT COUNT(*) FROM sport_card_achievements)=
  (SELECT COUNT(*) FROM _bos_track_20261015_sport_card_achievements) AND
  (SELECT COUNT(*) FROM sport_card_ownership_events)=
  (SELECT COUNT(*) FROM _bos_track_20261015_sport_card_ownership_events) AND
  (SELECT COUNT(*) FROM sport_card_gift_links)=
  (SELECT COUNT(*) FROM _bos_track_20261015_sport_card_gift_links) AND
  (SELECT COUNT(*) FROM sport_card_telemetry_reviews)=
  (SELECT COUNT(*) FROM _bos_track_20261015_sport_card_telemetry_reviews) AND
  (SELECT COUNT(*) FROM sport_card_telemetry_reason_details)=
  (SELECT COUNT(*) FROM _bos_track_20261015_sport_card_telemetry_reason_details) AND
  (SELECT COUNT(*) FROM pragma_foreign_key_check)=0 AND
  (SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'
    AND name IN ('sport_card_owner_account_deletion',
      'sport_verified_run_award_v1'))=2
THEN 1 ELSE 0 END;

PRAGMA foreign_key_check;
DROP TABLE _bos_track_20261015_sport_card_telemetry_reason_details;
DROP TABLE _bos_track_20261015_sport_card_telemetry_reviews;
DROP TABLE _bos_track_20261015_sport_card_gift_links;
DROP TABLE _bos_track_20261015_sport_card_ownership_events;
DROP TABLE _bos_track_20261015_sport_card_achievements;
DROP TABLE _bos_track_20261015_sport_verified_runs;
DROP TABLE _bos_track_20261015_sport_world_cards;
DROP TABLE _bos_track_20261015_sequence;
DROP TABLE _bos_track_20261015_guard;

SELECT 'OK - 2 cartes et historiques conserves' AS statut;
SELECT name,sql FROM sqlite_master WHERE name='sport_world_cards';
SELECT 'sport_world_cards' AS tbl,COUNT(*) AS lignes FROM sport_world_cards
UNION ALL SELECT 'sport_verified_runs',COUNT(*) FROM sport_verified_runs
UNION ALL SELECT 'sport_card_achievements',COUNT(*) FROM sport_card_achievements
UNION ALL SELECT 'sport_card_ownership_events',COUNT(*) FROM sport_card_ownership_events
UNION ALL SELECT 'sport_card_gift_links',COUNT(*) FROM sport_card_gift_links
UNION ALL SELECT 'sport_card_telemetry_reviews',COUNT(*) FROM sport_card_telemetry_reviews
UNION ALL SELECT 'sport_card_telemetry_reason_details',COUNT(*) FROM sport_card_telemetry_reason_details;
