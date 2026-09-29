(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let input = {}, invalid = false;
  try {
    if (location.hash.length > 8000) throw new Error('Too long');
    if (location.hash.length > 1) {
      input = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (!input || input.v !== 1) throw new Error('Unknown version');
    }
  } catch { input = {}; invalid = true; }
  history.replaceState(null, '', location.pathname + location.search);
  const card = window.BeatOnStepCard;
  const data = card.normalize(input);
  const t = (fr, en) => data.lang === 'en' ? en : fr;
  document.documentElement.lang = data.lang;
  const labels = {
    heading: t('Partager mon rythme', 'Share my rhythm'),
    intro: t('Choisis ton visuel. Pose-le sur ta photo.', 'Pick a sticker. Make it part of your photo.'),
    'gallery-label': t('4 styles · un même moment', '4 styles · one moment'),
    light: t('Clair', 'Light'), dark: t('Sombre', 'Dark'),
    share: t('Partager / Enregistrer l’image', 'Share / Save image'),
    svg: t('Télécharger SVG', 'Download SVG'),
    png: t('Télécharger le PNG', 'Download PNG'),
    'copy-image': t('Copier le sticker', 'Copy sticker'),
    copy: t('Copier le lien', 'Copy link'),
    'selection-label': t('Visuel sélectionné', 'Selected design'),
    'more-label': t('Autres options', 'Other options'),
    'image-help': t('Appui long sur l’image pour l’enregistrer, puis ajoute-la à ta story.', 'Touch and hold the image to save it, then add it to your story.'),
    help: t('Photos / Instagram : partager l’image → Enregistrer l’image. SVG vectoriel : téléchargement dans Fichiers.', 'Photos / Instagram: share image → Save Image. Vector SVG: download to Files.'),
    privacy: t('Le damier indique la transparence ; il ne sera pas dans le fichier. Tes données restent dans ton navigateur.', 'The checkerboard means transparency; it is not included in the file. Your data stays in your browser.'),
  };
  Object.entries(labels).forEach(([id,value]) => { $(id).textContent = value; });
  $('link').setAttribute('aria-label',t('Lien de l’app','App link'));
  document.querySelector('.tones').setAttribute('aria-label',t('Couleur du sticker','Sticker color'));
  let toastTimer;
  function status(message, error = false) {
    clearTimeout(toastTimer);
    $('status').textContent = message;
    $('status').dataset.error = String(error);
    $('status').hidden = false;
    toastTimer = setTimeout(() => { $('status').hidden = true; }, 6500);
  }
  function busy(id, on) {
    $(id).disabled = on;
    $(id).textContent = on ? t('Ouverture…','Opening…') : labels[id];
    $(id).setAttribute('aria-busy',String(on));
  }
  let selected = 'rhythm', tone = 'light', sequence = 0, assets = null;
  let previewUrls = [];
  const revokedLater = [];
  // URLs are kept until this document is left; downloads/share sheets may still use them.
  function redrawGallery() {
    const old = previewUrls; previewUrls = [];
    $('gallery').replaceChildren();
    for (const variant of card.variants) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tile'; button.dataset.variant = variant.id;
      button.setAttribute('aria-pressed',String(selected === variant.id));
      const name = variant[data.lang];
      button.setAttribute('aria-label',`${name} · ${variant.transparent ? t('transparent','transparent') : t('fond plein','solid background')}`);
      const thumb = document.createElement('span'); thumb.className = 'thumb';
      const image = document.createElement('img'); image.alt = name;
      const url = URL.createObjectURL(new Blob([card.render(data,variant.id,tone)],{type:'image/svg+xml'}));
      previewUrls.push(url); image.src = url; thumb.appendChild(image);
      const check = document.createElement('span'); check.className = 'check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
      const label = document.createElement('span'); label.className = 'tile-label'; label.textContent = name;
      const detail = document.createElement('small'); detail.textContent = variant.transparent ? t('Transparent','Transparent') : t('Fond plein','Solid background'); label.appendChild(detail);
      button.append(thumb,check,label);
      button.onclick = () => {
        if (selected === variant.id) { status(t('Ce visuel est sélectionné.','This design is selected.')); return; }
        selected = variant.id; prepare(); status(t('Visuel sélectionné : ','Selected: ')+name);
      };
      $('gallery').appendChild(button);
    }
    old.forEach(url=>URL.revokeObjectURL(url));
  }
  function canShare(file) {
    try { return !!(file && navigator.share && navigator.canShare && navigator.canShare({files:[file]})); }
    catch { return false; }
  }
  function prepare() {
    const generation = ++sequence;
    if (assets) revokedLater.push(assets);
    assets = null;
    $('share').disabled = true; $('copy-image').disabled = true;
    $('svg').removeAttribute('href'); $('svg').setAttribute('aria-disabled','true');
    $('png').removeAttribute('href'); $('save-panel').hidden = true;
    $('selection-name').textContent = card.variants.find(v=>v.id===selected)[data.lang];
    document.querySelectorAll('.tile').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.variant===selected)));
    $('share').textContent = t('Préparation…','Preparing…');
    const variant = card.variants.find(v=>v.id===selected);
    const svgBlob = new Blob([card.render(data,selected,tone)],{type:'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    const name = `BeatOnStep-${selected}-${tone}`;
    const current = {svgUrl, svgBlob, name, pngUrl:null, pngBlob:null, pngFile:null};
    assets = current;
    $('svg').href = svgUrl; $('svg').download = `${name}.svg`; $('svg').setAttribute('aria-disabled','false');
    const image = new Image();
    image.onload = () => {
      if (generation !== sequence) return;
      try {
        const canvas = document.createElement('canvas'); canvas.width=variant.width; canvas.height=variant.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No canvas');
        context.clearRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        canvas.toBlob(blob => {
          if (generation !== sequence) return;
          if (!blob) { fail(); return; }
          current.pngBlob=blob; current.pngUrl=URL.createObjectURL(blob);
          if (typeof File === 'function') current.pngFile=new File([blob],`${name}.png`,{type:'image/png'});
          $('png').href=current.pngUrl; $('png').download=`${name}.png`;
          $('share').disabled=false; $('share').textContent=labels.share;
          $('copy-image').disabled=false;
          $('save-preview').src=current.pngUrl;
        },'image/png');
      } catch { fail(); }
    };
    function fail() {
      if (generation !== sequence) return;
      $('share').textContent=labels.share;
      status(t('Préparation de l’image impossible. Le SVG reste disponible.','Image preparation failed. SVG is still available.'),true);
    }
    image.onerror=fail; image.src=svgUrl;
  }
  function showImage() {
    if (!assets?.pngUrl) return;
    $('save-panel').hidden=false;
    $('save-panel').scrollIntoView({behavior:'smooth',block:'center'});
    status(t('Appui long sur l’image pour l’enregistrer.','Touch and hold the image to save it.'));
  }
  for (const choice of ['light','dark']) $(choice).onclick=()=>{
    tone=choice;
    for(const id of ['light','dark']) $(id).setAttribute('aria-pressed',String(id===tone));
    redrawGallery(); prepare(); status(t('Couleur sélectionnée : ','Selected color: ')+labels[choice]);
  };
  $('svg').onclick=event=>{
    if (!assets?.svgUrl) { event.preventDefault(); status(t('Le fichier se prépare…','Preparing file…')); return; }
    status(t('Téléchargement SVG demandé · retrouve-le dans Fichiers.','SVG download requested · look in Files.'));
  };
  $('png').onclick=event=>{
    if (!assets?.pngUrl) {event.preventDefault();return;}
    status(t('Téléchargement PNG demandé. Pour Photos, utilise Partager / Enregistrer.','PNG download requested. For Photos, use Share / Save.'));
  };
  $('share').onclick=async()=>{
    const current=assets;
    if (!current?.pngBlob) return;
    if (!canShare(current.pngFile)) {showImage();return;}
    busy('share',true); status(t('Dans le partage, choisis « Enregistrer l’image » ou ton application.','In the share sheet, choose Save Image or your app.'));
    try {
      // PNG is the transparent image transport for Photos, clipboard and stories.
      // The distinct vector download remains SVG by default.
      await navigator.share({files:[current.pngFile]});
      status(t('Feuille de partage refermée.','Share sheet closed.'));
    } catch(error) {
      if(error.name==='AbortError')status(t('Partage annulé.','Share cancelled.'));
      else {status(t('Partage indisponible. Enregistre l’image ci-dessous.','Sharing unavailable. Save the image below.'),true);showImage();}
    } finally {busy('share',false);$('share').disabled=!assets?.pngBlob;}
  };
  $('copy-image').onclick=async()=>{
    const current=assets;
    if(!current?.pngBlob)return;
    busy('copy-image',true); status(t('Copie du sticker…','Copying sticker…'));
    try {
      if(!navigator.clipboard?.write || typeof ClipboardItem==='undefined')throw new Error('Unsupported');
      await navigator.clipboard.write([new ClipboardItem({'image/png':current.pngBlob})]);
      status(t('Sticker copié ✓ Colle-le sur ta photo dans ta story.','Sticker copied ✓ Paste it over your story photo.'));
    } catch {status(t('Copie d’image indisponible. Utilise Partager / Enregistrer.','Image copy unavailable. Use Share / Save.'),true);}
    finally {busy('copy-image',false);$('copy-image').disabled=!assets?.pngBlob;}
  };
  $('copy').onclick=async()=>{
    busy('copy',true); status(t('Copie du lien…','Copying link…'));
    try {await navigator.clipboard.writeText(card.SITE);status(t('Lien copié ✓','Link copied ✓'));}
    catch {$('link').hidden=false;$('link').value=card.SITE;$('link').focus();$('link').select();status(t('Copie automatique indisponible : sélectionne et copie le lien.','Automatic copy unavailable: select and copy the link.'),true);}
    finally {busy('copy',false);}
  };
  redrawGallery();prepare();
  if(invalid)status(t('Données indisponibles : visuels sans statistiques.','Data unavailable: designs without statistics.'),true);
})();
