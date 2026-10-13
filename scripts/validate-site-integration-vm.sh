#!/usr/bin/env bash
# Site integration dry-run: no merge into main, no deploy, no production D1.
# Ubuntu VM: execute via git show FETCH_HEAD:scripts/validate-site-integration-vm.sh | bash
set -euo pipefail
SITE_REPO="${SITE_REPO:-/home/ubuntu/beatonstep-website}"
BRANCH="integration/website-cards-account-20261013"
test -d "$SITE_REPO/.git" || git -C "$SITE_REPO" rev-parse --is-inside-work-tree >/dev/null
for tool in git npm node python3; do
  command -v "$tool" >/dev/null || { echo "Missing $tool"; exit 2; }
done

TEMP_DIR="$(mktemp -d /tmp/beatonstep-site-integration-XXXXXX)"
WORKTREE="$TEMP_DIR/site"
cleanup(){
  git -C "$SITE_REPO" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  # Keep logs even if npm fails, so failures can be diagnosed.
  echo "Local validation logs: $TEMP_DIR"
}
trap cleanup EXIT
echo "=== Resolve integration without changing main ==="
git -C "$SITE_REPO" fetch --no-tags origin \
  "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
git -C "$SITE_REPO" worktree add --detach "$WORKTREE" "origin/$BRANCH"
cd "$WORKTREE"
echo "INTEGRATION_SHA=$(git rev-parse HEAD)"
echo "NODE_VERSION=$(node --version)"
echo "NPM_VERSION=$(npm --version)"

# The website deliberately does NOT ship a package-lock.json.
# Ignore node_modules in the original checkout, no command touches its deps.
echo "=== Install isolated website test dependencies ==="
npm install --no-audit --no-fund --no-package-lock >"$TEMP_DIR/install.log" 2>&1 || {
  tail -n 60 "$TEMP_DIR/install.log"; exit 1;
}

echo "=== Worker and account syntax ==="
for filename in worker/index.js worker/account.js worker/pack.js \
  worker/distance-challenge.js worker/sport-card-rules.js; do
  node --check "$filename"
done

echo "=== Complete website build and Node regressions ==="
if npm run build >"$TEMP_DIR/build.log" 2>&1; then
  grep -E '^ℹ tests |^ℹ pass |^ℹ fail |^# tests |^# pass |^# fail |PASS|passed' \
    "$TEMP_DIR/build.log" | tail -n 25 || true
else
  tail -n 100 "$TEMP_DIR/build.log"
  echo "FAILED website npm run build"
  exit 1
fi

echo "=== Distance migration fixtures on local in-memory SQLite ==="
if npm run test:distance-d1 >"$TEMP_DIR/distance-d1.log" 2>&1; then
  tail -n 15 "$TEMP_DIR/distance-d1.log"
else
  tail -n 60 "$TEMP_DIR/distance-d1.log"
  echo "FAILED local SQLite distance test"
  exit 1
fi

echo "=== No-deployment, security and product release gates ==="
python3 - <<'PY'
from pathlib import Path
import json
config=json.loads(Path('wrangler.jsonc').read_text())
assert config['vars'].get('DISTANCE_CHALLENGES_ENABLED')=='false'
assert config['previews']['vars'].get('DISTANCE_CHALLENGES_ENABLED')=='false'
assert config['previews']['vars'].get('COMMUNITY_SIGNUPS_ENABLED')=='false'
assert config['previews']['vars'].get('CARDS_ENABLED')=='false'
assert config['assets']['run_worker_first']==[
  '/api/*','/partages.html','/cadeau','/cadeau/']
assert len([x for x in Path('migrations').iterdir() if x.name.startswith('0007_')])==1
assert 'CREATE TABLE IF NOT EXISTS community_password_reset_tokens' in Path(
  'migrations/0007_community_password_reset.sql').read_text()
account=Path('worker/account.js').read_text()
assert "value.length>=6" in account
assert 'requestPasswordReset(db,env,request,ctx)' in account
assert 'results[4]?.meta?.changes!==1' in account
assert "community_password_reset_tokens" in account
index=Path('worker/index.js').read_text()
assert 'accountRequest(request, env, url, ctx)' in index
assert 'myChallengeAchievements' in account
assert 'migrations/0005_workout_challenge_validations.sql' in str(
  [str(p) for p in Path('migrations').iterdir()]), '0005 must stay tracked'
assert Path('migrations/0006_distance_challenge_sport_clock.sql').exists()
assert Path('worker/sport-card-rules.js').exists()
print('PASS feature flags OFF, signup limit 6, account reset and cards coexist')
print('PASS D1 0005/0006 retained and 0007 prepared but NEVER executed')
PY

echo "=== INTEGRATION VM GREEN ==="
echo "No merge, deploy, production D1 migration or mail-provider call was performed."
