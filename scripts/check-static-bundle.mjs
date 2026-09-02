#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'dist', 'client');
const WARNING_BYTES = 250 * 1024 * 1024;
const FAILURE_BYTES = 1024 * 1024 * 1024;
const pages = process.argv.includes('--pages');

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await filesBelow(target)));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const files = await filesBelow(CLIENT);
let bytes = 0;
for (const file of files) bytes += (await stat(file)).size;
if (bytes >= FAILURE_BYTES) {
  throw new Error(
    `Static bundle is ${bytes} bytes, at or above the 1 GiB hard limit.`,
  );
}
if (bytes >= WARNING_BYTES) {
  console.warn(`Static bundle warning: ${bytes} bytes is at or above 250 MiB.`);
}

const rootPreview = await readFile(path.join(ROOT, 'social-preview.png'));
const servedPreview = await readFile(path.join(CLIENT, 'social-preview.png'));
if (sha256(rootPreview) !== sha256(servedPreview)) {
  throw new Error('The served social preview differs from the root master.');
}

const dependencyManifest = JSON.parse(
  await readFile(path.join(ROOT, 'dependency-manifest.json'), 'utf8'),
);
const workerEngines = files.filter(
  (file) => path.basename(file) === 're2.wasm',
);
if (!workerEngines.length)
  throw new Error('The static bundle is missing re2.wasm.');
for (const workerEngine of workerEngines) {
  const re2Wasm = await readFile(workerEngine);
  if (sha256(re2Wasm) !== dependencyManifest.re2Wasm.sha256) {
    throw new Error(
      'The built RE2/WASM engine does not match the pinned dependency digest.',
    );
  }
}

if (pages) {
  const readerRoot = path.join(ROOT, 'data', 'corpus', 'reader', 'v0.1.0');
  const readerManifest = JSON.parse(
    await readFile(path.join(readerRoot, 'manifest.json'), 'utf8'),
  );
  const readerRoutes = JSON.parse(
    await readFile(path.join(readerRoot, readerManifest.routes.registry), 'utf8'),
  );
  const renderedRoutes = files.filter(
    (file) => file.startsWith(`${path.join(CLIENT, 'wiki')}${path.sep}`) && file.endsWith('.html'),
  );
  if (renderedRoutes.length !== readerRoutes.length) {
    throw new Error(
      `GitHub Pages output rendered ${renderedRoutes.length} wiki routes, expected ${readerRoutes.length}.`,
    );
  }
  for (const route of readerRoutes) {
    const output = path.join(CLIENT, `${route.route.slice(1)}.html`);
    if (!files.includes(output)) throw new Error(`GitHub Pages output is missing ${route.route}.`);
  }
  const rootAssets = await stat(path.join(CLIENT, '_next', 'static'));
  if (!rootAssets.isDirectory()) {
    throw new Error('GitHub Pages output is missing root _next assets.');
  }
  try {
    await stat(path.join(CLIENT, 'nazca', '_next'));
    throw new Error(
      'GitHub Pages output still contains a nested nazca/_next directory.',
    );
  } catch (error) {
    if (!error || typeof error !== 'object' || error.code !== 'ENOENT')
      throw error;
  }
  const home = await readFile(path.join(CLIENT, 'index.html'), 'utf8');
  const sampleRoute = readerRoutes.find((entry) => entry.title === 'Nazca Railway (Los Sengas Division)')?.route ?? readerRoutes[0]?.route;
  const article = await readFile(path.join(CLIENT, `${sampleRoute.slice(1)}.html`), 'utf8');
  for (const [label, value] of [
    ['home asset prefix', home.includes('/nazca/_next/')],
    ['article asset prefix', article.includes('/nazca/_next/')],
    ['article home path', article.includes('href="/nazca"')],
    ['article title', article.includes(sampleRoute ? (readerRoutes.find((entry) => entry.route === sampleRoute)?.title ?? '') : '')],
    ['article current-snapshot marker', article.includes('current source snapshot')],
    [
      'Open Graph image',
      article.includes(
        'https://ding-ding-projects.github.io/nazca/social-preview.png',
      ),
    ],
  ]) {
    if (!value) throw new Error(`GitHub Pages output is missing ${label}.`);
  }
}

console.log(
  `Static bundle verified: ${files.length} files, ${bytes} bytes, mode=${pages ? 'pages' : 'sites'}.`,
);
