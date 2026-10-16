// Public presentation of an explicitly saved run; never a sporting proof.
// Reject personal tracks, routes, identities and invalid metrics by allowlist.
export function publicRunSummary(value){
  let source;
  try{source=typeof value==='string'?JSON.parse(value):value}catch{return null;}
  if(!source||typeof source!=='object'||Array.isArray(source))return null;
  const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  if(!integer(source.endedAtMs,1577836800000,4102444800000)||
     !integer(source.durationSeconds,0,604800))return null;
  const distance=typeof source.distanceMeters==='number'&&
    Number.isFinite(source.distanceMeters)&&source.distanceMeters>=0&&
    source.distanceMeters<=10000000?source.distanceMeters:null;
  const pace=typeof source.averagePaceSecPerKm==='number'&&
    Number.isFinite(source.averagePaceSecPerKm)&&source.averagePaceSecPerKm>0&&
    source.averagePaceSecPerKm<=86400?source.averagePaceSecPerKm:null;
  return {at:source.endedAtMs,durationSeconds:source.durationSeconds,
    distanceMeters:distance,averagePaceSecPerKm:pace};
}
