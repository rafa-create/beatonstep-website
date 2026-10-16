// Manual, deterministic D1 reclassification plan for existing WORLD card rows.
// Source of truth: ../sport-card-rules.json. This program only prints SQL; it
// never opens a database, deploys a Worker or changes card ownership.
// Apply on a backed-up D1 after confirming the JSON + Worker are deployed
// together, with explicit operator approval. Do not run on automatic builds.
import rules from '../sport-card-rules.json' with {type:'json'};

const tiers=rules.tierOrder;
// The historical label-only backfill covers the original 45 distances.
// The three new track tiers have no legacy D1 rows to reclassify.
const trackCm=new Set([80000,150000,160934]);
const list=Object.entries(rules.capsByDistance)
  .filter(([cm])=>!trackCm.has(Number(cm)))
  .sort((a,b)=>Number(a[0])-Number(b[0]));
if(tiers.length!==7||list.length!==45||
   !list.every(([cm,caps])=>Number.isSafeInteger(Number(cm))&&
      tiers.every(t=>Number.isSafeInteger(caps[t])&&caps[t]>0))){
  throw Error('Unexpected sport-card threshold manifest; refusing SQL generation');
}
const cells=list.map(([cm,caps])=>'('+[Number(cm),...tiers.map(t=>caps[t])].join(',')+')');
const branches=tiers.slice(0,-1).map(t=>
  'WHEN c.sub_value<=limits.'+t+" THEN '"+t+"'").join(' ');
const sql=`-- Proposed reclassification for rule revision ${rules.revision}.
-- MANUAL ONLY, backup production D1 first, run once after review.
-- Changes difficulty labels ONLY; not distance, SUB, run evidence, owners or epochs.
-- Preflight: SELECT COUNT(*) FROM sport_world_cards;
WITH limits(distance_cm,${tiers.join(',')}) AS (
  VALUES
    ${cells.join(',\n    ')}
)
UPDATE sport_world_cards AS c
SET difficulty=(
  SELECT CASE ${branches} ELSE 'beginner' END
  FROM limits WHERE limits.distance_cm=c.distance_cm
)
WHERE c.distance_cm IN (SELECT distance_cm FROM limits)
  AND c.sub_value<=(
    SELECT limits.beginner FROM limits WHERE limits.distance_cm=c.distance_cm
  )
  AND c.difficulty IS NOT (
    SELECT CASE ${branches} ELSE 'beginner' END
    FROM limits WHERE limits.distance_cm=c.distance_cm
  );
-- Postflight: compare all rows with the v2 engine; 43-200 km remain unchanged.
`;
process.stdout.write(sql);
