/* #451 — Common website card face, used by catalogue, account and sport gifts.
   Mirror mobile-app/src/utils/sportCardVisual.ts for visual design tokens. */
var BeatOnStepSportCards=(function(){
  'use strict';
  const levels=/*__SPORT_CARD_LEVELS__*/{};
  function signature(cm){
    if(cm===40000)return ['400','SPRINT',true];
    if(cm===80000)return ['800','DEMI-FOND',true];
    if(cm===150000)return ['1500','DEMI-FOND',true];
    if(cm===160934)return ['1MI','LE MILE',true];
    if(cm===500000)return ['5K','5 KILOMÈTRES',true];
    if(cm===1000000)return ['10K','10 KILOMÈTRES',true];
    if(cm===2109750)return ['21K','SEMI-MARATHON',true];
    if(cm===4219500)return ['42K','MARATHON',true];
    if(typeof cm==='number'&&cm>=4300000)return ['∞','ULTRA-DISTANCE',true];
    return ['◆','PERFORMANCE SPORTIVE',false];
  }
  const say=(fr,en,lang)=>lang==='en'?en:fr;
  function createFace(doc,item,lang='fr'){
    const tier=Object.prototype.hasOwnProperty.call(levels,item?.difficulty)
      ?item.difficulty:'beginner';
    const level=levels[tier];
    const [mark,milestoneName,featured]=signature(item?.distanceCm);
    const create=(tag,cls,value)=>{
      const node=doc.createElement(tag);
      node.className=cls;
      if(value!==undefined)node.textContent=String(value);
      return node;
    };
    const finish=item?.distanceCm===40000?' sport-finish--400m':
      item?.distanceCm===500000?' sport-finish--5k':'';
    const face=create('div','bos-sport-face sport-skin--'+tier+finish+
      (featured?' sport-featured':'')+
      (item?.variant==='ghost'?' is-ghost':'')+
      (item?.variant==='rejected'?' is-rejected':''));
    const title=String(item?.title||item?.name||'');
    face.setAttribute('role','img');
    face.setAttribute('aria-label',say('Carte Défi unique au monde : ',
      'Worldwide unique challenge card: ',lang)+title+', '+
      say(level[0],level[1],lang)+', '+level[3]+' '+
      say('étoiles sur 7','stars out of 7',lang));
    const top=create('div','bos-sport-top');
    top.append(create('span','', 'BEATONSTEP'),
      create('span','bos-tier-icon',level[2]));
    const art=create('div','bos-sport-art');
    art.setAttribute('aria-hidden','true');
    const bars=create('div','bos-sport-bars');
    for(let index=0;index<level[3];index++)bars.append(create('i',''));
    art.append(bars,create('div','bos-sport-crest',mark),
      create('div','bos-sport-signature',milestoneName),
      create('div','bos-sport-symbols',level[2]+(level[3]>=5?'  ✦  '+level[2]:'')));
    const stars=create('div','bos-sport-stars');
    stars.setAttribute('aria-hidden','true');
    for(let index=0;index<7;index++){
      const filled=index<level[3];
      stars.append(create('span',filled?'is-filled':'is-outline',
        filled?'★':'☆'));
    }
    const foot=create('div','bos-sport-foot');
    foot.append(create('span','bos-sport-category',say('CARTE DÉFI','CHALLENGE CARD',lang)),
      create('strong','bos-sport-name',title),stars,
      create('span','bos-sport-unique',say('CARTE UNIQUE AU MONDE','ONE CARD WORLDWIDE',lang)));
    face.append(top,art,foot);
    return face;
  }
  return {createFace,signature,levels};
})();
