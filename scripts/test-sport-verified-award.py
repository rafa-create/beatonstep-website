#!/usr/bin/env python3
"""#445/#450: validate 0010 against SQLite in RAM. No Cloudflare writes."""
from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parents[1] / "migrations"
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.execute("CREATE TABLE community_users(id TEXT PRIMARY KEY,handle TEXT UNIQUE)")
for filename in ("0008_sport_world_cards.sql", "0009_sport_card_gift_links.sql",
                 "0010_sport_verified_award_trigger.sql"):
    db.executescript((root / filename).read_text(encoding="utf-8"))
db.executemany("INSERT INTO community_users VALUES(?,?)", [
    ("runner-a", "runnera"), ("runner-b", "runnerb"), ("runner-c", "runnerc")
])
stamp = 1791900000000
db.execute("""INSERT INTO sport_world_cards(distance_cm,time_unit,sub_value,
difficulty,ruleset,created_at) VALUES(1000000,'minute',40,'expert','sport-cards-v1',?)""",
           (stamp,))
card = db.execute("SELECT id FROM sport_world_cards").fetchone()[0]

def verify(user, run, at, digest="a"*64, card_id=card):
    return db.execute("""INSERT INTO sport_verified_runs
    (user_id,run_id,card_id,completed_at,verified_at,evidence_digest,evidence_source)
    VALUES(?,?,?,?,?,?,'attested_phone')
    ON CONFLICT(user_id,run_id) DO NOTHING""",
    (user,run,card_id,at-100,at,digest)).rowcount

def owner():
    return db.execute("""SELECT current_owner_id,owner_epoch,owner_since
    FROM sport_world_cards WHERE id=?""", (card,)).fetchone()

def event_count():
    return db.execute("""SELECT COUNT(*) FROM sport_card_ownership_events
    WHERE card_id=?""", (card,)).fetchone()[0]

def achievements(user):
    return db.execute("""SELECT successful_runs FROM sport_card_achievements
    WHERE user_id=? AND card_id=?""", (user,card)).fetchone()

assert owner() == (None,0,None)
assert verify("runner-a","session-1",stamp)==1
assert owner()==("runner-a",1,stamp)
assert event_count()==1
assert achievements("runner-a")== (1,)

# Replay is idempotent: no double success, no ownership changes.
assert verify("runner-a","session-1",stamp+10)==0
assert event_count()==1
assert achievements("runner-a")== (1,)

# Same owner runs the exact tier again: personal count grows, no re-award.
assert verify("runner-a","session-2",stamp+20)==1
assert achievements("runner-a")== (2,)
assert owner()==("runner-a",1,stamp)
assert event_count()==1

# Different legitimate runner wins the same EXACT tier: automatic theft.
assert verify("runner-b","session-3",stamp+30)==1
assert owner()==("runner-b",2,stamp+30)
assert event_count()==2
assert achievements("runner-a")== (2,)
assert achievements("runner-b")== (1,)
assert db.execute("""SELECT previous_owner_id,new_owner_id,reason
 FROM sport_card_ownership_events WHERE new_epoch=2 AND card_id=?""",
 (card,)).fetchone()==("runner-a","runner-b","sport_win")

# The same runner later completes another run and recaptures their ghost.
assert verify("runner-a","session-4",stamp+40)==1
assert owner()==("runner-a",3,stamp+40)
assert achievements("runner-a")== (3,)
assert event_count()==3

# Gift can be accepted, but does not create a fake sporting achievement.
db.execute("""INSERT INTO sport_card_ownership_events
 (card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
 VALUES(?,'runner-a','runner-c',3,4,'gift_claim',?)""",(card,stamp+50))
db.execute("""UPDATE sport_world_cards SET current_owner_id='runner-c',
 owner_since=?,owner_epoch=4 WHERE id=?""",(stamp+50,card))
assert achievements("runner-c") is None

# Gift recipient genuinely wins the exact card later: keep same owner epoch,
# and retain DISTINCT receipt and verified timestamps for the UI badge.
assert verify("runner-c","session-5",stamp+60)==1
assert owner()==("runner-c",4,stamp+50)
assert achievements("runner-c")== (1,)
assert event_count()==4
assert db.execute("""SELECT verified_at FROM sport_verified_runs
 WHERE user_id='runner-c' AND run_id='session-5'""").fetchone()==(stamp+60,)

# Another athlete steals; gift recipient keeps their verified achievement.
assert verify("runner-b","session-6",stamp+70)==1
assert owner()==("runner-b",5,stamp+70)
assert achievements("runner-c")== (1,)

# A verified run may NOT be reused to claim a SECOND distance/tier card.
db.execute("""INSERT INTO sport_world_cards(distance_cm,time_unit,sub_value,
 difficulty,ruleset,created_at)
 VALUES(500000,'minute',19,'expert','sport-cards-v1',?)""",(stamp,))
other=db.execute("""SELECT id FROM sport_world_cards WHERE distance_cm=500000""").fetchone()[0]
assert verify("runner-a","session-4",stamp+80,card_id=other)==0
assert db.execute("""SELECT current_owner_id FROM sport_world_cards
 WHERE id=?""",(other,)).fetchone()==(None,)

assert db.execute("PRAGMA foreign_key_check").fetchall()==[]
print("PASS verified sport award: one tier/run, atomic theft, ghost recovery, "
      "gift-then-win, replay, separate ownership and personal achievements")
