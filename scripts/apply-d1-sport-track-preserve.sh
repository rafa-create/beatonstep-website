#!/usr/bin/env bash
# One command on the authorized Oracle VM: local rehearsal, D1 bookmark,
# preservation migration, and verified remote postflight.
# Never restores a D1 bookmark automatically and never modifies music data.
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DB="beatonstep-catalog-prod"
SQL="scripts/d1-sport-track-preserve-20261015.sql"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$HOME/beatonstep-d1-track-$STAMP.log"
BOOKMARK_FILE="$HOME/beatonstep-d1-track-$STAMP.bookmark"

fail() { printf '\nERREUR: %s\n' "$*" >&2; exit 1; }
trap 'printf "\nSTOP : une commande a echoue. Consultez %s ; verifier D1 avant toute relance.\n" "$LOG" >&2' ERR

test -f "$SQL" || fail "Script SQL absent: $SQL"
test -f scripts/test-d1-sport-track-preserve.py ||
  fail "Test de repetition SQLite absent"
: > "$LOG"

wrangler22() {
  npm exec --yes --package=node@22 --package=wrangler@4.129.1 -- wrangler "$@"
}

printf '\n(1/5) Repetition SQLite sans acces a la production...\n'
python3 scripts/test-d1-sport-track-preserve.py | tee -a "$LOG"

printf '\n(2/5) Bookmark Cloudflare D1 AVANT la migration...\n'
wrangler22 d1 time-travel info "$DB" | tee -a "$LOG"
BOOKMARK="$(sed -n "s/.*current bookmark is '\([^']*\)'.*/\1/p" "$LOG" | tail -n 1)"
[[ "$BOOKMARK" =~ ^[0-9a-fA-F-]{30,}$ ]] ||
  fail "Aucun bookmark verifiable, aucune migration lancee"
printf '%s\n' "$BOOKMARK" > "$BOOKMARK_FILE"
printf 'Bookmark enregistre localement : %s\n' "$BOOKMARK_FILE"

