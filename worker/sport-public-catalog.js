// Public, read-only catalogue of verified worldwide sporting cards.
// Independent of historical musical shares and retired publishable V2 challenges.
// Only public handles and transfer motives leave D1; never account IDs or run proofs.
import {canonicalSportDistance,difficultyForSportCard,sportCardDifficultyFilterSql,sportCardDifficultyOrderSql} from './sport-card-rules.js';
import {readSportWarningReasons} from './sport-card-telemetry.js';

const DIFFICULTIES=new Set([
  'beginner','amateur','regular','intermediate','expert','legend','world_elite',
]);
const response=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'},
});
const validId=id=>Number.isSafeInteger(id)&&id>0&&id<=Number.MAX_SAFE_INTEGER;
const safeTime=value=>Number.isSafeInteger(value)&&value>0?value:null;
// A deleted or anonymised account must never leak its internal D1 identifier.
const safeHandle=value=>typeof value==='string'&&
  /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(value)?value:null;

const card=row=>({
  kind:'challenge',id:row.id,distanceCm:row.distance_cm,
  timeUnit:row.time_unit,subValue:row.sub_value,
  difficulty:difficultyForSportCard(row.distance_cm,row.sub_value)?.difficulty??null,
  createdAt:row.created_at,
  owner:safeHandle(row.owner_handle),
  performanceWarning:row.performance_warning===1,
});

