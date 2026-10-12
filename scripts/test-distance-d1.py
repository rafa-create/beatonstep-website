#!/usr/bin/env python3
"""SQLite smoke test for #421 migration 0006, entirely in memory.

No credentials, Cloudflare API, external DB, production access or network.
The surrounding tables are minimal stubs of already deployed 0003/0004.
"""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations/0006_distance_challenge_sport_clock.sql"

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE community_users(id TEXT PRIMARY KEY);
CREATE TABLE shared_items(id INTEGER PRIMARY KEY);
CREATE TABLE workout_cards(
    share_id INTEGER PRIMARY KEY REFERENCES shared_items(id),
    owner_user_id TEXT REFERENCES community_users(id)
);
INSERT INTO community_users(id) VALUES('alice'),('bob');
INSERT INTO shared_items(id) VALUES(41);
INSERT INTO workout_cards(share_id,owner_user_id) VALUES(41,'alice');
""")
sql = MIGRATION.read_text(encoding="utf-8")
db.executescript(sql)
db.executescript(sql)  # IF NOT EXISTS protects repeated schema preparation

ADD = """INSERT INTO workout_distance_attempts_v2
 (attempt_id,share_id,user_id,result,completed_at,accepted_at,
  goal_distance_m,deadline_sec,measured_distance_m,elapsed_sport_sec,
  sample_count,evidence_sha256,location_source,evidence_status)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"""


def insert_attempt(attempt_id, who, status, meters, sport_sec,
                   source="phone_gps", evidence="plausible"):
    db.execute(ADD, (
        attempt_id, 41, who, status, 100000, 100001,
        5000, 1800, meters, sport_sec, 61, "a" * 64, source, evidence
    ))


def rejected(call, reason):
    try:
        call()
    except sqlite3.IntegrityError:
        return
    raise AssertionError(reason)


insert_attempt("attempt-1", "bob", "won", 5002, 1720)
rejected(lambda: insert_attempt("attempt-1", "bob", "won", 5002, 1720),
         "attempt replay must be rejected")
rejected(lambda: insert_attempt("late", "bob", "won", 5100, 1801),
         "winning after canonical sporting deadline must fail")
rejected(lambda: insert_attempt("short", "bob", "won", 4999, 1600),
         "winning without covering distance must fail")
rejected(lambda: insert_attempt("uncertain", "bob", "won", 5000, 1700,
                                evidence="unverified"),
         "an uncertain GPS record cannot be marked as won")
rejected(lambda: insert_attempt("fake-source", "bob", "won", 5000, 1700,
                                source="cadence_guess"),
         "a non-GPS source cannot be stored as sporting evidence")
insert_attempt("attempt-lost", "alice", "lost", 3200, 1800)
db.execute("""INSERT INTO workout_distance_validations_v2
(user_id,share_id,first_attempt_id,first_validated_at)
VALUES(?,?,?,?)""", ("bob", 41, "attempt-1", 100001))
rejected(lambda: db.execute("""INSERT INTO workout_distance_validations_v2
(user_id,share_id,first_attempt_id,first_validated_at)
VALUES(?,?,?,?)""", ("bob", 41, "attempt-1", 100002)),
         "first success cannot be written twice")
db.execute("UPDATE workout_cards SET owner_user_id='bob' WHERE share_id=41")
db.execute("UPDATE workout_cards SET owner_user_id='alice' WHERE share_id=41")
assert db.execute("""SELECT COUNT(*) FROM workout_distance_validations_v2
 WHERE user_id='bob' AND share_id=41""").fetchone()[0] == 1
assert db.execute("""SELECT owner_user_id FROM workout_cards
 WHERE share_id=41""").fetchone()[0] == "alice"
assert db.execute("""SELECT COUNT(*) FROM workout_distance_attempts_v2
 WHERE result='won'""").fetchone()[0] == 1

print("PASS #421 D1 0006: idempotent DDL, sport clock checks, anti-replay,")
print("     GPS source guard, distinct achievement surviving card transfers")
