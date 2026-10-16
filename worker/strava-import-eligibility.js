// Pure Strava activity classifier. Only server-fetched athlete activity/streams
// can reach the award adapter. Never trust an imported mobile history snapshot.
const measured=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const runKinds=new Set(['Run','TrailRun','VirtualRun']);

export function classifyStravaSportImport(activity,streams){
  if(!activity||typeof activity!=='object'||!runKinds.has(activity.sport_type||activity.type))
    return {eligible:false,reason:'not_a_run'};
  if(activity.manual===true)return {eligible:false,reason:'manual_activity'};
  if(activity.manual!==false)return {eligible:false,reason:'recording_unknown'};
  const startedAtMs=Date.parse(activity.start_date||'');
  const elapsed=activity.elapsed_time,meters=activity.distance;
  if(!Number.isSafeInteger(startedAtMs)||startedAtMs<Date.UTC(2020,0,1)||
     startedAtMs>Date.now()+300000||
     !Number.isSafeInteger(elapsed)||elapsed<1||elapsed>604800||
     !measured(meters,0.01,200000))
    return {eligible:false,reason:'invalid_measurement'};
  const end=startedAtMs+elapsed*1000;
  if(!Number.isSafeInteger(end)||end>Date.now()+300000)
    return {eligible:false,reason:'invalid_measurement'};
  const loc=streams?.latlng?.data,clock=streams?.time?.data;
  let hasGps=false;
  if(Array.isArray(loc)&&Array.isArray(clock)&&loc.length>=2&&loc.length===clock.length){
    let previous=-1,first=null,moved=false,valid=true;
    for(let i=0;i<loc.length;i++){
      const p=loc[i],t=clock[i];
      if(!Array.isArray(p)||p.length!==2||!measured(p[0],-90,90)||
         !measured(p[1],-180,180)||!Number.isFinite(t)||t<0||t<=previous){
        valid=false;break;
      }
      if(first&&(Math.abs(p[0]-first[0])>0.000001||Math.abs(p[1]-first[1])>0.000001))
        moved=true;
      if(!first)first=p;
      previous=t;
    }
    hasGps=valid&&moved;
  }
  const trainer=activity.trainer===true||activity.sport_type==='VirtualRun';
  const device=typeof activity.device_name==='string'&&activity.device_name.trim().length>1;
  // A device name is advisory, not proof. Stationary/treadmill activities
  // need a recorded device; GPS outdoors needs sampled geographical movement.
  if(!hasGps&&!(trainer&&device))
    return {eligible:false,reason:'no_measured_route_or_device'};
  const peak=measured(activity.max_speed,0,1000)
    ?Math.round(activity.max_speed*36)/10:null;
  const warnings=[];
  if(activity.flagged===true)warnings.push('strava_flagged');
  if(peak!==null&&peak>45)warnings.push('implausible_speed');
  return {
    eligible:true,startedAtMs,endedAtMs:end,distanceMeters:meters,
    peakSpeedKmh:peak,warningReasons:warnings,
    deviceType:trainer?'stationary_device':'gps',
  };
}
