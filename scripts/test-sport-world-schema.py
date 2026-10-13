#!/usr/bin/env python3
"""In-memory SQLite safety check for 0008 (NEVER touches Cloudflare D1)."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
sql = (ROOT / "migrations/0008_sport_world_cards.sql").read_text(encoding="utf-8")
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.execute("CREATE TABLE community_users(id TEXT PRIMARY KEY, handle TEXT UNIQUE)")
db.executescript(sql)

db.executemany("INSERT INTO community_users(id,handle) VALUES(?,?)",
               [("runner1", "first"), ("runner2", "second")])
now = 1790000000000
db.execute("""INSERT INTO sport_world_cards(
  distance_cm,time_unit,sub_value,difficulty,ruleset,created_at,
  current_owner_id,owner_since,owner_epoch)
  VALUES(1000000,'minute',40,'expert','sport-cards-v1',?, 'runner1',?,1)""",
           (now, now))
card = db.execute("SELECT id FROM sport_world_cards").fetchone()[0]
db.execute("""INSERT INTO sport_card_ownership_events(
  card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
  VALUES(?,NULL,'runner1',0,1,'sport_win',?)""", (card, now))
db.execute("""INSERT INTO sport_verified_runs(
  user_id,run_id,card_id,completed_at,verified_at,evidence_digest,evidence_source)
  VALUES('runner1','run-unique-1',?,?,?,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'attested_phone')""", (card, now, now))
db.execute("""INSERT INTO sport_card_achievements(
  user_id,card_id,first_run_id,first_validated_at,successful_runs,last_validated_at)
  VALUES('runner1',?,'run-unique-1',?,1,?)""", (card, now, now))
# The same world tier can only exist once.
try:
    db.execute("""INSERT INTO sport_world_cards(
      distance_cm,time_unit,sub_value,difficulty,ruleset,created_at)
      VALUES(1000000,'minute',40,'expert','sport-cards-v1',?)""", (now,))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Duplicate exact world tier was accepted")

# The same verified run cannot award a second tier.
try:
    db.execute("""INSERT INTO sport_verified_runs(
      user_id,run_id,card_id,completed_at,verified_at,evidence_digest,evidence_source)
      VALUES('runner1','run-unique-1',?,?,?,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'attested_phone')""", (card, now, now))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Duplicate verified run was accepted")

# A voluntary gift does not revoke the original runner's proven achievement.
db.execute("""INSERT INTO sport_card_ownership_events(
  card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
  VALUES(?,'runner1','runner2',1,2,'gift_claim',?)""", (card, now+5000))
db.execute("""UPDATE sport_world_cards SET current_owner_id='runner2',
  owner_since=?,owner_epoch=2 WHERE id=?""", (now+5000, card))
assert db.execute("""SELECT COUNT(*) FROM sport_card_achievements
  WHERE user_id='runner1' AND card_id=?""", (card,)).fetchone()[0] == 1

# A later account closure releases, rather than locks or deletes, the world card.
db.execute("DELETE FROM community_users WHERE id='runner2'")
assert db.execute("""SELECT current_owner_id,owner_since,owner_epoch
  FROM sport_world_cards WHERE id=?""", (card,)).fetchone() == (None, None, 3)
assert db.execute("""SELECT reason FROM sport_card_ownership_events
  WHERE card_id=? AND new_epoch=3""", (card,)).fetchone()[0] == "account_closed"
db.execute("DELETE FROM community_users WHERE id='runner1'")
assert db.execute("""SELECT COUNT(*) FROM sport_world_cards
  WHERE id=?""", (card,)).fetchone()[0] == 1
assert db.execute("""SELECT COUNT(*) FROM sport_card_achievements
  WHERE card_id=?""", (card,)).fetchone()[0] == 0
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
print("PASS world sport schema: isolation, UNIQUE, single-run guard, gift retention, account deletion")
