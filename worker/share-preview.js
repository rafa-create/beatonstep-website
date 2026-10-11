// Share-card metadata for social crawlers. No user identity, tracks, GPS or
// private payloads are inserted into the public HTML response.
export const D1_PUBLIC_ID_OFFSET = 1_000_000_000_000;

const PROVIDERS = {
  spotify: 'Spotify', deezer: 'Deezer', youtube: 'YouTube Music',
  apple: 'Apple Music', amazon: 'Amazon Music',
};

const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function validD1ShareId(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,14}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > D1_PUBLIC_ID_OFFSET
    ? id - D1_PUBLIC_ID_OFFSET : null;
}

function durationLabel(durationSec) {
  if (!Number.isSafeInteger(durationSec) || durationSec <= 0) return null;
  const minutes = Math.round(durationSec / 60);
  if (!minutes) return null;
  if (minutes < 60) return minutes + ' min';
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return hours + ' h' + (rem ? ' ' + String(rem).padStart(2, '0') : '');
}

export function sharePreview(item, id) {
  const name = typeof item?.name === 'string'
    ? item.name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) : '';
  const kind = item?.kind === 'workout' ? 'Séance musicale' : 'Run Mix';
  const provider = PROVIDERS[item?.source] || 'BeatOnStep';
  const title = (name || kind) + ' — BeatOnStep';
  const details = [
    kind, durationLabel(item?.duration_sec),
    Number.isSafeInteger(item?.phases) && item.phases > 0
      ? item.phases + (item.phases > 1 ? ' phases' : ' phase') : null,
    Number.isSafeInteger(item?.tracks) && item.tracks > 0
      ? item.tracks + (item.tracks > 1 ? ' titres' : ' titre') : null,
    item?.kind === 'runmix' && Number.isSafeInteger(item?.bpm) &&
      item.bpm > 0 ? item.bpm + ' BPM' : null,
    provider,
  ].filter(Boolean);
  return {
    title, description: details.join(' · ') + '. À découvrir et importer dans BeatOnStep.',
    url: 'https://beatonstep.app/partages.html?id=' + id,
    image: 'https://beatonstep.app/assets/brand/logo-400.jpg',
  };
}

function replaceTagAttribute(html, marker, value) {
  // The root HTML is version-controlled and uses double-quoted meta attributes.
  const escaped = escapeHtml(value);
  const start = html.indexOf(marker);
  if (start < 0) throw Error('missing_social_meta');
  const valueStart = start + marker.length;
  const end = html.indexOf('"', valueStart);
  if (end < 0) throw Error('missing_social_meta');
  return html.slice(0, valueStart) + escaped + html.slice(end);
}

export function renderSharePreview(html, preview) {
  if (!html.includes('</head>') || !html.includes('</title>')) {
    throw Error('missing_share_head');
  }
  const titleStart = html.indexOf('<title>');
  const titleEnd = html.indexOf('</title>', titleStart + 7);
  if (titleStart < 0 || titleEnd < 0) throw Error('missing_share_title');
  let output = html.slice(0, titleStart + 7) + escapeHtml(preview.title) + html.slice(titleEnd);
  for (const [key, value] of [
    ['<meta name="description" content="', preview.description],
    ['<meta property="og:title" content="', preview.title],
    ['<meta property="og:description" content="', preview.description],
    ['<meta property="og:image" content="', preview.image],
  ]) output = replaceTagAttribute(output, key, value);
  const extra = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'BeatOnStep'],
    ['property', 'og:url', preview.url],
    ['name', 'twitter:card', 'summary'],
    ['name', 'twitter:title', preview.title],
    ['name', 'twitter:description', preview.description],
    ['name', 'twitter:image', preview.image],
  ].map(([attr, name, value]) =>
    '  <meta ' + attr + '="' + name + '" content="' + escapeHtml(value) + '">'
  );
  extra.push('  <link rel="canonical" href="' + escapeHtml(preview.url) + '">');
  return output.replace('</head>', extra.join('\n') + '\n</head>');
}

export async function sharePageResponse(request, env, url) {
  const response = await env.ASSETS.fetch(request);
  if (request.method !== 'GET' || !response.ok || env.CATALOG_BACKEND !== 'd1' ||
      !env.DB || !url.searchParams.has('id')) return response;

  const rowId = validD1ShareId(url.searchParams.get('id'));
  if (rowId === null) return response;

  let item;
  try {
    item = await env.DB.prepare(
      'SELECT kind,source,name,duration_sec,bpm,tracks,phases FROM shared_items WHERE id = ?'
    ).bind(rowId).first();
  } catch {
    // If D1 is temporarily unavailable, the static site + client import remain usable.
    return response;
  }
  // Deleted, missing or legacy shares retain the truthful generic preview.
  if (!item) return response;

  let html;
  try {
    html = renderSharePreview(await response.text(), sharePreview(item, Number(url.searchParams.get('id'))));
  } catch {
    // A static page revision must not break public share browsing.
    return env.ASSETS.fetch(request);
  }
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.delete('last-modified');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
