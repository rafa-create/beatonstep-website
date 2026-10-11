## D1 cutover (11 October 2026)

- Production Wrangler configuration: `CATALOG_BACKEND=d1`. The website and
  mobile application talk to `https://beatonstep.app/api/shared`.
- The new, empty D1 catalogue deliberately does not migrate historic VM cards.
  To prevent an old numeric URL from accidentally displaying an unrelated new
  card, D1 public share IDs use an offset of `1_000_000_000_000`.
  D1 internal row IDs stay ordinary autoincrement integers. Both APIs and the
  public page use the public IDs; all read/counter operations translate them.
- Old low-valued share URLs return HTTP 404 in D1 mode. The legacy VM remains
  available for old mobile versions, but those historic items are not visible
  in the new catalogue.
- The Worker secret `CATALOG_RATE_SALT` and DB binding `DB` must remain
  configured in **Production**. Verify `/api/health` has `catalog=d1`,
  `database=true`, `schemaReady=true`, `publishingConfigured=true`.
- Verify a real publish/list/detail/view/import loop. If there is a problem,
  revert the versioned `CATALOG_BACKEND` to `legacy`; old share IDs and
  counters persist in D1 but disappear from listings while on legacy.

# Cloudflare Workers — BeatOnStep website

The website is intentionally a plain static site. Cloudflare Workers Builds deploys
it directly from the `main` branch: **no GitHub Actions, no GitHub secrets,
no framework adapter and no build server on the music VM**.

## State on 2026-10-11

- The official domain is served by `beatonstep-website` on Cloudflare Workers.
- D1 `beatonstep-catalog-prod` uses binding `DB` and has its new schema
  installed; no old JSON data is needed.
- `partages.html` now uses same-origin `/api/shared`; in `legacy` mode
  the Worker transparently forwards those requests to the prior VM.
- The BeatOnStep mobile public sharing client was updated to use
  `https://beatonstep.app/api/shared` (commit `15d1b4c`);
  **the code commit alone is not proof that an OTA was installed**.
- `GET /api/health` reports `schemaReady` and `publishingConfigured`,
  making the remaining cutover prerequisites explicit.
- Before switching `CATALOG_BACKEND` to `d1`, create the secret
  `CATALOG_RATE_SALT` in the Worker settings and verify:
  `schemaReady: true` and `publishingConfigured: true`.
- Confirm the iOS/Android OTA delivery before changing `CATALOG_BACKEND`.
  Devices running older JavaScript bundles still use the VM; those historic
  clients may continue creating legacy items until they update. We explicitly
  accept losing those items during this early-stage reset.
- The VM keeps music and BPM APIs. The new D1 catalogue stores no private
  audio files, user credentials or running activity.

## Connect the existing Cloudflare project

Cloudflare → Workers & Pages → `beatonstep-website` → Settings → Builds:

| Setting | Value |
| --- | --- |
| Repository | `rafa-create/beatonstep-website` |
| Production branch | `main` |
| Root directory | `/` (repository root) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | Node 22 or higher |

Cloudflare's Worker name **must be exactly `beatonstep-website`** because
`wrangler.jsonc` uses that name. If the Cloudflare project was created
under another name, either rename it there or update the name in Wrangler
before running a new build.

The build copies **only public website files** into `dist/`; it does not
expose `worker/`, `migrations/`, Git metadata, environment variables or
other private configuration. Wrangler deploys these static assets together
with `worker/index.js`. `/api/health` verifies the Worker is actually active.

Smoke test the Cloudflare `*.workers.dev` address **before changing DNS**:
- `/` serves the existing site;
- `/privacy.html`, `/partages.html`, `/app-update.json` work;
- `/api/health` returns `{"status":"ok","catalog":"legacy","database":false}`;
- `/api/shared` still forwards to the existing API until the D1 cutover.

GitHub Pages may continue serving the old domain until DNS is deliberately
moved. **No automatic DNS change is made by this repository.**

## D1: new empty catalogue, no migration

The Worker includes a drop-in D1 API implementation compatible with:
- `POST /api/shared` → `{id,url}`;
- `GET /api/shared?kind=&source=&sort=&page=` → `{total,page,pageSize,items}`;
- `GET /api/shared/:id` → item metadata and payload;
- `POST /api/shared/:id/view` and `/import` → `{counted}`.

D1 mode deliberately stays **disabled** in `wrangler.jsonc` with
`CATALOG_BACKEND=legacy` until the mobile app and the website are changed
together. This avoids a split catalogue where the site reads D1 but existing
mobile apps continue publishing to the legacy VM.

After the static Worker is verified:

1. In the same Cloudflare account, create a **new** D1 database
   `beatonstep-catalog-prod` (do not reuse the SaaS database).
