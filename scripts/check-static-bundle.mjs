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

if (pages) {
  const home = await readFile(path.join(CLIENT, 'index.html'), 'utf8');
  const article = await readFile(
    path.join(CLIENT, 'wiki', 'Nazca_Railway_(Los_Sengas_Division).html'),
    'utf8',
  );
  for (const [label, value] of [
    ['home asset prefix', home.includes('/nazca/_next/')],
    ['article asset prefix', article.includes('/nazca/_next/')],
    ['article home path', article.includes('href="/nazca"')],
    ['article title', article.includes('Nazca Railway')],
    ['article transport family', article.includes('Streetcars and light rail')],
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
