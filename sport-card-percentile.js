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
  function percentile(item){
    // Not a personal world ranking: just the approximate finishers' tier.
    // Beginner has no exact percentile; ultra courses lack comparable timings.
    if(!rules||item?.distanceCm>=rules.ultraStartCm||
       item?.performanceWarning===true)return null;
    const level=tier(item);
    return Object.prototype.hasOwnProperty.call(target,level)?target[level]:null;
  }
  function label(item,lang='fr'){
    const percent=percentile(item);
    if(percent!==null)return lang==='en'
      ?'World top '+percent+'%':'Top '+percent+' % mondial';
    const level=visibleTier(item);
    if(level==='legend'&&rules&&item?.distanceCm>=rules.ultraStartCm)
      return lang==='en'?'Long-distance legend':'Légende longue distance';
    const name=names[level];
    return name?name[lang==='en'?1:0]:(lang==='en'?'Level unavailable':'Niveau indisponible');
  }
  root.BeatOnStepSportPercentiles=Object.freeze({ready,tier,visibleTier,percentile,label});
})(typeof window!=='undefined'?window:globalThis);