2. Copy its real UUID from the dashboard into `wrangler.jsonc` under
   `"d1_databases": [{"binding":"DB","database_name":"beatonstep-catalog-prod","database_id":"REAL_UUID"}]`.
   Never use a placeholder UUID in a deployed Wrangler configuration.
3. Initialize it exactly once with
   `npx wrangler d1 execute beatonstep-catalog-prod --remote --file=migrations/0001_shared_catalog.sql`.
   This creates empty tables. There is intentionally **no data migration**.
4. Set `CATALOG_RATE_SALT` as a **Worker secret** in Cloudflare (32+ random
   characters). Do not commit the secret to the repository.
5. Before activating D1, change the website's API endpoint in
   `partages.html`, update the mobile app's sharing API target and ship an OTA
   compatible with the new endpoint. Keep read/write on the same backend.
6. Change `CATALOG_BACKEND` in `wrangler.jsonc` to `d1`, deploy, verify
   publishing, listings, detail, importing and counters. Legacy share links
   may become unavailable; this is accepted at this early stage.

The Worker rate-limits anonymous publishing and per-item counters using
daily / time-window SHA-256 buckets in D1. No raw IP address is stored.
Add Cloudflare WAF rate limiting before opening public write traffic at scale.

## Independence

- Builds and deploys run **inside Cloudflare** when `main` is pushed.
- Local emergency release: `npm run deploy` with Wrangler credentials;
  no GitHub workflow is required.
- Only the public share catalogue will move to D1; music/BPM processing stays
  on the BeatOnStep VM and does not need a new native app build.
- Secrets and the D1 UUID are not bundled in static assets.
- At the initial rollout the catalogue remains in legacy mode intentionally,
  so the old site and installed apps keep working.


## Private catalogue moderation (optional, owner-only)

The public catalogue stays anonymous and does not require an account. No signup
endpoint, no community profiles and no mobile login are enabled.

The private entry point is `https://beatonstep.app/admin.html`.
It provides owner login, a list of D1 public cards, and irreversible deletion of
a selected card (after confirmation). The visible number `#0001` is only a
shortened display: the public ID `1000000000001` must be retained in public
URLs, API calls and mobile deep links to avoid collision with old VM cards.

### Before first use

1. Check the *Production* D1 binding `DB` is **beatonstep-catalog-prod**,
   UUID `278e152c-3338-4e0d-adfd-673eac7c60cb`. Do not touch another D1 DB.
2. Apply `migrations/0002_catalog_admin.sql` **once** in that database's
   Cloudflare D1 SQL console (or via `wrangler d1 migrations apply ... --remote`
   after verifying its binding and the target). The migration is additive:
   existing shares, URLs, view counts and import counters remain intact.
3. On a computer with Python 3, run `python3 scripts/provision-admin-sql.py`.
   Provide the owner's e-mail and a unique password of **at least 16 characters**.
   The helper computes PBKDF2-SHA256 with a cryptographic salt, and prints
   one SQL `INSERT`. Only paste it into the verified D1 SQL console.
   The script does not send the password anywhere or write it into a file.
   **Never commit or share the generated SQL**, since it includes the password hash.
   Do not add credentials or real e-mail addresses to this repository.
4. Visit `/admin.html` over HTTPS and log in. The administrator is created
   exclusively by the SQL insert: public sign-up is impossible.
5. Verify the admin can list the public items; delete only a **disposable test**
   publication with explicit consent, then verify its URL is 404 and other
   cards still import normally. If testing on an important existing card, do
   not delete it; there is no undo/backups in this workflow yet.

### Security controls

- No registration route and no admin credentials in Worker vars or GitHub.
- PBKDF2-SHA256 (100k iterations) with per-user random salt, stored in private
  D1 `admin_users`. Session tokens are random 256-bit values; only SHA-256
  hashes are stored in `admin_sessions`. Seven-day
  `__Host-` Secure/HttpOnly/SameSite=Strict cookies.
- Mutating admin API requests require an exact same-origin `Origin` header.
  Deletion checks both an authenticated session and the D1 public ID range,
  so a legacy VM share ID cannot delete a D1 row by mistake.
- D1-backed per-IP login throttling uses `CATALOG_RATE_SALT`; without it,
  login fails closed. Consider mandatory Cloudflare Turnstile if abuse grows.
- `/api/health` keeps checking the original two public tables; new admin
  tables are optional and do not affect public availability.
- Uninitialized moderation returns 503; public shares remain available.
- The admin is separate from future community accounts. If public accounts
  are ever needed, the product decision in BeatOnStep issue #422 still defers
  them until demand is established.
- Never invoke OTA or redeploy the music/BPM VM for website moderation.
