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
    intro: t('La musique suit tes pas.', 'Music follows your steps.'),
    'gallery-label': t('4 styles · un même moment', '4 styles · one moment'),
    light: t('Clair', 'Light'),
    dark: t('Sombre', 'Dark'),
    share: t('Partager le visuel', 'Share design'),
    copy: t('Copier le lien', 'Copy link'),
    'selection-label': t('Visuel sélectionné', 'Selected design'),
    help: t('Le bouton Partager envoie uniquement le SVG vectoriel. La feuille système propose les destinations compatibles ou l’enregistrement dans Fichiers.', 'Share sends only the vector SVG. The system sheet offers compatible destinations or saving to Files.'),
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
  function busy(on) {
    $('share').disabled = on;
    $('share').textContent = on ? t('Ouverture…','Opening…') : labels.share;
    $('share').setAttribute('aria-busy',String(on));
  }
  let selected = 'rhythm', tone = 'light', assets = null;
  let previewUrls = [];
  function redrawGallery() {
    const old = previewUrls; previewUrls = [];
    $('gallery').replaceChildren();
    for (const variant of card.variants) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tile'; button.dataset.variant = variant.id;
      button.setAttribute('aria-pressed',String(selected === variant.id));
      const name = variant[data.lang];
      button.setAttribute('aria-label',name);
      const thumb = document.createElement('span'); thumb.className = 'thumb';
      const image = document.createElement('img'); image.alt = name;
      const url = URL.createObjectURL(new Blob([card.render(data,variant.id,tone)],{type:'image/svg+xml'}));
      previewUrls.push(url); image.src = url; thumb.appendChild(image);
      const check = document.createElement('span'); check.className = 'check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
      const label = document.createElement('span'); label.className = 'tile-label'; label.textContent = name;
      const detail = document.createElement('small'); detail.textContent = t('SVG vectoriel','Vector SVG'); label.appendChild(detail);
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
    if (assets?.svgUrl) URL.revokeObjectURL(assets.svgUrl);
    const variant = card.variants.find(v=>v.id===selected);
    const svg = card.render(data,selected,tone);
    const svgBlob = new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    const name = `BeatOnStep-${selected}-${tone}.svg`;
    const svgFile = typeof File === 'function' ? new File([svgBlob],name,{type:'image/svg+xml'}) : null;
    assets = {svgUrl,svgBlob,svgFile,name};
    $('selection-name').textContent = variant[data.lang];
    document.querySelectorAll('.tile').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.variant===selected)));
    $('share').disabled = false;
    $('share').textContent = labels.share;
  }
  function saveSvg(current) {
    const a = document.createElement('a');
    a.href = current.svgUrl;
    a.download = current.name;
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  for (const choice of ['light','dark']) $(choice).onclick=()=>{
    tone=choice;
    for(const id of ['light','dark']) $(id).setAttribute('aria-pressed',String(id===tone));
    redrawGallery(); prepare(); status(t('Couleur sélectionnée : ','Selected color: ')+labels[choice]);
  };
  $('share').onclick=async()=>{
    const current=assets;
    if (!current) return;
    if (!canShare(current.svgFile)) {
      saveSvg(current);
      status(t('Partage SVG indisponible ici : le fichier vectoriel a été proposé à l’enregistrement.','SVG sharing is unavailable here: the vector file was offered for saving.'));
      return;
    }
    busy(true);
    status(t('La feuille système affiche les apps compatibles avec ce SVG.','The system sheet shows apps compatible with this SVG.'));
    try {
      await navigator.share({files:[current.svgFile]});
      status(t('Feuille de partage refermée.','Share sheet closed.'));
    } catch(error) {
      if (error && error.name === 'AbortError') status(t('Partage annulé.','Share cancelled.'));
      else {
        saveSvg(current);
        status(t('Partage indisponible : le SVG a été proposé à l’enregistrement.','Sharing unavailable: the SVG was offered for saving.'),true);
      }
    } finally {
      busy(false);
    }
  };
  $('copy').onclick=async()=>{
    $('copy').disabled=true;
    try {
      await navigator.clipboard.writeText(card.SITE);
      status(t('Lien copié ✓','Link copied ✓'));
    } catch {
      $('link').hidden=false; $('link').value=card.SITE; $('link').focus(); $('link').select();
      status(t('Copie automatique indisponible : sélectionne et copie le lien.','Automatic copy unavailable: select and copy the link.'),true);
    } finally {
      $('copy').disabled=false;
    }
  };
  redrawGallery(); prepare();
  if(invalid)status(t('Données indisponibles : visuels sans statistiques.','Data unavailable: designs without statistics.'),true);
})();