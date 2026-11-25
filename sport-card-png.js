/* PNG export for the official BeatOnStep sport challenge card.
   Kept in sync with mobile-app/src/utils/collectibleCardPngSvg.ts. */
(function(){
  'use strict';
  const tiers={
    beginner:{accent:'#dec26b',shade:'#6b562b',symbol:'✦',rank:1},
    amateur:{accent:'#f1bd85',shade:'#805132',symbol:'✧',rank:2},
    regular:{accent:'#7fd9bd',shade:'#376b60',symbol:'◆',rank:3},
    intermediate:{accent:'#9bb8eb',shade:'#435f94',symbol:'◇',rank:4},
    expert:{accent:'#d2b0fa',shade:'#665088',symbol:'✶',rank:5},
    legend:{accent:'#ffe27e',shade:'#977630',symbol:'✹',rank:6},
    world_elite:{accent:'#d8f5f6',shade:'#648c96',symbol:'✷',rank:7}
  };
  const signatures=[
    [40000,'400','SPRINT'],[80000,'800','DEMI-FOND'],
    [150000,'1500','DEMI-FOND'],[160934,'1MI','LE MILE'],
    [500000,'5K','5 KILOMÈTRES'],[1000000,'10K','10 KILOMÈTRES'],
    [2109750,'21K','SEMI-MARATHON'],[4219500,'42K','MARATHON']
  ];
  const xml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const rect=(x,y,w,h,fill,stroke='none',radius=0,sw=1)=>
    '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+radius+
    '" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
  const txt=(x,y,value,size,fill,weight=900,anchor='start',tracking=0)=>
    '<text x="'+x+'" y="'+y+'" font-size="'+size+'" font-weight="'+weight+
    '" text-anchor="'+anchor+'" letter-spacing="'+tracking+'" fill="'+fill+
    '" font-family="Arial, Helvetica, sans-serif">'+xml(value)+'</text>';
  function wrap(value,max=19,linesMax=3){
    const words=String(value||'').trim().replace(/\\s+/g,' ').split(' ');
    const lines=[];let next='';
    for(const word of words){if(!word)continue;const candidate=next?next+' '+word:word;
      if(candidate.length<=max){next=candidate;continue;}
      if(next)lines.push(next);next=word;
    }
    if(next)lines.push(next);if(!lines.length)lines.push('');
    if(lines.length>linesMax){const kept=lines.slice(0,linesMax);
      kept[linesMax-1]=kept[linesMax-1].slice(0,max-1).trimEnd()+'…';return kept;}
    return lines.map(v=>v.length>max?v.slice(0,max-1)+'…':v);
  }
  function svgFor(card){
    const skin=tiers[card.difficulty]||tiers.beginner;
    const cm=Number(card.distanceCm)||0;
    const sig=cm>=4300000?['∞','ULTRA-DISTANCE']:
      (signatures.find(x=>x[0]===cm)||[0,'◆','PERFORMANCE SPORTIVE']).slice(1);
    const lines=wrap(card.title),ghost=card.variant==='ghost';
    const status=ghost?'CARTE FANTÔME · ANCIEN DÉTENTEUR':'';
    const start=230-(lines.length-1)*23-(status?14:0);
    const artHeight=Math.max(103,Math.min(151,start-70)),a=skin.accent;
    let out=rect(0,0,244,334,'#181811',a,19,1.7)+
      txt(19,32,'BEATONSTEP',10,'#fcea07',900,'start',1.7)+
      txt(225,36,skin.symbol,22,a,900,'end');
    out+=rect(19,62,206,artHeight,'#222016',a,11,1.2);
    const center=62+artHeight/2;
    for(let i=0;i<skin.rank;i++)out+=rect(121-skin.rank*6.5+i*13,center-54,9,2,a,'none',1);
    out+='<circle cx="122" cy="'+(center-1)+'" r="'+(artHeight<137?28:34)+
      '" fill="'+skin.shade+'" stroke="'+a+'" stroke-width="'+(skin.rank>=6?3:2)+'"/>';
    out+=txt(122,center+7,sig[0],23,'#fff9e9',900,'middle');
    out+=txt(122,center+(artHeight<137?39:49),sig[1],9,a,900,'middle',1.1);
    out+=txt(122,center+(artHeight<137?50:63),skin.symbol,10,a,900,'middle');
    out+=txt(19,start+11,'CARTE DÉFI',9,a,900,'start',1.1);
    lines.forEach((v,i)=>out+=txt(19,start+34+i*23,v,19,'#f4f1e0'));
    const starY=start+34+(lines.length-1)*23+27;
    const points='0,-8 2.3,-2.5 8,-2.5 3.8,1.6 5.2,7.8 0,4.8 -5.2,7.8 -3.8,1.6 -8,-2.5 -2.3,-2.5';
    for(let i=0;i<7;i++)out+='<polygon points="'+points+'" transform="translate('+
      (28+i*24)+' '+starY+')" fill="'+(i<skin.rank?a:'none')+
      '" stroke="'+(i<skin.rank?a:'#716e61')+'" stroke-width="1.6"/>';
    out+=txt(19,starY+23,'CARTE UNIQUE AU MONDE',9,a,900,'start',.4);
    if(status)out+=txt(19,starY+37,status,8,'#c0b9a4',800);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="986" viewBox="0 0 244 334"><defs><clipPath id="card"><rect width="244" height="334" rx="19"/></clipPath></defs><g opacity="'+(ghost?.72:1)+'" clip-path="url(#card)">'+out+'</g></svg>';
  }
  async function download(card,filename){
    const source=svgFor(card),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
    try{
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('card_svg_render_failed'));image.src=url;});
      const canvas=document.createElement('canvas');canvas.width=720;canvas.height=986;
      const context=canvas.getContext('2d');if(!context)throw new Error('canvas_unavailable');
      context.drawImage(image,0,0,720,986);
      const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('png_export_failed')),'image/png'));
      const pngUrl=URL.createObjectURL(png),a=document.createElement('a');
      a.href=pngUrl;a.download=filename||'BeatOnStep-carte-defi.png';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(pngUrl),1500);
    }finally{URL.revokeObjectURL(url);}
  }
  window.BeatOnStepSportCardPng={download};
})();