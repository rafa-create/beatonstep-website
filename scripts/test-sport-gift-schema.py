#!/usr/bin/env python3
"""Simulates permanent sport gift epochs atomically in SQLite memory only."""
from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.execute("CREATE TABLE community_users(id TEXT PRIMARY KEY,handle TEXT UNIQUE)")
for filename in ("0008_sport_world_cards.sql", "0009_sport_card_gift_links.sql"):
    db.executescript((root / "migrations" / filename).read_text(encoding="utf-8"))
db.executemany("INSERT INTO community_users VALUES(?,?)",
               [("alice", "alice"), ("bob", "bob"), ("carol", "carol")])
now = 1790000000000
db.execute("""INSERT INTO sport_world_cards
 (distance_cm,time_unit,sub_value,difficulty,ruleset,created_at,
  current_owner_id,owner_since,owner_epoch)
 VALUES(500000,'minute',19,'expert','sport-cards-v1',?,
        'alice',?,1)""", (now, now))
card = db.execute("SELECT id FROM sport_world_cards").fetchone()[0]
db.execute("""INSERT INTO sport_card_ownership_events
(card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
VALUES(?,NULL,'alice',0,1,'sport_win',?)""", (card, now))
hash1, hash2 = "a"*64, "b"*64
for hashed in (hash1,hash2):
    created = db.execute("""INSERT INTO sport_card_gift_links
     (token_hash,card_id,donor_user_id,donor_epoch,created_at)
     SELECT ?,c.id,c.current_owner_id,c.owner_epoch,?
     FROM sport_world_cards c WHERE c.id=? AND c.current_owner_id=?
       AND c.owner_epoch>=1 RETURNING donor_epoch""",
     (hashed,now,card,"alice")).fetchone()
    assert created == (1,)

def claim(token, donor, recipient, expected_epoch, at):
    with db:
        added=db.execute("""INSERT INTO sport_card_ownership_events
          (card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
          SELECT c.id,c.current_owner_id,?,c.owner_epoch,c.owner_epoch+1,
            'gift_claim',?
          FROM sport_card_gift_links g
          JOIN sport_world_cards c ON c.id=g.card_id
          WHERE g.token_hash=? AND g.claimed_at IS NULL
            AND g.donor_user_id=? AND c.current_owner_id=g.donor_user_id
            AND c.owner_epoch=g.donor_epoch AND c.current_owner_id<>?""",
          (recipient,at,token,donor,recipient)).rowcount
        changed=db.execute("""UPDATE sport_world_cards SET
          current_owner_id=?,owner_since=?,owner_epoch=owner_epoch+1
          WHERE id=? AND current_owner_id=? AND owner_epoch=?
            AND EXISTS(SELECT 1 FROM sport_card_ownership_events e
              WHERE e.card_id=? AND e.previous_epoch=? AND e.new_epoch=?
                AND e.new_owner_id=? AND e.reason='gift_claim'
                AND e.changed_at=?)""",
          (recipient,at,card,donor,expected_epoch,card,expected_epoch,
           expected_epoch+1,recipient,at)).rowcount
        consumed=db.execute("""UPDATE sport_card_gift_links SET claimed_at=?,claimed_by=?
          WHERE token_hash=? AND claimed_at IS NULL
            AND card_id=? AND donor_user_id=? AND donor_epoch=?
            AND EXISTS(SELECT 1 FROM sport_world_cards c
              WHERE c.id=? AND c.current_owner_id=?
                AND c.owner_epoch=? AND c.owner_since=?)""",
          (at,recipient,token,card,donor,expected_epoch,
           card,recipient,expected_epoch+1,at)).rowcount
    return added,changed,consumed

assert claim(hash1,"alice","bob",1,now+1000)==(1,1,1)
assert claim(hash1,"alice","carol",1,now+2000)==(0,0,0)
assert claim(hash2,"alice","carol",1,now+3000)==(0,0,0)
assert db.execute("SELECT current_owner_id,owner_epoch FROM sport_world_cards").fetchone()==("bob",2)
# Return the same card to Alice in a new ownership epoch. Old invitation stays
# a viewable historical token but can NEVER be redeemed again.
db.execute("""INSERT INTO sport_card_ownership_events
 (card_id,previous_owner_id,new_owner_id,previous_epoch,new_epoch,reason,changed_at)
 VALUES(?,'bob','alice',2,3,'sport_win',?)""",(card,now+4000))
db.execute("""UPDATE sport_world_cards SET
 current_owner_id='alice',owner_epoch=3,owner_since=? WHERE id=?""",(now+4000,card))
assert claim(hash2,"alice","carol",1,now+5000)==(0,0,0)
assert db.execute("SELECT COUNT(*) FROM sport_card_gift_links").fetchone()[0]==2
assert db.execute("SELECT COUNT(*) FROM sport_card_ownership_events").fetchone()[0]==3
# Deletion of a previous donor retains the non-expiring link as public
# card history without leaking a deleted account.
db.execute("DELETE FROM community_users WHERE id='bob'")
assert db.execute("PRAGMA foreign_key_check").fetchall()==[]
print("PASS sport gift SQL: first claimant, epoch protection, replay, persistent link, FK")
