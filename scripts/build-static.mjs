import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { SPORT_CARD_DISTANCES,sportCardRulesManifest } from '../worker/sport-card-rules.js';

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
  // Published pages, JS and public documents must never point to the retired
  // GitHub Pages site rather than the canonical Cloudflare domain.
  if (readFileSync(join(root, entry), 'utf8').includes('rafa-create.github.io/beatonstep-website')) {
    throw Error('Retired public site URL found in ' + entry + '; use https://beatonstep.app/');
  }
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
  ruleset: manifest.ruleset,
  revision: manifest.revision,
  levels: [...manifest.tierOrder],
  ultraDifficulty: manifest.ultraDifficulty,
  // Same world-finisher calibration used by the card gallery and app.
  percentileTargets: {...manifest.percentileCalibration.estimatedPercentileTargets},
  distances: [
    ...SPORT_CARD_DISTANCES.map(({distanceCm,code}) => ({
      distanceCm,code,
      unit:(manifest.secondResolutionDistancesCm||[]).includes(distanceCm)
        ?'second':'minute',
      caps:manifest.capsByDistance[String(distanceCm)]||null,
      ultra:distanceCm>=manifest.ultraStartCm,
      previewOnly:false,
    })),
    ...pendingTrack.map(distanceCm=>({
      distanceCm,
      code:distanceCm===80000?'800m':distanceCm===150000?'1500m':'mile',
      unit:manifest.pendingTrackUnit==='second'?'second':'minute',
      caps:manifest.pendingTrackCapsByDistance[String(distanceCm)],
      ultra:false,previewOnly:true,
    })),
  ].sort((a,b)=>a.distanceCm-b.distanceCm),
};
writeFileSync(join(out, 'sport-card-paliers.json'), JSON.stringify(guide));

// Derive the seven visual finishes from the SAME official JSON as the
// sporting thresholds. Neither the CSS nor the browser JS owns a palette.
if(manifest.cardVisuals){
  const visualKeys=[...manifest.tierOrder].reverse();
  const visuals=manifest.cardVisuals;
  if(Object.keys(visuals).length!==visualKeys.length)
    throw Error('Card visuals must define precisely the seven tiers');
  const names={
    beginner:['Débutant','Beginner'],
    amateur:['Amateur','Amateur'],
    regular:['Régulier','Regular'],
    intermediate:['Intermédiaire','Intermediate'],
    expert:['Expert','Expert'],
    legend:['Légende','Legend'],
    world_elite:['Élite mondiale','World elite'],
  };
  const generatedCss=[],generatedLevels={};
  for(const [index,tier] of visualKeys.entries()){
    const skin=visuals[tier];
    if(!skin||!/^#[0-9a-fA-F]{6}$/.test(skin.accent)||
       !/^#[0-9a-fA-F]{6}$/.test(skin.shade)||
       typeof skin.symbol!=='string'||skin.symbol.length<1||skin.symbol.length>8)
      throw Error('Invalid card visual skin for '+tier);
    generatedCss.push('.sport-skin--'+tier+
      '{--sport-accent:'+skin.accent+';--sport-shade:'+skin.shade+'}');
    generatedLevels[tier]=[...names[tier],skin.symbol,index+1];
  }
  const cssFile=join(out,'sport-card-face.css');
  const css=readFileSync(cssFile,'utf8');
  const cssMarker='/*__SPORT_CARD_COLORS__*/';
  if(!css.includes(cssMarker))throw Error('Card CSS generator marker missing');
  writeFileSync(cssFile,css.replace(cssMarker,generatedCss.join('\n')));
  const jsFile=join(out,'sport-card-face.js');
  const js=readFileSync(jsFile,'utf8');
  const jsMarker='/*__SPORT_CARD_LEVELS__*/{}';
  if(!js.includes(jsMarker))throw Error('Card JS generator marker missing');
  writeFileSync(jsFile,js.replace(jsMarker,JSON.stringify(generatedLevels)));
}

console.log('Cloudflare static assets prepared in dist/');