printf '\n(3/5) Verification distante avant reprise (aucune table sportive ne doit manquer)...\n'
PREFLIGHT=$(wrangler22 d1 execute "$DB" --remote --command "
SELECT CASE WHEN
 (SELECT COUNT(*) FROM sport_world_cards)=2 AND
 (SELECT COUNT(*) FROM sport_verified_runs)=2 AND
 (SELECT COUNT(*) FROM sport_card_achievements)=2 AND
 (SELECT COUNT(*) FROM sport_card_ownership_events)=2 AND
 (SELECT COUNT(*) FROM sport_card_gift_links)=2 AND
 (SELECT COUNT(*) FROM sport_card_telemetry_reviews)=2 AND
 (SELECT COUNT(*) FROM sport_card_telemetry_reason_details)=0 AND
 (SELECT COUNT(*) FROM sqlite_master
  WHERE type IN ('table','trigger','view')
  AND sql LIKE '%sport_world_cards%')=8 AND
 (SELECT COUNT(*) FROM sqlite_master
  WHERE type='trigger'
  AND name IN ('sport_card_owner_account_deletion',
    'sport_verified_run_award_v1'))=2 AND
 (SELECT COUNT(*) FROM sqlite_master
  WHERE type='table' AND name='sport_world_cards'
  AND sql LIKE '%distance_cm=40000 AND time_unit=%')=1 AND
 (SELECT COUNT(*) FROM sqlite_master
  WHERE type='table' AND name='_bos_track_20261015_guard') IN (0,1) AND
 (SELECT COUNT(*) FROM sqlite_master
  WHERE type='table' AND name='_bos_track_20261015_guard'
  AND sql LIKE '%passed INTEGER NOT NULL CHECK(passed=1)%')=
 (SELECT COUNT(*) FROM sqlite_master
  WHERE type='table' AND name='_bos_track_20261015_guard') AND
 (SELECT COUNT(*) FROM sqlite_master
  WHERE name GLOB '_bos_track_20261015_*'
  AND name<>'_bos_track_20261015_guard')=0 AND
 (SELECT COUNT(*) FROM pragma_foreign_key_check)=0
 THEN CASE WHEN (SELECT COUNT(*) FROM sqlite_master
   WHERE type='table' AND name='_bos_track_20261015_guard')=1
   THEN 'BOS_GUARD_ONLY_OK' ELSE 'BOS_CLEAN_OK' END
 ELSE 'STOP_UNEXPECTED_D1_STATE' END AS migration_preflight;
" | tee -a "$LOG")
printf '%s\n' "$PREFLIGHT"
[[ "$PREFLIGHT" == *BOS_GUARD_ONLY_OK* || "$PREFLIGHT" == *BOS_CLEAN_OK* ]] ||
  fail "Etat D1 inattendu : aucune table ne sera supprimee, migration annulee"

printf '\n(4/5) Migration SQL via API QUERY (sans import de fichier)...\n'
if [[ "$PREFLIGHT" == *BOS_GUARD_ONLY_OK* ]]; then
  echo 'Retrait UNIQUEMENT du garde obsolete...' | tee -a "$LOG"
  wrangler22 d1 execute "$DB" --remote --command \
    "DROP TABLE _bos_track_20261015_guard;" | tee -a "$LOG"
fi
printf 'Lancement du SQL conservateur en un lot de requetes...\n'
printf 'Si les sept quantites ou les 8 dependances ont change, le SQL doit echouer avant tout DROP.\n'
# Wrangler interprete un SQL qui commence par "--" comme des options CLI.
# Ne JAMAIS mettre de commentaires en tete des fichiers SQL D1.
SQL_PAYLOAD="$(cat "$SQL")"
[[ "$SQL_PAYLOAD" == "CREATE TABLE _bos_track_20261015_guard"* ]] ||
  fail "SQL ne commence pas par la declaration du garde, aucun SQL envoye"
if grep -Eq '^[[:space:]]*--' "$SQL"; then
  fail "Commentaires SQL detectes : le lot D1 doit etre sans commentaires"
fi
# --file utilise le moteur import D1 (D1_RESET_DO); --command utilise query.
# Sortie capturee dans un fichier pour ne JAMAIS masquer le diagnostic API.
QUERY_OUTPUT="$HOME/beatonstep-d1-track-$STAMP.query.out"
if ! wrangler22 d1 execute "$DB" --remote --json \
  --command="$SQL_PAYLOAD" > "$QUERY_OUTPUT" 2>&1; then
  printf '\nECHEC D1 : voici la reponse de Wrangler (aucune relance automatique) :\n' >&2
  tail -n 70 "$QUERY_OUTPUT" >&2
  fail "Lot QUERY refuse; examiner le message Cloudflare et la base"
fi
cat "$QUERY_OUTPUT" >> "$LOG"
python3 -c '
import sys,json
r=json.load(sys.stdin)
if not isinstance(r,list) or len(r)<30 or any(not x.get("success") for x in r):
  raise SystemExit("Resultat SQL manquant ou erreur dans le lot")
rows=[row for x in r for row in x.get("results",[])]
if not any(row.get("statut")=="OK - 2 cartes et historiques conserves" for row in rows):
  raise SystemExit("Le lot SQL na pas atteint son resultat final")
expect={"sport_world_cards":2, "sport_verified_runs":2,
"sport_card_achievements":2,"sport_card_ownership_events":2,
"sport_card_gift_links":2,"sport_card_telemetry_reviews":2,
"sport_card_telemetry_reason_details":0}
got={row["tbl"]:row["lignes"] for row in rows if "tbl" in row and "lignes" in row}
if got!=expect: raise SystemExit("Comptages non conserves")
print("PASS - lot QUERY complet, cartes et historiques conserves")
' < "$QUERY_OUTPUT" || fail "SQL non confirme complet; verifier D1 avant toute relance"

printf '\n(5/5) Verification distante cartes, historique, FK, triggers et secondes...\n'
POSTFLIGHT=$(wrangler22 d1 execute "$DB" --remote --command "
SELECT CASE WHEN
  (SELECT COUNT(*) FROM sport_world_cards)=2 AND
  (SELECT COUNT(*) FROM sport_verified_runs)=2 AND
  (SELECT COUNT(*) FROM sport_card_achievements)=2 AND
  (SELECT COUNT(*) FROM sport_card_ownership_events)=2 AND
  (SELECT COUNT(*) FROM sport_card_gift_links)=2 AND
  (SELECT COUNT(*) FROM sport_card_telemetry_reviews)=2 AND
  (SELECT COUNT(*) FROM sport_card_telemetry_reason_details)=0 AND
  (SELECT COUNT(*) FROM pragma_foreign_key_check)=0 AND
  (SELECT COUNT(*) FROM sqlite_master
   WHERE type='trigger' AND name IN
    ('sport_card_owner_account_deletion','sport_verified_run_award_v1'))=2 AND
  (SELECT COUNT(*) FROM sqlite_master
   WHERE type='table' AND name='sport_world_cards'
   AND sql LIKE '%distance_cm IN (40000,80000,150000,160934)%')=1 AND
  (SELECT COUNT(*) FROM sqlite_master
   WHERE name GLOB '_bos_track_20261015_*')=0
THEN 'PASS' ELSE 'FAIL' END AS migration_d1;
" | tee -a "$LOG")
printf '%s\n' "$POSTFLIGHT"
echo "$POSTFLIGHT" | grep -Eq 'PASS' ||
  fail "Postflight non valide ; ne pas reexecuter le SQL, verifier le journal"
printf '\nSUCCES : migration D1 validee, deux cartes et historiques conserves.\n'
printf 'Journal : %s\nBookmark : %s\n' "$LOG" "$BOOKMARK_FILE"
