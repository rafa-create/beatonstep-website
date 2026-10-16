// #445/#449: private read-only world-sport collection; independent of music.
import {readSportWarningReasons} from './sport-card-telemetry.js';
// Not an award endpoint. No client can turn an account_run_records recap into
// verified sporting success or a world-unique ownership transfer.
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
}});
const whole=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const n=x=>x==null?null:Number(x);
const date=x=>whole(n(x),1,4102444800000)?n(x):null;
const bool=x=>Number(x)===1;
export const displaySportCard=(distanceCm,timeUnit,subValue)=>{
  const distance=distanceCm===40000?'400 m':
    distanceCm===2109750?'Semi-marathon':
    distanceCm===4219500?'Marathon':
    (distanceCm/100000).toLocaleString('fr-FR')+' km';
  return distance+' · SUB '+subValue+(timeUnit==='second'?' s':' min');
};
const pageResult=(rows,mapper)=>{
  const list=rows.results||[],page=list.slice(0,50);
  return {items:page.map(mapper),hasMore:list.length>50,last:page.at(-1)||null};
};
export async function readSportWorldCollection(db,userId,url,{telemetryEnabled=false}={}){
  const path=url.pathname;
  if(!['/api/account/device/sport/deck',
       '/api/account/device/sport/history'].includes(path))
    return respond({error:'not_found'},404);
  if(path.endsWith('/deck')){
    const raw=url.searchParams.get('after')||'0',after=Number(raw);
    if(!whole(after,0,Number.MAX_SAFE_INTEGER))return respond({error:'invalid_cursor'},400);
    // One global object per exact sub N; current possession and achievement
    // are independent, and ghost cards are only for former owners.
    const rows=await db.prepare(`SELECT
      c.id,c.distance_cm,c.time_unit,c.sub_value,c.difficulty,c.owner_since,
      c.owner_epoch,CASE WHEN c.current_owner_id=? THEN 1 ELSE 0 END AS owned,
      ${telemetryEnabled ? `(SELECT CASE WHEN tr.state='warning' THEN 1 ELSE 0 END
         FROM sport_card_telemetry_reviews tr
         WHERE tr.card_id=c.id AND tr.owner_epoch=c.owner_epoch)
      ` : '0'} AS performance_warning,
      ${telemetryEnabled ? `EXISTS(SELECT 1 FROM sport_card_telemetry_reviews tr
        JOIN sport_card_ownership_events e ON e.card_id=tr.card_id
          AND e.new_epoch=tr.owner_epoch
        WHERE tr.card_id=c.id AND tr.state='warning'
          AND e.reason='sport_win' AND e.new_owner_id=a.user_id)` : '0'}
        AS ghost_performance_warning,
      ${telemetryEnabled ? `(SELECT sp.peak_speed_kmh
        FROM sport_card_telemetry_speed_details sp
        WHERE sp.card_id=c.id AND sp.owner_epoch=c.owner_epoch)` : 'NULL'}
        AS current_peak_speed_kmh,
      ${telemetryEnabled ? `(SELECT MAX(sp.peak_speed_kmh)
        FROM sport_card_telemetry_speed_details sp
        JOIN sport_card_telemetry_reviews tr
          ON tr.card_id=sp.card_id AND tr.owner_epoch=sp.owner_epoch
        JOIN sport_card_ownership_events e
          ON e.card_id=tr.card_id AND e.new_epoch=tr.owner_epoch
        WHERE tr.card_id=c.id AND tr.state='warning'
          AND e.reason='sport_win' AND e.new_owner_id=a.user_id)` : 'NULL'}
        AS ghost_peak_speed_kmh,
      a.first_validated_at,a.successful_runs,
      (SELECT e.changed_at FROM sport_card_ownership_events e
       WHERE e.card_id=c.id AND e.new_owner_id=?
       ORDER BY e.new_epoch DESC LIMIT 1) AS last_received_at,
      (SELECT e.reason FROM sport_card_ownership_events e
       WHERE e.card_id=c.id AND e.new_owner_id=?
       ORDER BY e.new_epoch DESC LIMIT 1) AS last_received_reason,
      (SELECT e.changed_at FROM sport_card_ownership_events e
       WHERE e.card_id=c.id AND e.previous_owner_id=?
       ORDER BY e.previous_epoch DESC LIMIT 1) AS last_lost_at,
      (SELECT MIN(e.changed_at) FROM sport_card_ownership_events e
       WHERE e.card_id=c.id AND e.new_owner_id=? AND e.reason='gift_claim')
       AS first_gift_at,
      (SELECT MIN(g.changed_at) FROM sport_card_ownership_events g
       WHERE g.card_id=c.id AND g.new_owner_id=? AND g.reason='gift_claim'
       AND EXISTS(SELECT 1 FROM sport_verified_runs r
         WHERE r.card_id=c.id AND r.user_id=?
           AND r.verified_at>g.changed_at
           AND r.verified_at<COALESCE((
             SELECT MIN(x.changed_at) FROM sport_card_ownership_events x
             WHERE x.card_id=g.card_id AND x.previous_epoch=g.new_epoch
           ),4102444800000)
       )) AS verified_gift_at,
      (SELECT MIN(r.verified_at) FROM sport_verified_runs r
       JOIN sport_card_ownership_events g ON g.card_id=r.card_id
       AND g.new_owner_id=? AND g.reason='gift_claim'
       WHERE r.card_id=c.id AND r.user_id=?
         AND r.verified_at>g.changed_at
         AND r.verified_at<COALESCE((
           SELECT MIN(x.changed_at) FROM sport_card_ownership_events x
           WHERE x.card_id=g.card_id AND x.previous_epoch=g.new_epoch
         ),4102444800000)
       ) AS verified_after_gift_at
     FROM sport_world_cards c
     LEFT JOIN sport_card_achievements a
       ON a.card_id=c.id AND a.user_id=?
     WHERE c.id>? AND (
       c.current_owner_id=? OR a.user_id IS NOT NULL OR EXISTS(
         SELECT 1 FROM sport_card_ownership_events x
         WHERE x.card_id=c.id AND
           (x.new_owner_id=? OR x.previous_owner_id=?)
       ))
     ORDER BY c.id ASC LIMIT 51`)
      .bind(userId,userId,userId,userId,userId,userId,userId,userId,userId,
        userId,after,userId,userId,userId).all();
    const result=pageResult(rows,row=>{
      const currentlyOwned=bool(row.owned);
      const validatedAt=date(row.first_validated_at);
      const acquiredAt=date(row.last_received_at);
      const lostAt=currentlyOwned?null:date(row.last_lost_at);
      // Do not manufacture tenure if a legacy/incomplete epoch is missing.
      const end=currentlyOwned?Date.now():lostAt;
      const heldMs=acquiredAt!=null&&end!=null&&end>=acquiredAt
        ?end-acquiredAt:null;
      return {
        id:row.id,
        name:displaySportCard(row.distance_cm,row.time_unit,row.sub_value),
        distanceCm:row.distance_cm,timeUnit:row.time_unit,
        subValue:row.sub_value,difficulty:row.difficulty,
        currentlyOwned,ghost:!currentlyOwned&&acquiredAt!=null,
        performanceWarning:currentlyOwned?bool(row.performance_warning):bool(row.ghost_performance_warning),
        peakSpeedKmh:(currentlyOwned?row.current_peak_speed_kmh:row.ghost_peak_speed_kmh)??null,
        personallyValidated:validatedAt!=null,
        firstValidatedAt:validatedAt,
        successfulAttempts:Number(row.successful_runs)||0,
        firstGiftAt:date(row.first_gift_at),
        verifiedGiftAt:date(row.verified_gift_at),
        lastReceivedAt:acquiredAt,
        lastReceivedReason:row.last_received_reason||null,
        verifiedAfterGiftAt:date(row.verified_after_gift_at),
        lostAt, heldDurationMs:heldMs,
        // Authenticated user only; epoch carries no other runner identity.
        // Needed so an offline "confirmed" card can become a ghost when
        // a later competing run or gift transfers the global tier.
        ownerEpoch:row.owner_epoch,
      };
    });
    return respond({items:result.items,nextCursor:result.hasMore?result.last.id:null});
  }
  const raw=url.searchParams.get('beforeAt')||'0',beforeAt=Number(raw);
  const beforeKey=url.searchParams.get('beforeKey')||'';
  if(!whole(beforeAt,0,4102444800000)||
    (beforeAt!==0&&!/^(?:ownership:[1-9]\d*|run:[a-zA-Z0-9_.:-]{1,128})$/.test(beforeKey)))
    return respond({error:'invalid_cursor'},400);
  const rows=await db.prepare(`WITH event_feed AS (
    SELECT e.changed_at AS happened_at,'ownership:'||e.id AS event_key,
      e.card_id AS card_id,
      CASE WHEN e.new_owner_id=? THEN
         CASE WHEN e.reason='gift_claim' THEN 'gift_received' ELSE 'won' END
       WHEN e.reason='gift_claim' THEN 'given'
       ELSE 'lost' END AS event_type,
      NULL AS run_id,
      ${telemetryEnabled ? `CASE WHEN e.reason='sport_win' AND tr.state='warning'
        THEN 1 ELSE 0 END AS performance_warning,
        rd.reason_codes AS warning_reasons,spd.peak_speed_kmh AS peak_speed_kmh`
        : '0 AS performance_warning,NULL AS warning_reasons,NULL AS peak_speed_kmh'}
    FROM sport_card_ownership_events e
    ${telemetryEnabled ? `LEFT JOIN sport_card_telemetry_reviews tr
      ON tr.card_id=e.card_id AND tr.owner_epoch=e.new_epoch
      LEFT JOIN sport_card_telemetry_reason_details rd
      ON rd.card_id=e.card_id AND rd.owner_epoch=e.new_epoch
      LEFT JOIN sport_card_telemetry_speed_details spd
      ON spd.card_id=e.card_id AND spd.owner_epoch=e.new_epoch` : ''}
    WHERE e.previous_owner_id=? OR e.new_owner_id=?
    UNION ALL
    SELECT r.verified_at AS happened_at,'run:'||r.run_id AS event_key,
      r.card_id,'verified' AS event_type,r.run_id,
      0 AS performance_warning,NULL AS warning_reasons
    FROM sport_verified_runs r WHERE r.user_id=?
  )
  SELECT e.happened_at,e.event_key,e.card_id,e.event_type,e.run_id,
    e.performance_warning,e.warning_reasons,e.peak_speed_kmh,
    c.distance_cm,c.time_unit,c.sub_value
  FROM event_feed e JOIN sport_world_cards c ON c.id=e.card_id
  WHERE ?=0 OR e.happened_at<? OR
    (e.happened_at=? AND e.event_key<?)
  ORDER BY e.happened_at DESC,e.event_key DESC LIMIT 51`)
    .bind(userId,userId,userId,userId,
      beforeAt,beforeAt,beforeAt,beforeKey).all();
  const result=pageResult(rows,row=>({
    key:row.event_key,cardId:row.card_id,
    name:displaySportCard(row.distance_cm,row.time_unit,row.sub_value),
    eventType:row.event_type,at:date(row.happened_at),
    runId:row.run_id||null,
    ...(row.event_type==='won'&&bool(row.performance_warning)
      ?{performanceWarning:true,
        warningReasons:readSportWarningReasons(row.warning_reasons),
        peakSpeedKmh:row.peak_speed_kmh??null}
      :{}),
  }));
  return respond({items:result.items,
    nextCursor:result.hasMore?{
      beforeAt:result.last.happened_at,beforeKey:result.last.event_key,
    }:null});
}
