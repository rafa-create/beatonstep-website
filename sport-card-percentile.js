// Shared browser-only sport tier presentation. No backend write and no card
// identity changes. The official static manifest is the sole ranking source.
(function(root){
  'use strict';
  const target={amateur:90,regular:75,intermediate:50,expert:20,legend:5,world_elite:1};
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
  function tier(item){
    if(!rules||!Number.isSafeInteger(item?.distanceCm)||
       !Number.isSafeInteger(item?.subValue)||item.subValue<1)return null;
    if(item.distanceCm>=rules.ultraStartCm&&
       Array.isArray(rules.distancesCm)&&rules.distancesCm.includes(item.distanceCm))
      return rules.ultraDifficulty;
    const caps=rules.capsByDistance[String(item.distanceCm)];
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
    const unit=(rules.secondResolutionDistancesCm||[40000])
      .includes(item.distanceCm)?1:60;
    return item.subValue<=Math.floor(reference.seconds/unit)+1
      ?(reference.estimated?'estimated':'official'):null;
  }
  function percentile(item){
    // This is a modelled finisher fraction, never an actual personal rank.
    if(!rules||item?.distanceCm>=rules.ultraStartCm||
       item?.performanceWarning===true||!Number.isSafeInteger(item?.subValue))
      return null;
    const level=tier(item);
    if(!level||level==='beginner')return null;
    const caps=rules.capsByDistance[String(item.distanceCm)];
    if(!caps)return null;
    const marks=[['world_elite',1],['legend',5],['expert',20],
      ['intermediate',50],['regular',75],['amateur',90]];
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
    const reference=worldRecordReference(item.distanceCm);
    if(!reference)return 1;
    const unit=(rules.secondResolutionDistancesCm||[40000])
      .includes(item.distanceCm)?1:60;
    const ceiling=caps.world_elite*unit;
    if(!(reference.seconds>0&&ceiling>reference.seconds))return 1;
    const ratio=Math.max(0,Math.min(1,
      Math.log(Math.max(item.subValue*unit,reference.seconds)/reference.seconds)/
      Math.log(ceiling/reference.seconds)));
    return Math.max(0.1,Math.round((0.1+ratio*0.9)*10)/10);
  }
  function label(item,lang='fr'){
    const percent=percentile(item);
    if(percent!==null){
      const record=recordBracket(item);
      if(record==='official')return lang==='en'?'World record time bracket':'Palier du record mondial';
      if(record==='estimated')return lang==='en'?'Estimated world benchmark bracket':'Palier de référence mondiale estimée';
      return lang==='en'
        ?'World top ≈ '+percent+'%':'Top ≈ '+String(percent).replace('.',',')+' % mondial';
    }
    const level=visibleTier(item);
    if(level==='legend'&&rules&&item?.distanceCm>=rules.ultraStartCm)
      return lang==='en'?'Long-distance legend':'Légende longue distance';
    const name=names[level];
    return name?name[lang==='en'?1:0]:(lang==='en'?'Level unavailable':'Niveau indisponible');
  }
  root.BeatOnStepSportPercentiles=Object.freeze({ready,tier,visibleTier,percentile,label,worldRecordReference,recordBracket});
})(typeof window!=='undefined'?window:globalThis);
