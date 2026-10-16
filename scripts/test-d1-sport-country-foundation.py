#!/usr/bin/env python3
"""Local-only dry run of the country-card foundation; never accesses D1."""
import sqlite3
from pathlib import Path

sql = (Path(__file__).resolve().parent.parent /
       "migrations/0011_sport_country_cards_foundation.sql").read_text()

# Do not allow this preparation migration to touch historic tables/data.
statements = "\n".join(line for line in sql.splitlines()
                       if not line.lstrip().startswith("--")).upper()
for destructive in ("DROP ", "ALTER ", "DELETE ", "UPDATE ", "INSERT "):
    assert destructive not in statements, destructive

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE community_users(id TEXT PRIMARY KEY);
CREATE TABLE sport_world_cards(
  id INTEGER PRIMARY KEY,
  distance_cm INTEGER NOT NULL,
  time_unit TEXT NOT NULL,
  sub_value INTEGER NOT NULL,
  UNIQUE(distance_cm,time_unit,sub_value)
);
INSERT INTO sport_world_cards
  (id,distance_cm,time_unit,sub_value) VALUES
  (1,500000,'minute',25),(2,1000000,'minute',45);
""")
original = db.execute("SELECT * FROM sport_world_cards ORDER BY id").fetchall()
db.executescript(sql)
db.executescript(sql)  # Must be idempotent.
assert db.execute("SELECT * FROM sport_world_cards ORDER BY id").fetchall() == original

def add(world_id, country, stamp=1792000000000):
    db.execute("""INSERT INTO sport_country_cards
      (world_card_id,country_code,created_at) VALUES (?,?,?)""",
      (world_id,country,stamp))

def must_reject(*args):
    try:
        add(*args)
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Invalid country-card edition was accepted: " + str(args))

add(1,"FR")
add(1,"IT")  # One performance has distinct country editions.
add(2,"FR")  # One country has multiple performances.
must_reject(1,"FR")  # Identical performance and country cannot duplicate.
must_reject(1,"fr")  # Non-canonical casing.
must_reject(1,"FRA")  # Must be alpha-2.
must_reject(12345,"FR")  # Country edition requires an existing world card.
must_reject(1,"US",0)  # Timestamp must be positive.

assert db.execute("SELECT COUNT(*) FROM sport_country_cards").fetchone()[0] == 3
assert db.execute("PRAGMA foreign_key_check").fetchall() == []
assert db.execute("SELECT * FROM sport_world_cards ORDER BY id").fetchall() == original
print("PASS additive country-card foundation: idempotent, world preserved, uniqueness and FK")
