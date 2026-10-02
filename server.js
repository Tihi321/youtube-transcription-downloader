import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import sea from 'node:sea';
import { parseVideoId, getVideoInfo, getTranscript } from './src/youtube.js';
import { FORMATS } from './src/formats.js';

const PORT = Number(process.env.PORT) || 3000;
const IS_EXE = sea.isSea();

// In the standalone exe the page is embedded as a SEA asset.
function indexHtml() {
  if (IS_EXE) return sea.getAsset('index.html', 'utf8');
  return readFile(new URL('./public/index.html', import.meta.url));
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function safeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'transcript';
}

async function loadTranscript(params) {
  const videoId = parseVideoId(params.get('url'));
  if (!videoId) throw Object.assign(new Error('That does not look like a YouTube link.'), { status: 400 });

  const info = await getVideoInfo(videoId);
  if (!info.tracks.length) {
    throw Object.assign(new Error('This video has no transcript/captions available.'), { status: 404 });
  }

  const lang = params.get('lang');
  const track =
    info.tracks.find((t) => `${t.languageCode}${t.auto ? ':auto' : ''}` === lang) ||
    info.tracks.find((t) => !t.auto && t.languageCode.startsWith('en')) ||
    info.tracks.find((t) => t.languageCode.startsWith('en')) ||
    info.tracks[0];

  const segments = await getTranscript(track);
  return { info, track, segments };
}

const routes = {
  async '/api/transcript'(req, res, params) {
    const { info, track, segments } = await loadTranscript(params);
    sendJson(res, 200, {
      videoId: info.videoId,
      title: info.title,
      author: info.author,
      selected: `${track.languageCode}${track.auto ? ':auto' : ''}`,
      languages: info.tracks.map((t) => ({
        value: `${t.languageCode}${t.auto ? ':auto' : ''}`,
        label: t.auto ? `${t.name} (auto-generated)` : t.name,
      })),
      segments,
    });
  },

  async '/api/download'(req, res, params) {
    const fmtKey = params.get('format') || 'txt';
    const fmt = FORMATS[fmtKey];
    if (!fmt) return sendJson(res, 400, { error: `Unknown format "${fmtKey}".` });

    const { info, track, segments } = await loadTranscript(params);
    const name = `${safeFilename(info.title)} [${track.languageCode}].${fmt.ext || fmtKey}`;
    res.writeHead(200, {
      'Content-Type': `${fmt.mime}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    });
    res.end(fmt.render(segments));
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const route = routes[url.pathname];
    if (route) return await route(req, res, url.searchParams);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(await indexHtml());
    }
    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    sendJson(res, err.status || 502, { error: err.message || 'Something went wrong.' });
  }
});

function listen(port, triesLeft = 10) {
  const onError = (err) => {
    // Drop the failed attempt's listening callback so it doesn't fire for the retry.
    server.removeAllListeners('listening');
    if (err.code === 'EADDRINUSE' && triesLeft > 0) return listen(port + 1, triesLeft - 1);
    console.error(err.message);
    process.exit(1);
  };
  server.once('error', onError);
  server.listen(port, '127.0.0.1', () => {
    server.off('error', onError);
    const url = `http://localhost:${port}`;
    console.log(`YouTube transcript downloader running at ${url}`);
    if (IS_EXE) {
      console.log('Close this window to stop it.');
      if (!process.env.NO_BROWSER) openBrowser(url);
    }
  });
}

listen(PORT);
