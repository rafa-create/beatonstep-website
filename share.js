(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let input = {}, invalid = false;
  try {
    if (location.hash.length > 65536) throw new Error('Too long');
    if (location.hash.length > 1) {
      input = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (!input || input.v !== 1) throw new Error('Unknown version');
    }
  } catch {
    input = {};
    invalid = true;
  }
  history.replaceState(null, '', location.pathname + location.search);

  const card = window.BeatOnStepCard;
  const data = card.normalize(input);
  const t = (fr, en) => data.lang === 'en' ? en : fr;

  const availability = {
    music: data.runTracks.length > 0,
    duration: Number.isSafeInteger(data.sessionSec) && data.sessionSec > 0,
    distance: data.runDistanceMeters !== null,
    pace: data.runAveragePaceSecPerKm !== null,
    steps: data.runSteps !== null,
    trackCount: data.trackCount !== null && data.trackCount > 0,
    avgPpm: data.avgPpm !== null,
    avgMusicBpm: data.avgMusicBpm !== null,
  };
  if (data.selectedTrackIndex === null && availability.music) {
    const trackOfRunIndex = data.runTracks.findIndex(track =>
      track.title === data.trackOfRunTitle &&
      track.artist === data.trackOfRunArtist
    );
    data.selectedTrackIndex = trackOfRunIndex >= 0 ? trackOfRunIndex : 0;
  }
  data.visible = Object.fromEntries(
    Object.entries(availability).map(([key, available]) => [key, !!available])
  );
  let labels = {};
  let variants = card.variantsFor(data);
  let selected = variants[0]?.id || 'live-rhythm';
  let tone = 'light';
  let generation = 0;
  let assets = null;
  let previewUrls = [];
  let toastTimer;

  function applyLanguage() {
    document.documentElement.lang = data.lang;
    labels = {
      heading: t('Créer ma story', 'Create my story'),
      intro: t('Choisis les infos à afficher, puis le morceau et le style.', 'Choose what to show, then the track and design.'),
      'gallery-label': t('4 styles · une même course', '4 styles · one run'),
      light: t('Clair', 'Light'),
      dark: t('Sombre', 'Dark'),
      share: t('Partager', 'Share'),
      save: t('Enregistrer', 'Save'),
      'selection-label': t('Visuel sélectionné', 'Selected design'),
      'save-help': t('Appui long puis « Enregistrer dans Photos ».', 'Touch and hold, then choose “Save to Photos”.'),
      'close-save': t('Fermer', 'Close'),
      'track-select-label': t('Morceau écouté pendant la course', 'Track played during the run'),
      'track-help': t('Le choix s’applique aux quatre visuels.', 'The choice applies to all four designs.'),
      'metric-select-label': t('Infos à afficher', 'Show in story'),
      trackPlaceholder: t('Choisir un morceau…', 'Choose a track…'),
      noTracks: t('Aucun morceau écouté durant cette course', 'No track played during this run'),
      fieldMusic: t('Musique', 'Music'),
      fieldDuration: t('Durée', 'Duration'),
      fieldDistance: t('Distance', 'Distance'),
      fieldPace: t('Allure', 'Pace'),
      fieldSteps: t('Pas', 'Steps'),
      fieldTrackCount: t('Musiques écoutées', 'Tracks played'),
      fieldAvgPpm: t('PPM moyen', 'Average SPM'),
      fieldAvgMusicBpm: t('BPM moyen', 'Average BPM'),
    };
    Object.entries(labels).forEach(([id, value]) => {
      const element = $(id);
      if (element) element.textContent = value;
    });
    document.querySelector('.tones').setAttribute('aria-label', t('Couleur', 'Color'));
    document.querySelector('.lang').setAttribute('aria-label', t('Langue', 'Language'));
    document.querySelectorAll('.lang button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.set === data.lang));
    });
  }

  function status(message, error = false) {
    clearTimeout(toastTimer);
    $('status').textContent = message;
    $('status').dataset.error = String(error);
    $('status').hidden = false;
    toastTimer = setTimeout(() => { $('status').hidden = true; }, 4500);
  }

  function setBusy(id, on) {
    $(id).disabled = on;
    $(id).textContent = on ? t('Ouverture…', 'Opening…') : labels[id];
  }

  function canShare(file) {
    try {
      return !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
    } catch {
      return false;
    }
  }

  function formatNumber(value) {
    return value.toLocaleString(data.lang === 'en' ? 'en-US' : 'fr-FR');
  }

  function formatDuration(seconds) {
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return '';
    if (seconds < 60) return `${seconds} s`;
    return `${Math.max(1, Math.round(seconds / 60))} min`;
  }

  function trackOptionLabel(track) {
    const parts = [
      track.artist ? `${track.title} — ${track.artist}` : track.title,
      track.bpm !== null ? `${track.bpm} BPM` : '',
      formatDuration(track.listenedSeconds),
      track.stepCount !== null ? `${formatNumber(track.stepCount)} ${t('pas', 'steps')}` : '',
    ].filter(Boolean);
    return parts.join(' · ');
  }

  function populateTrackSelect() {
    const select = $('track-select');
    select.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = data.runTracks.length > 0 ? labels.trackPlaceholder : labels.noTracks;
    select.appendChild(placeholder);

    data.runTracks.forEach((track, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = trackOptionLabel(track);
      select.appendChild(option);
    });

    select.disabled = data.runTracks.length === 0;
    select.value =
      data.selectedTrackIndex !== null && data.selectedTrackIndex < data.runTracks.length
        ? String(data.selectedTrackIndex)
        : '';
  }

  function populateMetricOptions() {
    const container = $('metric-options');
    container.replaceChildren();
    const fields = [
      ['music', labels.fieldMusic],
      ['duration', labels.fieldDuration],
      ['distance', labels.fieldDistance],
      ['pace', labels.fieldPace],
      ['steps', labels.fieldSteps],
      ['trackCount', labels.fieldTrackCount],
      ['avgPpm', labels.fieldAvgPpm],
      ['avgMusicBpm', labels.fieldAvgMusicBpm],
    ];
    for (const [key, labelText] of fields) {
      if (!availability[key]) continue;
      const label = document.createElement('label');
      label.className = 'metric-toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = data.visible[key] !== false;
      input.dataset.field = key;
      const span = document.createElement('span');
      span.textContent = labelText;
      label.append(input, span);
      input.onchange = () => {
        data.visible[key] = input.checked;
        updateTrackPicker();
        redrawGallery();
        prepare();
      };
      container.appendChild(label);
    }
    $('metric-picker').hidden = container.children.length === 0;
  }

  function updateTrackPicker() {
    $('track-picker').hidden = !availability.music || data.visible.music === false;
  }

  function releaseAssets() {
    if (assets?.svgUrl) URL.revokeObjectURL(assets.svgUrl);
    if (assets?.pngUrl) URL.revokeObjectURL(assets.pngUrl);
    assets = null;
  }

  function redrawGallery() {
    const old = previewUrls;
    previewUrls = [];
    $('gallery').replaceChildren();

    for (const variant of variants) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile';
      button.dataset.variant = variant.id;
      button.setAttribute('aria-pressed', String(selected === variant.id));
      const name = variant[data.lang];
      button.setAttribute('aria-label', name);

      button.disabled = false;

      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      const image = document.createElement('img');
      image.alt = name;
      const url = URL.createObjectURL(
        new Blob([card.render(data, variant.id, tone)], { type: 'image/svg+xml' })
      );
      previewUrls.push(url);
      image.src = url;
      thumb.appendChild(image);

      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = '✓';
      check.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = name;

      button.append(thumb, check, label);
      button.onclick = () => {
        if (selected === variant.id || button.disabled) return;
        selected = variant.id;
        prepare();
      };
      $('gallery').appendChild(button);
    }

    old.forEach(url => URL.revokeObjectURL(url));
  }

  function prepare() {
    const currentGeneration = ++generation;
    releaseAssets();

    const variant = variants.find(item => item.id === selected) || variants[0];
    if (!variant) return;
    selected = variant.id;
    $('selection-name').textContent = variant[data.lang];

    document.querySelectorAll('.tile').forEach(element => {
      element.setAttribute('aria-pressed', String(element.dataset.variant === selected));
    });
    updateTrackPicker();

    const blocked = !Object.entries(availability).some(
      ([key, available]) => available && data.visible[key] !== false
    );

    $('share').disabled = true;
    $('save').disabled = true;
    $('share').textContent = blocked ? labels.share : t('Préparation…', 'Preparing…');
    $('save').textContent = blocked ? labels.save : t('Préparation…', 'Preparing…');

    if (blocked) return;

    const svgBlob = new Blob(
      [card.render(data, selected, tone)],
      { type: 'image/svg+xml;charset=utf-8' }
    );
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      if (currentGeneration !== generation) {
        URL.revokeObjectURL(svgUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = variant.width;
      canvas.height = variant.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fail(svgUrl);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (currentGeneration !== generation || !blob) {
          fail(svgUrl);
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        const name = `BeatOnStep-${selected}-${tone}.png`;
        const pngFile =
          typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
        assets = { svgUrl, pngUrl, pngBlob: blob, pngFile, name };
        $('save-preview').src = pngUrl;
        $('share').disabled = false;
        $('save').disabled = false;
        $('share').textContent = labels.share;
        $('save').textContent = labels.save;
      }, 'image/png');
    };
    image.onerror = () => fail(svgUrl);
    image.src = svgUrl;

    function fail(url) {
      if (currentGeneration !== generation) {
        URL.revokeObjectURL(url);
        return;
      }
      URL.revokeObjectURL(url);
      $('share').textContent = labels.share;
      $('save').textContent = labels.save;
      status(t('Impossible de préparer le visuel.', 'Unable to prepare the image.'), true);
    }
  }

  function showSaveHelp() {
    if (!assets?.pngUrl) return;
    $('save-preview').src = assets.pngUrl;
    $('save-panel').hidden = false;
  }

  $('close-save').onclick = () => {
    $('save-panel').hidden = true;
  };

  $('track-select').onchange = event => {
    const value = event.target.value;
    data.selectedTrackIndex = value === '' ? null : Number(value);
    redrawGallery();
    prepare();
  };

  for (const choice of ['light', 'dark']) {
    $(choice).onclick = () => {
      tone = choice;
      for (const id of ['light', 'dark']) {
        $(id).setAttribute('aria-pressed', String(id === tone));
      }
      redrawGallery();
      prepare();
    };
  }

  document.querySelectorAll('.lang button').forEach(button => {
    button.onclick = () => {
      const next = button.dataset.set === 'en' ? 'en' : 'fr';
      if (next === data.lang) return;
      data.lang = next;
      applyLanguage();
      populateMetricOptions();
      populateTrackSelect();
      redrawGallery();
      prepare();
    };
  });

  $('share').onclick = async () => {
    const current = assets;
    if (!current?.pngBlob) return;
    if (!canShare(current.pngFile)) {
      showSaveHelp();
      return;
    }
    setBusy('share', true);
    try {
      await navigator.share({ files: [current.pngFile] });
    } catch (error) {
      if (!error || error.name !== 'AbortError') {
        status(t('Partage indisponible.', 'Sharing unavailable.'), true);
      }
    } finally {
      setBusy('share', false);
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
    setBusy('save', true);
    status(t('Choisis « Enregistrer l’image ».', 'Choose “Save Image”.'));
    try {
      await navigator.share({ files: [current.pngFile] });
    } catch (error) {
      if (!error || error.name !== 'AbortError') showSaveHelp();
    } finally {
      setBusy('save', false);
      $('save').disabled = !assets?.pngBlob;
    }
  };

  applyLanguage();
  populateMetricOptions();
  populateTrackSelect();
  redrawGallery();
  prepare();
  if (invalid) status(t('Données indisponibles.', 'Data unavailable.'), true);
})();
