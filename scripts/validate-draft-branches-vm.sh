#!/usr/bin/env bash
# BeatOnStep: one read-only VM preflight for the two NEW website draft branches.
# No merge, deployment, migrations, D1 production access or iPhone build.
set -euo pipefail

SITE_REPO="${SITE_REPO:-/home/ubuntu/beatonstep-website}"
test -d "$SITE_REPO/.git" || git -C "$SITE_REPO" rev-parse --is-inside-work-tree >/dev/null
command -v npm >/dev/null
command -v node >/dev/null
command -v python3 >/dev/null
node -e "if(+process.versions.node.split('.')[0]<20)process.exit(1)"

BRANCHES=(
  feature/454-password-reset-email
  feature/454-sport-card-rules-v1
)

echo "=== FETCH DRAFT BRANCHES (NO CHECKOUT MODIFICATION) ==="
for branch in "${BRANCHES[@]}"; do
  git -C "$SITE_REPO" fetch --no-tags origin "+refs/heads/$branch:refs/remotes/origin/$branch"
done

TEMPROOT="$(mktemp -d /tmp/beatonstep-site-preflight-XXXXXX)"
MOUNTED=()
cleanup(){
  for workdir in "${MOUNTED[@]}"; do
    git -C "$SITE_REPO" worktree remove --force "$workdir" >/dev/null 2>&1 || true
  done
  rm -rf "$TEMPROOT"
}
trap cleanup EXIT

for branch in "${BRANCHES[@]}"; do
  label="${branch##*/}"
  checkout="$TEMPROOT/$label"
  git -C "$SITE_REPO" worktree add --detach "$checkout" "origin/$branch"
  MOUNTED+=("$checkout")
  sha="$(git -C "$checkout" rev-parse HEAD)"
  echo
  echo "=== BUILD + REGRESSIONS: $branch ==="
  echo "SOURCE_SHA=$sha"
  cd "$checkout"
  # This repository intentionally does not commit package-lock.json.
  # npm ci would fail before the tests; install without a persistent lockfile.
  npm install --no-audit --no-fund --no-package-lock
  npm run build
  if [ "$label" = '454-password-reset-email' ]; then
    node --test tests/password-reset.test.mjs
    python3 - <<'PY'
from pathlib import Path
s=Path('migrations/0007_community_password_reset.sql').read_text()
assert 'CREATE TABLE IF NOT EXISTS community_password_reset_tokens' in s
assert 'DROP TABLE' not in s.upper()
print('PASS new password reset migration is additive / never applied')
PY
  else
    node --test tests/sport-card-rules.test.mjs
    python3 scripts/test-distance-d1.py
  fi
  python3 - <<'PY'
import json,re
from pathlib import Path
s=Path('wrangler.jsonc').read_text()
flags=re.findall(r'"DISTANCE_CHALLENGES_ENABLED"\s*:\s*"([^"]+)"',s)
assert not flags or all(v=='false' for v in flags),f'Unsafe distance flag {flags}'
print('PASS distance challenges disabled or absent from this draft config')
PY
  echo "PASS $label@$sha"
done

echo
echo "=== SITE DRAFTS GREEN — UNIT/BUILD ONLY, NOT DEPLOYED ==="
echo "No D1 migration, signed app, production website or feature flag changed."
