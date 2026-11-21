// Five-Star Heat 3D: the entry program (Node 22, standard library only). The game
// is the static files under game/ — plain HTML and ES modules a desktop browser
// loads offline, no build step and no network request — and the screenshots in
// screenshots/. This program hands both in: it copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library. The game itself is a 3D
// open world in Solmar Bay, built on a vendored three.js: drive and walk a
// coastal city, run five story jobs, and outrun Solmar PD from one star to
// five — cruisers, roadblocks, a helicopter and, at five stars, a tank — with a
// full HUD: mission card, wanted stars, dispatch list, minimap and speedometer.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// The gate refuses an entry whose game/ has no index.html, so fail loudly here
// instead of handing in an empty folder.
if (!existsSync(join(gameDir, 'index.html')) || !statSync(join(gameDir, 'index.html')).isFile()) {
  throw new Error('game/index.html is missing: the game cannot be entered without it');
}

const shotsOut = join(out, 'screenshots');

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(shotsOut, { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, shotsOut, { recursive: true });

// The gate wants three or four screenshots of the game itself, so refuse an
// entry that would arrive with none (a stale clone, a missed copy).
const shotFiles = existsSync(shotsOut)
  ? readdirSync(shotsOut).filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
  : [];
if (shotFiles.length === 0) {
  throw new Error('screenshots/ holds no images: the entry needs 3-4 real renders of the game');
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes;
// the others refuse an entry the scorer would refuse (more than 4 screenshots or
// one over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all,
// or a path under game/ over 1000 bytes: game/ counts beside /output's own
// 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
