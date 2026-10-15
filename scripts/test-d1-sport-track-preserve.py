#!/usr/bin/env python3
"""Run a full D1 sport migration rehearsal on an IN-MEMORY SQLite fixture.

Usage from website repository root:
    python3 scripts/test-d1-sport-track-preserve.py

Never connects to Cloudflare or mutates production. Exact committed SQL is used.
"""
import sqlite3
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
PATH=ROOT/'scripts/d1-sport-track-preserve-20261015.sql'
TABLES=[
    'sport_world_cards','sport_verified_runs','sport_card_achievements',
    'sport_card_ownership_events','sport_card_gift_links',
    'sport_card_telemetry_reviews','sport_card_telemetry_reason_details',
]
MIGRATIONS=[
    '0008_sport_world_cards.sql','0009_sport_card_gift_links.sql',
    '0010_sport_verified_award_trigger.sql',
    '0011_sport_card_telemetry_reviews.sql',
    '0012_sport_card_telemetry_reason_details.sql',
]
SQL=PATH.read_text(encoding='utf-8')

def fixture():
    db=sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript("""CREATE TABLE community_users (id TEXT PRIMARY KEY);
      INSERT INTO community_users VALUES ('user-a'),('user-b');""")
    for name in MIGRATIONS:
        statement=(ROOT/'migrations'/name).read_text(encoding='utf-8')
        if name.startswith('0008'):
            new=("(distance_cm IN (40000,80000,150000,160934) AND time_unit='second') OR\n"
                 "    (distance_cm NOT IN (40000,80000,150000,160934) AND time_unit='minute')")
            old=("(distance_cm=40000 AND time_unit='second') OR\n"
                 "    (distance_cm<>40000 AND time_unit='minute')")
            assert new in statement,'official new-time constraint changed'
            statement=statement.replace(new,old)
        db.executescript(statement)
    db.executemany("""INSERT INTO sport_world_cards
        (distance_cm,time_unit,sub_value,difficulty,ruleset,created_at)
        VALUES (?,?,?,?,'sport-cards-v1',1690000000000)""",[
        (40000,'second',134,'regular'),
        (500000,'minute',29,'expert'),
    ])
    db.executemany("""INSERT INTO sport_verified_runs
        (user_id,run_id,card_id,completed_at,verified_at,evidence_digest,evidence_source)
        VALUES (?,?,?,1690000000000,1690000000001,?,'attested_phone')""",[
        ('user-a','run-1000000000000-1000000134000',1,'a'*64),
        ('user-b','run-1000000000000-1000001740000',2,'b'*64),
    ])
    db.executemany("""INSERT INTO sport_card_gift_links
        (token_hash,card_id,donor_user_id,donor_epoch,created_at)
        VALUES (?,?,?,?,1690000000002)""",[
        ('c'*64,1,'user-a',1),('d'*64,2,'user-b',1),
    ])
    db.executemany("""INSERT INTO sport_card_telemetry_reviews
        (card_id,owner_epoch,needs_warning,state,created_at)
        VALUES (?,1,0,'clear',1690000000002)""",[(1,),(2,)])
    assert [db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0]
            for t in TABLES]==[2,2,2,2,2,2,0]
    assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
    db.commit()
    return db

def snapshot(db):
    return {t:db.execute('SELECT * FROM '+t+' ORDER BY rowid').fetchall()
            for t in TABLES}

def apply_local(db):
    # Cloudflare D1 executes a submitted batch transactionally. Python's
    # executescript doesn't; the explicit BEGIN/COMMIT is for the LOCAL test.
    db.executescript('BEGIN;\n'+SQL+'\nCOMMIT;')

def test_preservation():
    db=fixture()
    before=snapshot(db)
    seq_before=dict(db.execute("""SELECT name,seq FROM sqlite_sequence
      WHERE name IN ('sport_world_cards','sport_card_ownership_events')"""))
    apply_local(db)
    assert snapshot(db)==before,'migration altered cards, owners, gifts or history'
    assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
    assert dict(db.execute("""SELECT name,seq FROM sqlite_sequence
      WHERE name IN ('sport_world_cards','sport_card_ownership_events')"""))==seq_before
    assert db.execute("""SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'
      AND name IN ('sport_card_owner_account_deletion',
                   'sport_verified_run_award_v1')""").fetchone()[0]==2
    for cm in (40000,80000,150000,160934):
        db.execute("""INSERT INTO sport_world_cards
          (distance_cm,time_unit,sub_value,difficulty,ruleset,created_at)
          VALUES (?,'second',60,'world_elite','sport-cards-v1',1690000000003)""",(cm,))
        try:
            db.execute("""INSERT INTO sport_world_cards
              (distance_cm,time_unit,sub_value,difficulty,ruleset,created_at)
              VALUES (?,'minute',60,'world_elite','sport-cards-v1',1690000000003)""",(cm,))
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError('invalid minute precision accepted for '+str(cm))
    assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
    print('PASS: cards, gift links, ownership epochs, achievements and reviews unchanged')
    print('PASS: IDs, sequences, foreign keys and both triggers unchanged')
    print('PASS: 400m, 800m, 1500m and mile accept seconds; reject minutes')

def test_guard():
    db=fixture()
    db.execute('DELETE FROM sport_card_gift_links WHERE card_id=1')
    db.commit()
    original=snapshot(db)
    try:
        apply_local(db)
    except sqlite3.IntegrityError:
        db.rollback()
    else:
        raise AssertionError('unexpected row counts must abort before DROP')
    assert snapshot(db)==original
    assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
    print('PASS: unexpected counts abort the migration transaction')

def test_remote_runner():
    launcher=(ROOT/'scripts/apply-d1-sport-track-preserve.sh').read_text(encoding='utf-8')
    assert SQL.startswith('CREATE TABLE _bos_track_20261015_guard'), \
        'CRITICAL: Wrangler rejects SQL files starting with comment --'
    assert not any(line.lstrip().startswith('--') for line in SQL.splitlines()), \
        'Cloudflare Wrangler D1 remote query must not receive SQL comments'
    assert '--command="$SQL_PAYLOAD"' in launcher, 'use D1 query endpoint, not importer'
    assert 'tail -n 70 "$QUERY_OUTPUT"' in launcher, 'never hide Wrangler errors'
    assert 'if grep -Eq' in launcher, 'comment safety gate missing'
    assert 'SQL_PAYLOAD="$(cat "$SQL")"' in launcher
    assert 'wrangler22 d1 execute "$DB" --remote --file=' not in launcher
    assert 'BOS_CLEAN_OK' in launcher and 'BOS_GUARD_ONLY_OK' in launcher
    assert 'time-travel info' in launcher and 'pragma_foreign_key_check' in launcher
    print('PASS: VM runner uses query API and checks safe D1 recovery states')

if __name__=='__main__':
    test_preservation()
    test_guard()
    test_remote_runner()
    print('D1 track preserve migration local rehearsal: OK')
