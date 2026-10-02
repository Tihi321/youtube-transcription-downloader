// Fetches YouTube caption tracks via the InnerTube player API.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ANDROID_CLIENT = { clientName: 'ANDROID', clientVersion: '20.10.38' };

export function parseVideoId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let url;
  try {
    url = new URL(s.startsWith('http') ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  if (host === 'youtu.be') return valid(url.pathname.slice(1, 12));
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v) return valid(v);
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

function valid(id) {
  return /^[\w-]{11}$/.test(id) ? id : null;
}

async function getApiKey(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const html = await res.text();
  if (html.includes('action="https://consent.youtube.com/s"')) {
    throw new Error('YouTube consent page blocked the request.');
  }
  const m = html.match(/"INNERTUBE_API_KEY":\s*"([\w-]+)"/);
  if (!m) throw new Error('Could not read YouTube page (maybe rate-limited or blocked).');
  return m[1];
}

export async function getVideoInfo(videoId) {
  const key = await getApiKey(videoId);
  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ context: { client: ANDROID_CLIENT }, videoId }),
  });
  if (!res.ok) throw new Error(`YouTube player API returned ${res.status}.`);
  const data = await res.json();

  const status = data.playabilityStatus?.status;
  if (status && status !== 'OK') {
    throw new Error(data.playabilityStatus?.reason || `Video is not playable (${status}).`);
  }

  const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  return {
    videoId,
    title: data.videoDetails?.title || videoId,
    author: data.videoDetails?.author || '',
    tracks: tracks.map((t) => ({
      languageCode: t.languageCode,
      name: t.name?.simpleText || t.name?.runs?.map((r) => r.text).join('') || t.languageCode,
      auto: t.kind === 'asr',
      baseUrl: t.baseUrl.replace('&fmt=srv3', ''),
    })),
  };
}

export async function getTranscript(track) {
  const res = await fetch(track.baseUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Caption download failed (${res.status}).`);
  return parseCaptionXml(await res.text());
}

function decodeEntities(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseCaptionXml(xml) {
  const segments = [];
  // Classic format: <text start="1.2" dur="3.4">...</text>
  for (const m of xml.matchAll(/<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)) {
    segments.push({ start: +m[1], dur: +(m[2] || 0), text: clean(m[3]) });
  }
  // srv3 format: <p t="1200" d="3400">...</p>
  if (!segments.length) {
    for (const m of xml.matchAll(/<p t="(\d+)"(?: d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g)) {
      segments.push({ start: m[1] / 1000, dur: (m[2] || 0) / 1000, text: clean(m[3]) });
    }
  }
  return segments.filter((s) => s.text);
}

function clean(raw) {
  // Entities can be double-encoded (e.g. &amp;#39;), so decode twice.
  return decodeEntities(decodeEntities(raw)).replace(/\s+/g, ' ').trim();
}
