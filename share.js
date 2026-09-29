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
    share: t('Partager', 'Share'),
    save: t('Enregistrer', 'Save'),
    'selection-label': t('Visuel sélectionné', 'Selected design'),
    'save-help': t('Appui long puis « Enregistrer dans Photos ».', 'Touch and hold, then choose “Save to Photos”.'),
    'close-save': t('Fermer', 'Close'),
  };
  Object.entries(labels).forEach(([id,value]) => { $(id).textContent = value; });
  document.querySelector('.tones').setAttribute('aria-label',t('Couleur','Color'));

  let toastTimer;
  function status(message, error = false) {
    clearTimeout(toastTimer);
    $('status').textContent = message;
    $('status').dataset.error = String(error);
    $('status').hidden = false;
    toastTimer = setTimeout(() => { $('status').hidden = true; }, 4500);
  }
  function setBusy(id, on) {
    $(id).disabled = on;
    $(id).textContent = on ? t('Ouverture…','Opening…') : labels[id];
  }
  function canShare(file) {
    try { return !!(file && navigator.share && navigator.canShare && navigator.canShare({files:[file]})); }
    catch { return false; }
  }

  let selected = 'rhythm', tone = 'light', generation = 0, assets = null;
  let previewUrls = [];
  function redrawGallery() {
    const old = previewUrls; previewUrls = [];
    $('gallery').replaceChildren();
    for (const variant of card.variants) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile';
      button.dataset.variant = variant.id;
      button.setAttribute('aria-pressed',String(selected === variant.id));
      const name = variant[data.lang];
      button.setAttribute('aria-label',name);
      const thumb = document.createElement('span'); thumb.className = 'thumb';
      const image = document.createElement('img'); image.alt = name;
      const url = URL.createObjectURL(new Blob([card.render(data,variant.id,tone)],{type:'image/svg+xml'}));
      previewUrls.push(url); image.src = url; thumb.appendChild(image);
      const check = document.createElement('span'); check.className = 'check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
      const label = document.createElement('span'); label.className = 'tile-label'; label.textContent = name;
      button.append(thumb,check,label);
      button.onclick = () => {
        if (selected === variant.id) return;
        selected = variant.id;
        prepare();
      };
      $('gallery').appendChild(button);
    }
    old.forEach(url=>URL.revokeObjectURL(url));
  }

  function prepare() {
    const currentGeneration = ++generation;
    if (assets?.svgUrl) URL.revokeObjectURL(assets.svgUrl);
    if (assets?.pngUrl) URL.revokeObjectURL(assets.pngUrl);
    assets = null;
    $('share').disabled = true;
    $('save').disabled = true;
    $('share').textContent = t('Préparation…','Preparing…');
    $('save').textContent = t('Préparation…','Preparing…');
    const variant = card.variants.find(v=>v.id===selected);
    $('selection-name').textContent = variant[data.lang];
    document.querySelectorAll('.tile').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.variant===selected)));
    const svgBlob = new Blob([card.render(data,selected,tone)],{type:'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      if (currentGeneration !== generation) return;
      const canvas = document.createElement('canvas');
      canvas.width = variant.width;
      canvas.height = variant.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { fail(); return; }
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob => {
        if (currentGeneration !== generation || !blob) { fail(); return; }
        const pngUrl = URL.createObjectURL(blob);
        const name = `BeatOnStep-${selected}-${tone}.png`;
        const pngFile = typeof File === 'function' ? new File([blob],name,{type:'image/png'}) : null;
        assets = {svgUrl,pngUrl,pngBlob:blob,pngFile,name};
        $('save-preview').src = pngUrl;
        $('share').disabled = false;
        $('save').disabled = false;
        $('share').textContent = labels.share;
        $('save').textContent = labels.save;
      },'image/png');
    };
    image.onerror = fail;
    image.src = svgUrl;
    function fail() {
      if (currentGeneration !== generation) return;
      $('share').textContent = labels.share;
      $('save').textContent = labels.save;
      status(t('Impossible de préparer le visuel.','Unable to prepare the image.'),true);
    }
  }

  function showSaveHelp() {
    if (!assets?.pngUrl) return;
    $('save-preview').src = assets.pngUrl;
    $('save-panel').hidden = false;
  }
  $('close-save').onclick = () => { $('save-panel').hidden = true; };

  for (const choice of ['light','dark']) {
    $(choice).onclick = () => {
      tone = choice;
      for (const id of ['light','dark']) $(id).setAttribute('aria-pressed',String(id===tone));
      redrawGallery();
      prepare();
    };
  }

  $('share').onclick = async () => {
    const current = assets;
    if (!current?.pngBlob) return;
    if (!canShare(current.pngFile)) {
      showSaveHelp();
      return;
    }
    setBusy('share',true);
    try {
      await navigator.share({files:[current.pngFile]});
    } catch (error) {
      if (!error || error.name !== 'AbortError') status(t('Partage indisponible.','Sharing unavailable.'),true);
    } finally {
      setBusy('share',false);
      $('share').disabled = !assets?.pngBlob;
    }
  };

  $('save').onclick = async () => {
    const current = assets;
    if (!current?.pngBlob) return;
    if (!canShare(current.pngFile)) {
      showSaveHelp();
      return;
    }
    setBusy('save',true);
    status(t('Choisis « Enregistrer l’image ».','Choose “Save Image”.'));
    try {
      await navigator.share({files:[current.pngFile]});
    } catch (error) {
      if (!error || error.name !== 'AbortError') showSaveHelp();
    } finally {
      setBusy('save',false);
      $('save').disabled = !assets?.pngBlob;
    }
  };

  redrawGallery();
  prepare();
  if (invalid) status(t('Données indisponibles.','Data unavailable.'),true);
})();