// Builds a standalone executable (Node single executable application) into dist/.
// The exe embeds the Node runtime, the bundled server and the UI, so it runs without Node installed.
import { build } from 'esbuild';
import { inject } from 'postject';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = 'dist';
const NAME = 'yt-transcript-downloader';
const exe = path.join(DIST, process.platform === 'win32' ? `${NAME}.exe` : NAME);
const bundle = path.join(DIST, 'server.cjs');
const blob = path.join(DIST, 'sea-prep.blob');
const seaConfig = path.join(DIST, 'sea-config.json');

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST);

console.log('1/4 Bundling server');
await build({
  entryPoints: ['server.js'],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  // import.meta.url is only used outside the exe (when reading public/index.html from disk).
  logOverride: { 'empty-import-meta': 'silent' },
});

console.log('2/4 Creating SEA blob');
await writeFile(
  seaConfig,
  JSON.stringify({
    main: bundle,
    output: blob,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    assets: { 'index.html': 'public/index.html' },
  }),
);
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

console.log('3/4 Copying Node runtime');
await copyFile(process.execPath, exe);

console.log('4/4 Injecting app into executable');
await inject(exe, 'NODE_SEA_BLOB', await readFile(blob), {
  sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  machoSegmentName: process.platform === 'darwin' ? 'NODE_SEA' : undefined,
});

await Promise.all([bundle, blob, seaConfig].map((f) => rm(f)));
console.log(`\nDone: ${exe}`);
