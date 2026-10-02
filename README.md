# youtube-transcription-downloader

Paste a YouTube link, preview the transcript, and download it as TXT, timestamped TXT, SRT, VTT or JSON.

No runtime dependencies, just Node 20.12+.

```bash
yarn start
# open http://localhost:3000
```

Set `PORT` to use a different port (if it's taken, the next free one is used).

## Standalone executable

Build a single `.exe` that runs on machines without Node installed:

```bash
yarn install
yarn build:exe
# -> dist/yt-transcript-downloader.exe
```

Double-click it: it starts the server and opens the page in your browser. Close the console window to stop it.
Set `NO_BROWSER=1` to skip opening the browser.

The exe is built for the OS and CPU you build on (Windows x64 here). Because injecting the app invalidates
Node's code signature, Windows SmartScreen may warn the first time you run it ("More info" → "Run anyway").

## How it works

The browser can't fetch YouTube captions directly (CORS), so a small Node server (`server.js`) does it:

1. Reads the video's InnerTube API key from the watch page.
2. Calls the InnerTube `player` endpoint to list the caption tracks (manual and auto-generated, all languages).
3. Downloads the chosen track's XML and converts it to the requested format.

It only works for videos that have captions (manual or auto-generated). YouTube can rate-limit or block
requests, especially from cloud/VPN IPs; running it locally from a home connection works best.
