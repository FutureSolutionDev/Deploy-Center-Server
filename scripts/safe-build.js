#!/usr/bin/env node
/**
 * Safe build (v3.0.1, OPS-C1).
 *
 * The old `prebuild: rimraf dist` deleted the running server's code before
 * compiling, so a failed build (or `npm start` on a broken checkout) left the
 * host with no dist at all. This script compiles into a temporary directory
 * and only swaps it into place after tsc succeeds. On failure, dist is left
 * exactly as it was.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const staging = path.join(root, `.dist-build-${process.pid}`);
const previous = path.join(root, `.dist-prev-${process.pid}`);

function remove(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

remove(staging);

const tsc = require.resolve('typescript/bin/tsc', { paths: [root] });
const result = spawnSync(
  process.execPath,
  [tsc, '-p', path.join(root, 'tsconfig.json'), '--outDir', staging],
  { cwd: root, stdio: 'inherit' }
);

if (result.status !== 0) {
  remove(staging);
  process.stderr.write('[build] tsc failed; existing dist/ left untouched.\n');
  process.exit(result.status || 1);
}

const hadDist = fs.existsSync(dist);
if (hadDist) fs.renameSync(dist, previous);
try {
  fs.renameSync(staging, dist);
} catch (error) {
  if (hadDist) fs.renameSync(previous, dist);
  remove(staging);
  process.stderr.write(`[build] could not install new build: ${error.message}\n`);
  process.exit(1);
}
if (hadDist) remove(previous);
process.stdout.write('[build] dist/ updated.\n');
