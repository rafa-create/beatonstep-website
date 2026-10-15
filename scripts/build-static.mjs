import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { SPORT_CARD_DISTANCES, SPORT_CARD_400M_TIERS,
  maxSubMinuteByTier,sportCardRulesManifest } from '../worker/sport-card-rules.js';

const root = process.cwd();
const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Explicit allowlist: never publish Worker sources, SQL, repository metadata,
// private configuration or environment files as website assets.
const directories = ['assets', 'badges', 'store', 'screenshots-archive'];
const rootFile = /^(?:[a-zA-Z0-9_-]+\.(?:html|css|js|json|md))$/;
for (const entry of readdirSync(root)) {
  if (!rootFile.test(entry) || !statSync(join(root, entry)).isFile()) continue;
  cpSync(join(root, entry), join(out, entry));
}
for (const dir of directories) {
  if (existsSync(join(root, dir))) {
    cpSync(join(root, dir), join(out, dir), { recursive: true });
  }
}
if (!existsSync(join(out, 'index.html')) || !existsSync(join(out, 'partages.html'))) {
  throw Error('Required website pages are missing from dist');
}
// Derive the public card guide from the exact same versioned rules as awards.
// Never maintain a second hand-written schedule of SUB boundaries in the site.
const manifest=sportCardRulesManifest();
const pendingTrack=manifest.pendingTrackDistancesCm||[];
if(pendingTrack.some(cm=>manifest.distancesCm.includes(cm))||
   pendingTrack.some(cm=>!manifest.pendingTrackCapsByDistance?.[cm]))
  throw Error('Pending track preview may not be active before D1 schema migration');
const guide = {
  ruleset: 'sport-cards-v1',
  levels: [...manifest.tierOrder],
  // Same world-finisher calibration used by the card gallery and app.
  percentileTargets: {...manifest.percentileCalibration.estimatedPercentileTargets},
  distances: [
    ...SPORT_CARD_DISTANCES.map(({distanceCm,code}) => ({
      distanceCm,code,
      unit:distanceCm===40000?'second':'minute',
      caps:distanceCm===40000
        ?Object.fromEntries(SPORT_CARD_400M_TIERS.map(({difficulty,maxSubSecond})=>
            [difficulty,maxSubSecond]))
        :maxSubMinuteByTier(distanceCm),
      ultra:distanceCm>=4300000,
      previewOnly:false,
    })),
    ...pendingTrack.map(distanceCm=>({
      distanceCm,
      code:distanceCm===80000?'800m':distanceCm===150000?'1500m':'mile',
      unit:'second',
      caps:manifest.pendingTrackCapsByDistance[String(distanceCm)],
      ultra:false,previewOnly:true,
    })),
  ].sort((a,b)=>a.distanceCm-b.distanceCm),
};
writeFileSync(join(out, 'sport-card-paliers.json'), JSON.stringify(guide));
console.log('Cloudflare static assets prepared in dist/');
