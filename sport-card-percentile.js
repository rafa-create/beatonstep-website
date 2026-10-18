// Shared browser-only sport tier presentation. No backend write and no card
// identity changes. The official static manifest is the sole ranking source.
(function(root){
  'use strict';
  const names={
    beginner:['Débutant','Beginner'],amateur:['Amateur','Amateur'],
    regular:['Régulier','Regular'],intermediate:['Intermédiaire','Intermediate'],
    expert:['Expert','Expert'],legend:['Légende','Legend'],
    world_elite:['Élite mondiale','World elite'],
  };
  let rules=null,pending=null;
  const valid=data=>data&&data.schema===1&&data.difficultyRuleset==='v2'&&
    Array.isArray(data.tierOrder)&&data.tierOrder.length===7&&
    data.capsByDistance&&typeof data.capsByDistance==='object'&&
    Number.isSafeInteger(data.ultraStartCm);
  async function ready(){
    if(!pending)pending=fetch('/sport-card-rules.json',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw Error('sport_rules_unavailable');
        const data=await response.json();
        if(!valid(data))throw Error('sport_rules_incompatible');
        rules=data;return data;
      }).catch(()=>null);
    return pending;
  }
  function tierTopLabel(level,lang='fr'){
    if(!rules||level==='beginner'||level==='world_elite')return null;
    const pct=rules.percentileCalibration?.estimatedPercentileTargets?.[level];
    if(!Number.isFinite(pct)||pct<=0||pct>100)return null;
    return lang==='en'?'Top ≈ '+pct+'% of race finishers'
      :'Top ≈ '+pct+' % des arrivants';
  }
  function canonicalDistanceCm(kilometers){
    if(!rules||typeof kilometers!=='string')return null;
    const input=kilometers.trim().replace(',','.');
    if(!/^(?:[0-9]{1,3})(?:\.[0-9]{1,5})?$/.test(input))return null;
    const km=Number(input),cm=Math.round(km*100000);
    return km>0&&Math.abs(km*100000-cm)<1e-7&&
      Array.isArray(rules.distancesCm)&&rules.distancesCm.includes(cm)
      ?cm:null;
  }
  // The 1 km second-resolution thresholds replaced the current rules, but
  // existing cards explicitly stored with timeUnit="minute" keep their
  // original minute-based SUB values and tier boundaries.
  function capsForItem(item){
    if(!rules||!Number.isSafeInteger(item?.distanceCm))return null;
    const unit=item?.timeUnit;
    const legacy=unit&&rules.legacyCapsByDistanceAndUnit?.[String(item.distanceCm)]?.[unit];
    if(legacy)return legacy;
    return rules.capsByDistance[String(item.distanceCm)]||null;
  }
  function unitForItem(item){
    if(item?.timeUnit==='minute')return 60;
    if(item?.timeUnit==='second')return 1;
    const unit=rules?.timeUnitByDistance?.[String(item?.distanceCm)];
    if(unit==='second')return 1;
    if(unit==='minute')return 60;
    return (rules?.secondResolutionDistancesCm||[40000]).includes(item?.distanceCm)?1:60;
  }
  function tier(item){
    if(!rules||!Number.isSafeInteger(item?.distanceCm)||
       !Number.isSafeInteger(item?.subValue)||item.subValue<1)return null;
    if(item.distanceCm>=rules.ultraStartCm&&
       Array.isArray(rules.distancesCm)&&rules.distancesCm.includes(item.distanceCm))
      return rules.ultraDifficulty;
    const caps=capsForItem(item);
    if(!caps)return null;
    return rules.tierOrder.find(key=>item.subValue<=caps[key])||null;
  }
  function visibleTier(item){
    return tier(item)||
      (Object.prototype.hasOwnProperty.call(names,item?.difficulty)?item.difficulty:null);
  }
  // The same eight record anchors live in the versioned rules JSON used
  // by the mobile app. Never interpolate outside its observed anchor range.
  function worldRecordReference(distanceCm){
    const refs=rules?.absoluteWorldRecordAnchors;
    if(!Array.isArray(refs)||refs.length<2||!Number.isSafeInteger(distanceCm))return null;
    const exact=refs.find(a=>a.distanceCm===distanceCm);
    if(exact&&Number.isFinite(exact.seconds)&&exact.seconds>0)
      return {seconds:exact.seconds,estimated:false};
    const right=refs.findIndex(a=>a.distanceCm>distanceCm);
    if(right<=0)return null;
    const a=refs[right-1],b=refs[right];
    if(!(a.distanceCm>0&&b.distanceCm>a.distanceCm&&a.seconds>0&&
         b.seconds>a.seconds&&distanceCm>a.distanceCm&&distanceCm<b.distanceCm))
      return null;
    const ratio=Math.log(distanceCm/a.distanceCm)/Math.log(b.distanceCm/a.distanceCm);
    return {seconds:Math.exp(Math.log(a.seconds)+
      ratio*Math.log(b.seconds/a.seconds)),estimated:true};
  }
  function recordBracket(item){
    if(!rules||!rules.distancesCm.includes(item?.distanceCm)||
       item?.distanceCm>=rules.ultraStartCm||
       !Number.isSafeInteger(item?.subValue)||item.subValue<1)return null;
    const reference=worldRecordReference(item.distanceCm);
    if(!reference)return null;
    const unit=unitForItem(item);
    return item.subValue<=Math.floor(reference.seconds/unit)+1
      ?(reference.estimated?'estimated':'official'):null;
  }
  // The time gap refers to the STRICT SUB threshold of the collectible
  // (e.g. SUB 14 = 14:00), not the runner's personally recorded finish time.
  function recordGap(item){
    if(!rules||tier(item)!=='world_elite'||item?.performanceWarning===true)return null;
    const reference=worldRecordReference(item.distanceCm);
    if(!reference)return null;
    const unit=unitForItem(item);
    const delta=item.subValue*unit-reference.seconds;
    // A strict SUB threshold does not reveal the runner's exact finish time.
    // Report the conservative minimum lead over the record, not an exact gap.
    return {seconds:Math.max(0,Math.round(delta)),
      leadSeconds:Math.max(0,Math.floor(-delta+1e-9)),
      estimated:reference.estimated,atOrBeyondReference:delta<=0};
  }
  function gapText(seconds,lang){
    const minutes=Math.floor(seconds/60),remainder=seconds%60;
    if(minutes===0)return seconds+(lang==='en'?' sec':' s');
    return minutes+' min '+String(remainder).padStart(2,'0')+(lang==='en'?' sec':' s');
  }
  function percentile(item){
    // This is a modelled finisher fraction, never an actual personal rank.
    if(!rules||item?.distanceCm>=rules.ultraStartCm||
       item?.performanceWarning===true||!Number.isSafeInteger(item?.subValue))
      return null;
    const level=tier(item);
    if(!level||level==='beginner'||level==='world_elite')return null;
    const caps=capsForItem(item);
    if(!caps)return null;
    const percentages=rules.percentileCalibration?.estimatedPercentileTargets;
    if(!percentages)return null;
    const marks=rules.tierOrder.filter(name=>name!=='beginner')
      .map(name=>[name,percentages[name]]);
    if(marks.length!==6||marks.some(([,p])=>!Number.isFinite(p)))return null;
    if(item.subValue>caps.world_elite){
      for(let i=1;i<marks.length;i++){
        const [name,percent]=marks[i];
        const [previous,prevPercent]=marks[i-1];
        if(item.subValue<=caps[name]){
          const ratio=Math.max(0,Math.min(1,
            (item.subValue-caps[previous])/(caps[name]-caps[previous])));
          return Math.round(prevPercent+(percent-prevPercent)*ratio);
        }
      }
      return null;
    }
    return null;
  }
  function label(item,lang='fr'){
    const gap=recordGap(item);
    if(gap){
      if(gap.atOrBeyondReference){
        const minimum=gap.leadSeconds>0?gapText(gap.leadSeconds,lang):null;
        if(gap.estimated)return minimum
          ?(lang==='en'?'Estimated world benchmark exceeded by at least '+minimum
            :'Référence mondiale estimée dépassée d’au moins '+minimum)
          :(lang==='en'?'Estimated world benchmark exceeded'
            :'Référence mondiale estimée dépassée');
        return minimum
          ?(lang==='en'?'World record beaten by at least '+minimum
            :'Record du monde battu de '+minimum+' minimum')
          :(lang==='en'?'World record beaten (exact gap unknown)'
            :'Record du monde battu (écart exact inconnu)');
      }
      const duration=gapText(gap.seconds,lang);
      return gap.estimated
        ?(lang==='en'?duration+' from the estimated world benchmark'
          :'À '+duration+' de la référence mondiale estimée')
        :(lang==='en'?duration+' from the world record'
          :'À '+duration+' du record mondial');
    }
    const percent=percentile(item);
    if(percent!==null)return lang==='en'
      ?'World top ≈ '+percent+'%':'Top ≈ '+String(percent).replace('.',',')+' % mondial';
    const level=visibleTier(item);
    if(level==='legend'&&rules&&item?.distanceCm>=rules.ultraStartCm)
      return lang==='en'?'Long-distance legend':'Légende longue distance';
    const name=names[level];
    return name?name[lang==='en'?1:0]:(lang==='en'?'Level unavailable':'Niveau indisponible');
  }
  root.BeatOnStepSportPercentiles=Object.freeze({ready,tier,visibleTier,percentile,label,worldRecordReference,recordBracket,recordGap,tierTopLabel,canonicalDistanceCm});
})(typeof window!=='undefined'?window:globalThis);
