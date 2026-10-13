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
