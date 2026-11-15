// Foundry Yard: a three.js tactical FPS entry for threejs-fps-02 (Node 22, standard
// library only). The game is this directory's game/ folder — plain static files the
// browser loads as ES modules, three.js 0.187.0 from an import map — and this program
// hands it in: it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library (vendor/makefun-threejs.ts, the kit's copy, unchanged).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program runs twice in the grader and both runs must write the same bytes, so
// it writes nothing but the copies and the dossier, and it refuses to run when the
// input it needs is missing instead of writing a half entry.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// The gate's own caps, from the kit's reference/gate.json.
const GAME_MAX_ENTRIES = 993;
const GAME_MAX_BYTES = 48 * 1024 * 1024;
const SHOT_MAX_BYTES = 256 * 1024;
const DOSSIER_TEXT_MAX_BYTES = 163840;

function fail(message) {
  throw new Error(`main.ts: ${message}`);
}

// Walk a tree and count its entries and bytes. The gate refuses symlinks in
// game/, so a symlink fails here instead of shipping one.
function countTree(dir) {
  let entries = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (lstatSync(path).isSymbolicLink()) fail(`${path} is a symlink, the gate takes plain files only`);
      const stat = statSync(path);
      entries += 1;
      if (stat.isDirectory()) stack.push(path);
      else bytes += stat.size;
    }
  }
  return { entries, bytes };
}

// Check the inputs before copying anything, so a bad tree fails loudly here
// instead of at the gate.
function checkInputs() {
  for (const needed of ['index.html', join('vendor', 'three', 'three.module.min.js'), join('vendor', 'three', 'three.core.min.js')]) {
    if (!existsSync(join(gameDir, needed))) fail(`game/${needed} is missing`);
  }
  const gameSize = countTree(gameDir);
  if (gameSize.entries > GAME_MAX_ENTRIES) fail(`game/ holds ${gameSize.entries} entries, over the gate's ${GAME_MAX_ENTRIES}`);
  if (gameSize.bytes > GAME_MAX_BYTES) fail(`game/ holds ${gameSize.bytes} bytes, over the gate's 48 MiB`);

  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((n) => !n.startsWith('.')) : [];
  if (shots.length < 3 || shots.length > 4) fail(`screenshots/ holds ${shots.length} images, the gate wants 3 or 4`);
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > SHOT_MAX_BYTES) fail(`screenshots/${name} is ${size} bytes, over the gate's 256 KiB`);
  }
  return { gameSize, shots };
}

const { gameSize, shots } = checkInputs();

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: DOSSIER_TEXT_MAX_BYTES, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: GAME_MAX_ENTRIES, game_max_bytes: 50331648 }),
);

const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`main.ts: game/ ${gameSize.entries} entries, ${gameSize.bytes} bytes; screenshots/ ${shots.length} images; dossier.json ${dossierBytes} bytes -> ${out}`);
