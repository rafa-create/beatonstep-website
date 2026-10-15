-- BeatOnStep — D1, vérifier avant de modifier la structure des cartes.
-- Cloudflare > D1 > beatonstep-catalog-prod > Console.
-- 1) Recenser les tables et déclencheurs qui référencent les cartes :
SELECT type,name,sql
FROM sqlite_master
WHERE name LIKE 'sport_%'
   OR sql LIKE '%REFERENCES sport_world_cards%'
   OR sql LIKE '%REFERENCES sport_card_telemetry_reviews%'
ORDER BY type,name;

-- 2) Si les sept tables sportives existent, vérifier les quantités.
-- Toute valeur supérieure à ZERO bloque la réinitialisation fournie.
SELECT
 (SELECT COUNT(*) FROM sport_world_cards) AS cartes,
 (SELECT COUNT(*) FROM sport_verified_runs) AS courses_validees,
 (SELECT COUNT(*) FROM sport_card_achievements) AS exploits,
 (SELECT COUNT(*) FROM sport_card_ownership_events) AS transferts,
 (SELECT COUNT(*) FROM sport_card_gift_links) AS cadeaux,
 (SELECT COUNT(*) FROM sport_card_telemetry_reviews) AS examens,
 (SELECT COUNT(*) FROM sport_card_telemetry_reason_details) AS motifs;

-- 3) Vérifier l'état des clés étrangères.
PRAGMA foreign_key_check;
