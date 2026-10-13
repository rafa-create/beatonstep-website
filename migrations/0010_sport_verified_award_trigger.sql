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
