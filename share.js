(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let input = {};
  let invalid = false;
  try {
    if (location.hash.length > 8000) throw new Error('Too long');
    if (location.hash.length > 1) {
      input = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (!input || input.v !== 1) throw new Error('Unknown version');
    }
  } catch { invalid = true; }
  // Remove personal snapshot from the visible URL/history entry immediately.
  history.replaceState(null, '', location.pathname + location.search);
  const card = window.BeatOnStepCard;
  const data = card.normalize(input);
  const en = data.lang === 'en';
  const t = (fr, eng) => en ? eng : fr;
  document.documentElement.lang = data.lang;
  const copy = {
    heading: t('Ma story, mon rythme.', 'My story, my rhythm.'),
    intro: t('Votre carte est prête à emporter.', 'Your card is ready to go.'),
    share: t('Partager l’image', 'Share image'),
    png: t('Télécharger pour Instagram · PNG', 'Download for Instagram · PNG'),
    svg: t('Télécharger le SVG', 'Download SVG'),
    copy: t('Copier le lien de l’app', 'Copy app link'),
    help: t('Pour une story : enregistrez le PNG, puis choisissez-le dans Instagram. Pour rendre le lien cliquable, collez le lien de l’app dans un sticker Lien.', 'For a story: save the PNG, then select it in Instagram. To make the link tappable, paste the app link into a Link sticker.'),
    privacy: t('La carte est créée dans votre navigateur. Ses données ne sont pas envoyées à notre serveur.', 'The card is created in your browser. Its data is not sent to our server.'),
  };
  Object.entries(copy).forEach(([id, value]) => { $(id).textContent = value; });
  $('preview').alt = t('Aperçu de la carte BeatOnStep', 'BeatOnStep card preview');
  $('link').setAttribute('aria-label', t('Lien de l’app', 'App link'));
  const status = message => { $('status').textContent = message; };
  if (invalid) status(t('Données indisponibles : carte sans statistiques.', 'Data unavailable: card without statistics.'));
  const svg = card.render({ ...data, v: 1 });
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  let pngUrl = null;
  let pngFile = null;
  function download(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  $('svg').disabled = false;
  $('svg').onclick = () => download(svgUrl, 'BeatOnStep.svg');
  $('png').onclick = () => { if (pngUrl) download(pngUrl, 'BeatOnStep-story.png'); };
  $('copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(card.SITE);
      status(t('Lien de l’app copié.', 'App link copied.'));
    } catch {
      $('link').hidden = false; $('link').value = card.SITE; $('link').select();
      status(t('Sélectionnez et copiez ce lien.', 'Select and copy this link.'));
    }
  };
  $('share').onclick = async () => {
    if (!pngFile) return;
    try {
      // File prepared before the gesture: keep browser transient activation.
      await navigator.share({ files: [pngFile] });
    } catch (error) {
      if (error.name !== 'AbortError') status(t('Partage indisponible. Téléchargez le PNG puis ouvrez Instagram.', 'Sharing unavailable. Download the PNG and open Instagram.'));
    }
  };
  const preview = $('preview');
  preview.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(preview, 0, 0, 1080, 1920);
      canvas.toBlob(blob => {
        if (!blob) { status(t('Export PNG indisponible. Le SVG reste téléchargeable.', 'PNG export unavailable. You can still download the SVG.')); return; }
        pngUrl = URL.createObjectURL(blob);
        $('png').disabled = false;
        // Preview the actual PNG; long-press saving remains available on mobile.
        preview.onload = null;
        preview.src = pngUrl;
        if (typeof File === 'function') {
          pngFile = new File([blob], 'BeatOnStep-story.png', { type: 'image/png' });
          try { $('share').hidden = !(navigator.share && navigator.canShare && navigator.canShare({ files: [pngFile] })); }
          catch { $('share').hidden = true; }
          $('share').disabled = false;
        } else { $('share').hidden = true; }
      }, 'image/png');
    } catch { status(t('Export PNG indisponible. Le SVG reste téléchargeable.', 'PNG export unavailable. You can still download the SVG.')); }
  };
  preview.onerror = () => status(t('Aperçu indisponible. Réessayez dans Safari ou Chrome.', 'Preview unavailable. Try again in Safari or Chrome.'));
  preview.src = svgUrl;
  // Retain object URLs while this document lives (including browser back/forward cache).
})();
