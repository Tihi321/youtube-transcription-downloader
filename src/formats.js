// Turns transcript segments into downloadable file formats.

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

function clock(sec, sep) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

function short(sec) {
  const t = Math.floor(sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function end(seg, next) {
  const e = seg.start + (seg.dur || 2);
  return next ? Math.min(e, next.start) || e : e;
}

export const FORMATS = {
  txt: {
    mime: 'text/plain',
    render: (segs) => segs.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim() + '\n',
  },
  timestamped: {
    ext: 'txt',
    mime: 'text/plain',
    render: (segs) => segs.map((s) => `[${short(s.start)}] ${s.text}`).join('\n') + '\n',
  },
  srt: {
    mime: 'application/x-subrip',
    render: (segs) =>
      segs
        .map((s, i) => `${i + 1}\n${clock(s.start, ',')} --> ${clock(end(s, segs[i + 1]), ',')}\n${s.text}\n`)
        .join('\n'),
  },
  vtt: {
    mime: 'text/vtt',
    render: (segs) =>
      'WEBVTT\n\n' +
      segs.map((s, i) => `${clock(s.start, '.')} --> ${clock(end(s, segs[i + 1]), '.')}\n${s.text}\n`).join('\n'),
  },
  json: {
    mime: 'application/json',
    render: (segs) => JSON.stringify(segs, null, 2),
  },
};
