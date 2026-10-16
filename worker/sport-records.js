// Read-only historical sporting records. No migrations and no persisted rankings.
import {difficultyForSportCard,sportCardDifficultyFilterSql,
  sportCardRulesManifest} from './sport-card-rules.js';

const manifest=sportCardRulesManifest();
const tiers=[...manifest.tierOrder];
const topFirst=[...tiers];
const maxTop=3;
const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'},
});
const safeHandle=value=>typeof value==='string'&&
  /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(value)?value:null;

// A holding epoch ends with the NEXT ownership event, including account
// deletion. Only the current matching owner/epoch can have an open period.
// Deleted accounts and opt-out profiles never expose public handles.
const epochSql=(filter='')=>`SELECT
 e.card_id AS card_id,e.new_epoch AS epoch,
 c.distance_cm AS distance_cm,c.time_unit AS time_unit,
 c.sub_value AS sub_value,e.changed_at AS started_at,
 next.changed_at AS ended_at,
 CASE WHEN next.id IS NULL THEN 1 ELSE 0 END AS ongoing,
 CASE WHEN COALESCE(p.show_challenges,0)=0 THEN NULL ELSE u.handle END
  AS holder_handle
 FROM sport_card_ownership_events e
 JOIN sport_world_cards c ON c.id=e.card_id
 LEFT JOIN sport_card_ownership_events next ON
  next.card_id=e.card_id AND next.previous_epoch=e.new_epoch
 LEFT JOIN community_users u ON u.id=e.new_owner_id
 LEFT JOIN community_profile_settings p ON p.user_id=e.new_owner_id
 WHERE e.reason IN ('sport_win','gift_claim')
  AND e.changed_at<=?
  AND (
   (next.id IS NOT NULL AND next.changed_at>=e.changed_at)
   OR (next.id IS NULL AND c.current_owner_id=e.new_owner_id
       AND c.owner_epoch=e.new_epoch)
  )${filter?' AND '+filter:''}
 ORDER BY (COALESCE(next.changed_at,?)-e.changed_at) DESC,
   e.card_id ASC,e.new_epoch ASC LIMIT 3`;

function holding(row,now){
  if(!row||!Number.isSafeInteger(row.started_at))return null;
  const end=row.ongoing===1?now:row.ended_at;
  if(!Number.isSafeInteger(end)||end<row.started_at)return null;
  const difficulty=difficultyForSportCard(row.distance_cm,row.sub_value)?.difficulty;
  if(!difficulty)return null;
  return {
    cardId:row.card_id,distanceCm:row.distance_cm,
    timeUnit:row.time_unit,subValue:row.sub_value,
    difficulty,holder:safeHandle(row.holder_handle),
    durationMs:end-row.started_at,ongoing:row.ongoing===1,
  };
}

async function longest(db,now,level){
  const filter=level==='all'?'':sportCardDifficultyFilterSql(level);
  const rows=await db.prepare(epochSql(filter)).bind(now,now).all();
  return (rows.results||[]).map(row=>holding(row,now)).filter(Boolean);
}

// Difficulty-first ranking uses the CURRENT canonical rules, NOT the snapshot
// stored when a card was originally earned. Three epochs maximum per tier.
// Avoid compound SELECT/UNION: Cloudflare D1 can reject long unions.
async function hardest(db,now,level){
  if(level!=='all')return longest(db,now,level);
  const winners=[];
  for(const tier of topFirst){
    const rows=await longest(db,now,tier);
    winners.push(...rows);
    if(winners.length>=maxTop)break;
  }
  return winners.slice(0,maxTop);
}

export async function readSportRecords(db,url,{now=Date.now()}={}){
  if(url.pathname!=='/api/sport/records')return json({error:'not_found'},404);
  const sort=url.searchParams.get('sort')||'duration';
  const level=url.searchParams.get('level')||'all';
  if(!['duration','difficulty'].includes(sort)||
     (level!=='all'&&!tiers.includes(level))||
     [...url.searchParams.keys()].some(k=>!['sort','level'].includes(k)))
    return json({error:'invalid_record_filter'},400);
  if(!Number.isSafeInteger(now)||now<=0)
    return json({error:'invalid_timestamp'},500);
  const [holders,counts]=await Promise.all([
    sort==='duration'?longest(db,now,level):hardest(db,now,level),
    db.prepare(`SELECT u.handle AS holder_handle,COUNT(*) AS cards
      FROM sport_world_cards c
      JOIN community_users u ON u.id=c.current_owner_id
      LEFT JOIN community_profile_settings p ON p.user_id=u.id
      WHERE p.show_challenges=1
      GROUP BY u.id,u.handle
      ORDER BY cards DESC,u.handle ASC LIMIT 3`).all(),
  ]);
  return json({
    sort,level,asOf:now,tierRevision:manifest.revision,
    holdings:holders.slice(0,maxTop),
    collections:(counts.results||[]).map(row=>({
      holder:safeHandle(row.holder_handle),cards:Number(row.cards)||0,
    })).filter(row=>row.holder&&row.cards>0),
  });
}