export async function readPublicSportCards(db,url,{
  now=Date.now(),telemetryEnabled=false,
}={}){
  const path=url.pathname;
  if(path==='/api/sport/cards'){
    const distanceRaw=url.searchParams.get('distance');
    const difficulty=url.searchParams.get('difficulty')||'all';
    const sort=url.searchParams.get('sort')||'default';
    const rawSub=url.searchParams.get('sub');
    const distance=distanceRaw&&distanceRaw!=='all'?Number(distanceRaw):null;
    const sub=rawSub&&rawSub!=='all'?Number(rawSub):null;
    if((distance!==null&&canonicalSportDistance(distance)===null)||
       (difficulty!=='all'&&!DIFFICULTIES.has(difficulty))||
       !['default','difficulty_asc','difficulty_desc'].includes(sort)||
       (sub!==null&&(!Number.isSafeInteger(sub)||sub<1||sub>1_000_000||distance===null)))
      return response({error:'invalid_sport_filter'},400);
    const rawPage=url.searchParams.get('page')||'1';
    const page=Number(rawPage);
    if(!Number.isSafeInteger(page)||page<1||page>10000)
      return response({error:'invalid_page'},400);
    const filters=[],args=[];
    if(distance!==null){filters.push('c.distance_cm=?');args.push(distance);}
    if(difficulty!=='all'){
      // Never query the stale D1 difficulty snapshot: old test cards and
      // new cards must match exactly the same current JSON tier boundaries.
      filters.push(sportCardDifficultyFilterSql(difficulty,distance));
    }
    // Strict SUB N: the sub-N card itself qualifies; faster tiers are lower N.
    if(sub!==null){filters.push('c.sub_value<=?');args.push(sub);}
    const where=filters.length?' WHERE '+filters.join(' AND '):'';
    const order=sportCardDifficultyOrderSql(sort)||
      'c.distance_cm ASC,c.sub_value DESC,c.id ASC';
    const count=await db.prepare('SELECT COUNT(*) AS total FROM sport_world_cards c'+where)
      .bind(...args).first();
    const rows=await db.prepare(
      'SELECT c.id,c.distance_cm,c.time_unit,c.sub_value,c.difficulty,c.created_at,'+
      (telemetryEnabled?`(SELECT CASE WHEN tr.state='warning' THEN 1 ELSE 0 END
        FROM sport_card_telemetry_reviews tr
        WHERE tr.card_id=c.id AND tr.owner_epoch=c.owner_epoch) `:'0 ')+
      'AS performance_warning,u.handle AS owner_handle FROM sport_world_cards c '+
      'LEFT JOIN community_users u ON u.id=c.current_owner_id'+where+
      ' ORDER BY '+order+' LIMIT 20 OFFSET ?'
    ).bind(...args,(page-1)*20).all();
    return response({items:(rows.results||[]).map(card),total:Number(count?.total)||0,
      page,pageSize:20});
  }
  const match=/^\/api\/sport\/cards\/([1-9][0-9]{0,14})$/.exec(path);
  if(!match)return response({error:'not_found'},404);
  const id=Number(match[1]);
  if(!validId(id))return response({error:'invalid_card'},400);
  const row=await db.prepare(
    'SELECT c.id,c.distance_cm,c.time_unit,c.sub_value,c.difficulty,c.created_at,'+
    (telemetryEnabled?`(SELECT CASE WHEN tr.state='warning' THEN 1 ELSE 0 END
      FROM sport_card_telemetry_reviews tr
      WHERE tr.card_id=c.id AND tr.owner_epoch=c.owner_epoch) `:'0 ')+
    'AS performance_warning,u.handle AS owner_handle FROM sport_world_cards c '+
    'LEFT JOIN community_users u ON u.id=c.current_owner_id WHERE c.id=?'
  ).bind(id).first();
  if(!row)return response({error:'card_not_found'},404);

  // An ownership epoch is a continuous holding period. The next epoch ends it;
  // the ongoing owner is measured up to this request, not counted as finished.
  const longest=await db.prepare(
    'SELECT u.handle AS handle, e.changed_at AS started_at,'+
    'next.changed_at AS ended_at '+
    'FROM sport_card_ownership_events e '+
    'LEFT JOIN sport_card_ownership_events next ON '+
    'next.card_id=e.card_id AND next.previous_epoch=e.new_epoch '+
    'LEFT JOIN community_users u ON u.id=e.new_owner_id '+
    'WHERE e.card_id=? AND e.reason IN (\'sport_win\',\'gift_claim\') '+
    'ORDER BY (COALESCE(next.changed_at,?)-e.changed_at) DESC,e.new_epoch ASC LIMIT 1'
  ).bind(id,now).first();
  const first=await db.prepare(
    'SELECT u.handle AS handle FROM sport_card_ownership_events e '+
    'LEFT JOIN community_users u ON u.id=e.new_owner_id '+
    'WHERE e.card_id=? AND e.reason=\'sport_win\' '+
    'ORDER BY e.new_epoch ASC LIMIT 1'
  ).bind(id).first();
  // Reverse chronology, bounded. No GPS, email, IDs, device or evidence data.
  const historyRows=await db.prepare(
    'SELECT e.reason,e.changed_at,prior.handle AS from_handle,'+
    'recipient.handle AS to_handle,'+
    (telemetryEnabled
      ? "CASE WHEN e.reason='sport_win' AND tr.state='warning' THEN 1 ELSE 0 END "
        +"AS performance_warning,rd.reason_codes AS warning_reasons "
      : '0 AS performance_warning,NULL AS warning_reasons ')+
    'FROM sport_card_ownership_events e '+
    (telemetryEnabled
      ? 'LEFT JOIN sport_card_telemetry_reviews tr ON tr.card_id=e.card_id '+
        'AND tr.owner_epoch=e.new_epoch '+
        'LEFT JOIN sport_card_telemetry_reason_details rd ON rd.card_id=e.card_id '+
        'AND rd.owner_epoch=e.new_epoch '
      : '')+
    'LEFT JOIN community_users prior ON prior.id=e.previous_owner_id '+
    'LEFT JOIN community_users recipient ON recipient.id=e.new_owner_id '+
    'WHERE e.card_id=? ORDER BY e.new_epoch DESC LIMIT 101'
  ).bind(id).all();
  const events=historyRows.results||[];
  return response({...card(row),firstHolder:safeHandle(first?.handle),
    longestHolder:safeHandle(longest?.handle),
    longestHeldMs:longest?.started_at!=null
      ?Math.max(0,(safeTime(longest.ended_at)||now)-longest.started_at):null,
    history:events.slice(0,100).map(e=>({
      reason:e.reason,at:safeTime(e.changed_at),
      from:safeHandle(e.from_handle),to:safeHandle(e.to_handle),
      ...(e.reason==='sport_win'&&Number(e.performance_warning)===1
        ?{performanceWarning:true,
          warningReasons:readSportWarningReasons(e.warning_reasons)}
        :{}),
    })),historyHasMore:events.length>100});
}
