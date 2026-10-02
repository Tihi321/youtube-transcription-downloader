# youtube-transcription-downloader

Paste a YouTube link, preview the transcript, and download it as TXT, timestamped TXT, SRT, VTT or JSON.

No dependencies, just Node 18+.

```bash
npm start
# open http://localhost:3000
```

Set `PORT` to use a different port.

## How it works

The browser can't fetch YouTube captions directly (CORS), so a small Node server (`server.js`) does it:

1. Reads the video's InnerTube API key from the watch page.
2. Calls the InnerTube `player` endpoint to list the caption tracks (manual and auto-generated, all languages).
3. Downloads the chosen track's XML and converts it to the requested format.

It only works for videos that have captions (manual or auto-generated). YouTube can rate-limit or block
requests, especially from cloud/VPN IPs; running it locally from a home connection works best.
