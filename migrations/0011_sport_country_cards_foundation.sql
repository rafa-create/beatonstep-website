CREATE TABLE IF NOT EXISTS sport_country_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_card_id INTEGER NOT NULL
    REFERENCES sport_world_cards(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL
    CHECK(length(country_code)=2 AND country_code GLOB '[A-Z][A-Z]'),
  created_at INTEGER NOT NULL CHECK(created_at>0),
  UNIQUE(world_card_id,country_code)
);
CREATE INDEX IF NOT EXISTS sport_country_cards_country_world
  ON sport_country_cards(country_code,world_card_id);

-- PROPOSAL ONLY - NOT APPLIED BY A WEBSITE DEPLOY.
-- # Future worldwide-unique + country-unique sporting card collections
--
-- Existing sport_world_cards remain immutable and world-unique using the
-- original UNIQUE(distance_cm,time_unit,sub_value) constraint.
-- An edition here points to that same world performance key. A given
-- world_card_id can have one and only one edition for each country_code.
--
-- This is deliberately ONLY a structural foundation: NO owner, award, gift,
-- transfer, location, public API or migration of existing data is activated.
-- No rows should be inserted until country eligibility and ownership rules
-- have been separately approved and implemented.
--
-- country_code is canonical ISO 3166-1 alpha-2, upper-case; its *format*
-- is checked by SQLite, while *membership* must be validated server-side
-- against a versioned ISO list before a future insert. Never accept client
-- claims of GPS, home, or arbitrary country as proof of eligibility.
--
-- Manual D1 execution requires a separate, explicit decision and a fresh
-- remote schema check / Time Travel bookmark. Committing this file does
-- NOT mutate the production D1 database.
