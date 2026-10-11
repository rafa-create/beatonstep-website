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
