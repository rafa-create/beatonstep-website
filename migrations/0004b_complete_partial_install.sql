-- 0004b: complete a partial 0004 D1 installation (3 initial tables present).
-- SAFE TO REPEAT: CREATE IF NOT EXISTS only. No UPDATE, INSERT, DELETE or DROP.
-- Execute in beatonstep-catalog-prod after backup; CARDS_ENABLED must be off.
-- If D1 Console reports incomplete input for a trigger, paste each complete
-- CREATE TRIGGER ... END; statement separately, preserving uppercase BEGIN
-- and Unix LF line endings.
CREATE INDEX IF NOT EXISTS workout_cards_stock
  ON workout_cards(pack_eligible,owner_user_id,share_id);
CREATE INDEX IF NOT EXISTS workout_card_aliases_target
  ON workout_card_aliases(canonical_share_id);
CREATE INDEX IF NOT EXISTS workout_card_history_share
  ON workout_card_history(share_id,id DESC);

CREATE TABLE IF NOT EXISTS workout_pack_claims (
  user_id TEXT PRIMARY KEY REFERENCES community_users(id) ON DELETE CASCADE,
  share_id INTEGER NOT NULL UNIQUE REFERENCES shared_items(id) ON DELETE CASCADE,
  claimed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_card_gifts (
  token_hash TEXT PRIMARY KEY,
  share_id INTEGER NOT NULL REFERENCES workout_cards(share_id) ON DELETE CASCADE,
  expected_owner_id TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  expires_at INTEGER NOT NULL,
  redeemed_by TEXT REFERENCES community_users(id) ON DELETE SET NULL,
  redeemed_at INTEGER
);
CREATE INDEX IF NOT EXISTS workout_card_gifts_expiry
  ON workout_card_gifts(expires_at);

CREATE TRIGGER IF NOT EXISTS workout_card_history_first
AFTER INSERT ON workout_cards WHEN NEW.owner_user_id IS NOT NULL
BEGIN
  INSERT INTO workout_card_history(share_id,previous_owner_id,new_owner_id,reason,changed_at)
  VALUES(NEW.share_id,NULL,NEW.owner_user_id,'created',NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS workout_card_history_change
AFTER UPDATE OF owner_user_id ON workout_cards
WHEN OLD.owner_user_id IS NOT NEW.owner_user_id
BEGIN
  INSERT INTO workout_card_history(share_id,previous_owner_id,new_owner_id,reason,changed_at)
  VALUES(NEW.share_id,OLD.owner_user_id,NEW.owner_user_id,NEW.last_reason,
         COALESCE(NEW.acquired_at,unixepoch()*1000));
END;

CREATE TRIGGER IF NOT EXISTS workout_card_pack_claim
AFTER UPDATE OF owner_user_id ON workout_cards
WHEN NEW.last_reason='pack' AND NEW.owner_user_id IS NOT NULL
     AND OLD.owner_user_id IS NULL
BEGIN
  INSERT INTO workout_pack_claims(user_id,share_id,claimed_at)
  VALUES(NEW.owner_user_id,NEW.share_id,NEW.acquired_at);
END;

-- A historic duplicate may have a counter already; add it to the canonical
-- card only once, when its alias is first inserted.
CREATE TRIGGER IF NOT EXISTS workout_card_alias_imports
AFTER INSERT ON workout_card_aliases
BEGIN
  UPDATE shared_items SET imports=imports+COALESCE(
    (SELECT imports FROM shared_items WHERE id=NEW.alias_share_id),0)
  WHERE id=NEW.canonical_share_id;
END;


-- Completion inspection: should list 5 tables + 4 triggers.
SELECT name,type FROM sqlite_master
WHERE name IN ('workout_cards','workout_card_aliases','workout_card_history',
  'workout_pack_claims','workout_card_gifts',
  'workout_card_history_first','workout_card_history_change',
  'workout_card_pack_claim','workout_card_alias_imports')
ORDER BY type,name;
