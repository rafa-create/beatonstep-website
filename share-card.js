/* Text and shapes remain vector. Original brand logo is embedded unchanged. */
(function (root) {
  'use strict';
  const SITE = 'https://rafa-create.github.io/beatonstep-website/';
  const LOGO = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAGQAZADASIAAhEBAxEB/8QAHgABAAICAgMBAAAAAAAAAAAAAAEIBwkFBgIECgP/xABHEAABAwMCBAQDBQUEBgsBAAABAAIDBAUGBxEIEiExCRNBURQiYTJCUnGBFRYjYnIzU5GhFyRzgpKiGCU0Q0RUk7GywsPB/8QAHQEBAAEFAQEBAAAAAAAAAAAAAAECBAUGBwgDCf/EAEMRAAIBAwIDBAUJBgUDBQAAAAABAgMEEQUhBhIxB0FRYRMUIjJxI0JSgZGhscHwFRZictHhJDOCkrJDg6IIFyZTc//aAAwDAQACEQMRAD8AvKiIvzHOkBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEcQwAv+UO7F3Tf8t+6khzduZpbv23G26AhERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBE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VJDddbs3kvkjdnG0WTmp6bf1bJUOHmvH9DWfmrwYTgOF6cWGLGMDxa22G1w9W01BAImuP4nEdXu93OJJ91fvjvgzs+pOhwjbesXGMOtPOP8Ac0pPzjBQi/EoVjeX75rqXLHw/t/UpXw7eF9i+MPpsm17ukWRXBm0jbBQvc23xHvtPL0fOR+FvKz35wr02q0WyxW6ms9kttLb6CjjEVPS0sLYoYWDs1jGgNaPoAvb/NFxfiPizV+LLj1jVaznjpHpGP8ALFbL49X3tmZt7WjaR5aS/qP0T6KPXdFrZcBFIRMAKeijom31UgboSibfVQAnqidFICIgKhgJ9UT9UQJJUIoQEqPzUqFIJUIEUxDCIiqICIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAlrntGzXuaPYOIU+ZL/eyf8AGV4ogwjy8yX1lk/4yvHYb77dfdEQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQH//2Q==';
  const variants = [
    { id: 'live-rhythm', context: 'live', fr: 'Ma cadence', en: 'My cadence', width: 1080, height: 1350, transparent: true },
    { id: 'live-music', context: 'live', fr: 'Dans mes oreilles', en: 'Now playing', width: 1080, height: 1350, transparent: true },
    { id: 'recap-rhythm', context: 'recap', fr: 'Ma course', en: 'My run', width: 1080, height: 1350, transparent: true },
    { id: 'recap-track', context: 'recap', fr: 'Mon morceau', en: 'My track', width: 1080, height: 1350, transparent: true },
  ];
  function clean(value, max) {
    return typeof value === 'string' ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('') : '';
  }
  function normalizedArtist(value) {
    const artist = clean(value, 100);
    return /^(unknown artist|artiste inconnu|unknown|inconnu)$/i.test(artist) ? '' : artist;
  }
  function normalizeRunTrack(value, allowUnknownDuration = false) {
    if (!value || typeof value !== 'object') return null;
    const title = clean(value.title, 160);
    if (!title) return null;
    const listenedSeconds =
      Number.isSafeInteger(value.listenedSeconds) && value.listenedSeconds > 0 && value.listenedSeconds <= 86400 * 7
        ? value.listenedSeconds
        : null;
    if (listenedSeconds === null && !allowUnknownDuration) return null;
    return {
      title,
      artist: normalizedArtist(value.artist),
      bpm: Number.isInteger(value.bpm) && value.bpm > 0 && value.bpm <= 400 ? value.bpm : null,
      listenedSeconds,
      avgRunnerPpm:
        Number.isInteger(value.avgRunnerPpm) && value.avgRunnerPpm > 0 && value.avgRunnerPpm <= 300
          ? value.avgRunnerPpm
          : null,
      stepCount:
        Number.isSafeInteger(value.stepCount) && value.stepCount > 0 && value.stepCount <= 9999999
          ? value.stepCount
          : null,
    };
  }
  function normalize(input) {
    const d = input && typeof input === 'object' && input.v === 1 ? input : {};
    const legacyRecap =
      d.shareContext !== 'live' &&
      (d.shareContext === 'recap' ||
        Array.isArray(d.runTracks) ||
        d.avgPpm != null ||
        d.trackOfRunTitle);
    const shareContext = legacyRecap ? 'recap' : 'live';

    let runTracks = Array.isArray(d.runTracks)
      ? d.runTracks.slice(0, 1000).map(normalizeRunTrack).filter(Boolean)
      : [];
    const legacyTrack = d.trackOfRunTitle
      ? normalizeRunTrack({
          title: d.trackOfRunTitle,
          artist: d.trackOfRunArtist,
          bpm: d.trackOfRunBpm,
          listenedSeconds: d.trackOfRunListenedSeconds,
          // Ancien payload : statistiques par morceau inconnues, ne jamais
          // attribuer la moyenne globale ou tous les pas au morceau.
          avgRunnerPpm: null,
          stepCount: null,
        }, true)
      : null;
    if (runTracks.length === 0 && legacyTrack) runTracks = [legacyTrack];

    const selectedTrackIndex =
      Number.isSafeInteger(d.selectedTrackIndex) &&
      d.selectedTrackIndex >= 0 &&
      d.selectedTrackIndex < runTracks.length
        ? d.selectedTrackIndex
        : null;
    const runDistanceSource =
      d.runDistanceSource === 'garmin_mobile_stop' || d.runDistanceSource === 'garmin_watch_saved'
        ? d.runDistanceSource
        : null;
    const runDistanceMeters =
      runDistanceSource !== null &&
      typeof d.runDistanceMeters === 'number' &&
      Number.isFinite(d.runDistanceMeters) &&
      d.runDistanceMeters >= 0 &&
      d.runDistanceMeters <= 10000000
        ? d.runDistanceMeters
        : null;
    const runAveragePaceSecPerKm =
      runDistanceSource !== null &&
      typeof d.runAveragePaceSecPerKm === 'number' &&
      Number.isFinite(d.runAveragePaceSecPerKm) &&
      d.runAveragePaceSecPerKm > 0 &&
      d.runAveragePaceSecPerKm <= 86400
        ? Math.round(d.runAveragePaceSecPerKm)
        : null;

    return {
      v: 1,
      lang: d.lang === 'en' ? 'en' : 'fr',
      shareContext,
      selectedTrackIndex,
      runTracks,
      ppm: Number.isInteger(d.ppm) && d.ppm > 0 && d.ppm <= 300 ? d.ppm : null,
      trackBpm: Number.isInteger(d.trackBpm) && d.trackBpm > 0 && d.trackBpm <= 400 ? d.trackBpm : null,
      cadence: d.cadence === 'target' ? 'target' : 'measured',
      steps: Number.isSafeInteger(d.steps) && d.steps > 0 && d.steps <= 9999999 ? d.steps : null,
      title: clean(d.title, 160),
      artist: normalizedArtist(d.artist),
      avgPpm: Number.isInteger(d.avgPpm) && d.avgPpm > 0 && d.avgPpm <= 300 ? d.avgPpm : null,
      avgMusicBpm: Number.isInteger(d.avgMusicBpm) && d.avgMusicBpm > 0 && d.avgMusicBpm <= 400 ? d.avgMusicBpm : null,
      avgGapBpm: typeof d.avgGapBpm === 'number' && Number.isFinite(d.avgGapBpm) && d.avgGapBpm >= 0 && d.avgGapBpm <= 400
        ? Math.round(d.avgGapBpm * 10) / 10
        : null,
      sessionSec: Number.isSafeInteger(d.sessionSec) && d.sessionSec >= 0 && d.sessionSec <= 86400 * 7 ? d.sessionSec : null,
      runSteps: Number.isSafeInteger(d.runSteps) && d.runSteps > 0 && d.runSteps <= 9999999 ? d.runSteps : null,
      runDistanceMeters,
      runAveragePaceSecPerKm,
      runDistanceSource,
      trackCount: Number.isSafeInteger(d.trackCount) && d.trackCount >= 0 && d.trackCount <= 9999 ? d.trackCount : null,
      runCadence: d.runCadence === 'target' ? 'target' : d.runCadence === 'measured' ? 'measured' : null,
      trackOfRunTitle: clean(d.trackOfRunTitle, 160),
      trackOfRunArtist: normalizedArtist(d.trackOfRunArtist),
      trackOfRunBpm: Number.isInteger(d.trackOfRunBpm) && d.trackOfRunBpm > 0 && d.trackOfRunBpm <= 400 ? d.trackOfRunBpm : null,
    };
  }
  function variantsFor(_input) {
    // Quatre cartes identiques, qu'on arrive des Réglages ou du récap.
    return variants;
  }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function short(value, max) {
    const chars = Array.from(value);
    return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : value;
  }
  function fit(value, preferred, width) {
    const units = Array.from(value).reduce((sum, c) => sum + (/[il .,'!]/.test(c) ? 0.4 : /[a-z0-9]/.test(c) ? 0.72 : 1.1), 0);
    return Math.min(preferred, Math.floor(width / Math.max(1, units)));
  }
  function titleLines(value) {
    const chars = Array.from(value);
    if (chars.length <= 26) return [value];
    let at = chars.slice(0, 27).lastIndexOf(' ');
    if (at < 10) at = 26;
    return [chars.slice(0, at).join(''), short(chars.slice(at).join('').trim(), 32)];
  }
  function render(input, variantId = 'live-rhythm', tone = 'light') {
    const visibility =
      input && typeof input === 'object' && input.visible && typeof input.visible === 'object'
        ? input.visible
        : {};
    const show = key => visibility[key] !== false;
    const d = normalize(input);
    const allowed = variantsFor(d);
    const v = allowed.find(item => item.id === variantId) || allowed[0] || variants[0];
    const ink = tone === 'dark' ? '#11140f' : '#ffffff';
    const accent = '#fcea07';
    const t = (fr, en) => d.lang === 'en' ? en : fr;
    const cx = v.width / 2;
    const text = (x, y, size, value, weight = 500, color = ink, anchor = 'middle', width = 900) =>
      `<text x="${x}" y="${y}" fill="${color}" font-size="${fit(String(value), size, width)}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
    const metric = (x, y, value, unit, valueSize = 210, unitSize = 58) =>
      `<text x="${x}" y="${y}" fill="${ink}" text-anchor="middle"><tspan font-size="${valueSize}" font-weight="850">${esc(value)}</tspan><tspan font-size="${unitSize}" font-weight="800"> ${esc(unit)}</tspan></text>`;
    const logo = (x, y, size) =>
      `<image x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#brandLogoClip)" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/jpeg;base64,${LOGO}"/>`;
    const line = y =>
      `<path d="M${cx - 240} ${y}H${cx - 110}l30 -24 40 48 40 -68 40 44h200" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;

    const number = value => value.toLocaleString(d.lang === 'en' ? 'en-US' : 'fr-FR');
    const stepText = value => value === null ? '' : `${number(value)} ${t('PAS', 'STEPS')}`;
    const runDuration = seconds => {
      if (seconds === null) return '';
      if (seconds < 60) return `${seconds} S`;
      if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} ${t('MIN', 'MIN')}`;
      return `${Math.floor(seconds / 3600)} H ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;
    };
    const trackDuration = seconds => {
      if (!Number.isSafeInteger(seconds) || seconds <= 0) return '';
      if (seconds < 60) return `${seconds} S`;
      return `${Math.max(1, Math.round(seconds / 60))} ${t('MIN', 'MIN')}`;
    };
    const runDistance = meters => {
      if (meters === null) return '';
      const km = (meters / 1000).toFixed(2);
      return `${d.lang === 'fr' ? km.replace('.', ',') : km} KM`;
    };
    const averagePace = seconds => {
      if (!Number.isInteger(seconds) || seconds <= 0) return '';
      const min = Math.floor(seconds / 60);
      const sec = String(seconds % 60).padStart(2, '0');
      return `${min}:${sec} /KM`;
    };
    const music = (title, artist, y, size = 68) => {
      if (!title) return '';
      const lines = titleLines(title);
      const gap = Math.round(size * 1.05);
      const artistY = y + (lines.length - 1) * gap + Math.round(size * 0.95);
      return lines.map((item, index) => text(540, y + index * gap, size, item, 780, ink, 'middle', 940)).join('') +
        (artist ? text(540, artistY, Math.max(42, Math.round(size * 0.62)), short(artist, 42), 560, ink, 'middle', 900) : '');
    };
    const musicBottomY = (title, artist, y, size = 68) => {
      if (!title) return y;
      const lines = titleLines(title);
      const gap = Math.round(size * 1.05);
      const lastTitleY = y + (lines.length - 1) * gap;
      return artist ? lastTitleY + Math.round(size * 0.95) : lastTitleY;
    };
    const header = context => (
      logo(330, 58, 90) +
      text(455, 121, 48, 'BeatOnStep', 850, ink, 'start', 535) +
      text(540, 245, 38, context, 850, accent, 'middle', 940)
    );

    const liveCadenceLabel =
      d.cadence === 'target'
        ? t('CADENCE CIBLE', 'TARGET CADENCE')
        : d.shareContext === 'recap'
          ? t('MOYENNE COURSE', 'RUN AVERAGE')
          : t('MA CADENCE', 'MY CADENCE');
    const selectedTrack =
      show('music') && d.selectedTrackIndex !== null
        ? d.runTracks[d.selectedTrackIndex] || null
        : null;
    // La sélection est la seule source des champs musicaux sur tous les SVG.
    const chosenTitle = selectedTrack?.title ?? '';
    const chosenArtist = selectedTrack?.artist ?? '';
    const chosenBpm = selectedTrack?.bpm ?? null;

    const runMeta = [
      show('duration') ? runDuration(d.sessionSec) : '',
      show('distance') ? runDistance(d.runDistanceMeters) : '',
      show('pace') ? averagePace(d.runAveragePaceSecPerKm) : '',
      show('steps') ? stepText(d.runSteps) : '',
      show('trackCount') && d.trackCount !== null && d.trackCount > 0
        ? `${d.trackCount} ${t(d.trackCount > 1 ? 'MUSIQUES' : 'MUSIQUE', d.trackCount > 1 ? 'TRACKS' : 'TRACK')}`
        : '',
    ].filter(Boolean).join(' · ');
    const averageMeta = [
      show('avgPpm') && d.avgPpm !== null ? `${d.avgPpm} ${t('PPM', 'SPM')}` : '',
      show('avgMusicBpm') && d.avgMusicBpm !== null ? `${d.avgMusicBpm} BPM` : '',
    ].filter(Boolean).join(' · ');
    const averageBlock = (labelY, valueY, valueSize = 84) =>
      averageMeta
        ? text(540, labelY, 42, t('EN MOYENNE', 'AVERAGE'), 850, accent, 'middle', 940) +
          text(540, valueY, valueSize, averageMeta, 850, ink, 'middle', 980)
        : '';

    let content = '';

    if (v.id === 'live-rhythm') {
      content += header(t('MON RYTHME', 'MY RHYTHM'));
      if (d.shareContext === 'recap') {
        content += text(540, 325, 58, t('MA COURSE', 'MY RUN'), 850, ink, 'middle', 940);
        content += averageBlock(455, 575, 88);
        if (runMeta) content += text(540, 725, 44, runMeta, 720, ink, 'middle', 1000);
        content += line(835);
        if (chosenTitle) {
          content += text(540, 925, 40, t('MUSIQUE', 'MUSIC'), 820, accent);
          content += music(chosenTitle, chosenArtist, 1010, 62);
        }
      } else {
        content += text(540, 325, 58, liveCadenceLabel, 850, ink, 'middle', 940);
        if (d.ppm !== null) {
          content += metric(540, 590, d.ppm, t('PPM', 'SPM'), 215, 60);
          content += text(
            540, 670, 45,
            d.cadence === 'target' ? t('CADENCE CIBLE', 'TARGET CADENCE') : t('CADENCE ACTUELLE', 'CURRENT CADENCE'),
            750
          );
        } else {
          content += text(540, 565, 64, t('Cadence en attente', 'Waiting for cadence'), 800);
        }
        const liveSteps = show('steps') ? stepText(d.steps ?? d.runSteps) : '';
        if (liveSteps) content += text(540, 755, 48, liveSteps, 720, ink, 'middle', 940);
        content += line(850);
        if (show('music')) {
          content += text(540, 950, 44, t('MORCEAU CHOISI', 'CHOSEN TRACK'), 820);
          if (chosenTitle) {
            const trackY = 1040;
            content += music(chosenTitle, chosenArtist, trackY, 60);
            if (chosenBpm !== null) {
              const bottom = musicBottomY(chosenTitle, chosenArtist, trackY, 60);
              content += text(540, Math.min(bottom + 92, 1300), 46, `${chosenBpm} BPM · ${t('MORCEAU', 'TRACK')}`, 760);
            }
          }
        }
      }
    } else if (v.id === 'live-music') {
      content += header(t('MON RYTHME', 'MY RHYTHM'));
      if (d.shareContext === 'recap') {
        content += text(540, 325, 58, chosenTitle ? t('DANS MES OREILLES', 'NOW PLAYING') : t('MA COURSE', 'MY RUN'), 850, ink, 'middle', 940);
        if (chosenTitle) content += music(chosenTitle, chosenArtist, 430, 74);
        content += line(700);
        content += averageBlock(805, 905, 76);
        if (runMeta) content += text(540, 1055, 44, runMeta, 720, ink, 'middle', 1000);
      } else {
        content += text(540, 325, 58, t('DANS MES OREILLES', 'NOW PLAYING'), 850, ink, 'middle', 940);
        if (chosenTitle) {
          content += music(chosenTitle, chosenArtist, 440, 74);
        } else if (show('music')) {
          content += text(540, 535, 62, t('La musique suit tes pas', 'Music follows your steps'), 800);
        }
        content += line(710);
        if (show('music') && chosenBpm !== null) {
          content += metric(540, 925, chosenBpm, 'BPM', 190, 58);
          content += text(540, 995, 46, t('MORCEAU', 'TRACK'), 800);
        }
        if (d.ppm !== null) {
          content += text(540, 1125, 54, `${d.ppm} ${t('PPM', 'SPM')} · ${liveCadenceLabel}`, 780, ink, 'middle', 960);
        }
        const liveSteps = show('steps') ? stepText(d.steps ?? d.runSteps) : '';
        if (liveSteps) content += text(540, 1240, 46, liveSteps, 700, ink, 'middle', 940);
      }
    } else if (v.id === 'recap-rhythm') {
      content += header(t('MON RYTHME', 'MY RHYTHM'));
      content += text(540, 325, 58, t('MA COURSE', 'MY RUN'), 850, ink, 'middle', 940);
      content += averageBlock(455, 575, 88);
      if (runMeta) content += text(540, 725, 44, runMeta, 720, ink, 'middle', 1000);
      content += line(835);
      if (chosenTitle) {
        content += text(540, 925, 40, t('MUSIQUE', 'MUSIC'), 820, accent);
        content += music(chosenTitle, chosenArtist, 1010, 62);
      }
    } else {
      content += header(t('MON RYTHME', 'MY RHYTHM'));
      content += text(540, 325, 58, chosenTitle ? t('MON MORCEAU', 'MY TRACK') : t('MA COURSE', 'MY RUN'), 850, ink, 'middle', 940);
      if (chosenTitle) content += music(chosenTitle, chosenArtist, 430, 74);
      content += line(700);
      content += averageBlock(805, 905, 76);
      if (runMeta) content += text(540, 1055, 44, runMeta, 720, ink, 'middle', 1000);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${v.width}" height="${v.height}" viewBox="0 0 ${v.width} ${v.height}" role="img" aria-label="BeatOnStep"><defs><clipPath id="brandLogoClip" clipPathUnits="objectBoundingBox"><rect width="1" height="1" rx=".24" ry=".24"/></clipPath></defs><g font-family="Arial, Helvetica, sans-serif">${content}</g></svg>`;
  }
  const api = { SITE, variants, variantsFor, normalize, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BeatOnStepCard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
