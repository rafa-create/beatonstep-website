#!/usr/bin/env node
/**
 * Manual Oracle VM -> Cloudflare release gate. No GitHub Actions, no
 * Cloudflare request, no secret inspection, no deployment or D1 write.
 * Run after npm run check && node scripts/build-static.mjs.
 */
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
assert.equal(config.name,'beatonstep-website');
assert.equal(config.main,'./worker/index.js');
assert.equal(config.vars.CATALOG_BACKEND,'d1');
assert.ok(config.d1_databases.some(x=>
  x.binding==='DB'&&x.database_name==='beatonstep-catalog-prod'),
  'Expected existing production D1 binding, never a newly created DB');
assert.ok(config.assets.run_worker_first.includes('/api/*'),
  'API routes must reach the Cloudflare Worker');
assert.equal(config.assets.binding,'ASSETS');
assert.equal(config.assets.directory,'./dist');

const releaseFlags=[
  'SPORT_WORLD_CARDS_ENABLED',
  'SPORT_WORLD_GIFTS_ENABLED',
  'SPORT_AUTO_AWARDS_ENABLED',
];
for(const name of releaseFlags){
  assert.equal(config.vars[name],'false',
    name+' must remain disabled during initial deployment validation');
  assert.equal(config.previews.vars[name],'false',
    name+' must remain disabled in previews');
}
assert.equal(config.vars.SPORT_TELEMETRY_ENABLED,undefined,
  'Running must never require continuous GPS requests');
for(const p of [
  'worker/index.js',
  'worker/account.js',
  'worker/sport-offline-reconciliation.js',
  'worker/sport-world-gifts.js',
  'worker/sport-world-collection.js',
  'migrations/0008_sport_world_cards.sql',
  'migrations/0009_sport_card_gift_links.sql',
  'migrations/0010_sport_verified_award_trigger.sql',
  'dist/index.html',
  'dist/compte.html',
  'dist/cadeau-sport.html',
]){
  assert.ok(existsSync(p),'Missing release artifact: '+p);
}
assert.ok(!existsSync('dist/worker/index.js'),
  'Private Worker files must never be exposed as static assets');
assert.ok(!existsSync('dist/migrations/0010_sport_verified_award_trigger.sql'),
  'SQL migrations must never be exposed as static assets');
const worker=readFileSync('worker/index.js','utf8');
assert.match(worker,/sport_verified_run_award_v1/,
  'The diagnostic endpoint must test readiness of the world-sport trigger');
const account=readFileSync('worker/account.js','utf8');
assert.match(account,/SPORT_AUTO_AWARDS_ENABLED!=='true'/,
  'World-sport post-run reconciliation must be explicitly disabled');
assert.match(account,/SPORT_WORLD_GIFTS_ENABLED!=='true'/,
  'Sports gifts must be explicitly disabled');
assert.doesNotMatch(account,/sportTelemetryRequest|sport\/telemetry/,
  'No online GPS streaming endpoints are permitted');

console.log('PASS manual Oracle VM -> Cloudflare preflight');
console.log('PASS site assets and D1 bindings exist; no GitHub runner needed');
console.log('PASS all world-sport writes and gifts remain OFF');
console.log('NEXT run: ./node_modules/.bin/wrangler deploy --dry-run');
