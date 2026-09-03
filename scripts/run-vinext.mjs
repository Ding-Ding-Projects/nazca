#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VINEXT = path.join(ROOT, 'node_modules', 'vinext', 'dist', 'cli.js');
const SEARCH_INDEX_SOURCE = path.join(ROOT, 'data', 'corpus', 'reader', 'v0.1.0', 'search-index.json');
const command = process.argv[2] ?? 'build';
const pages = process.argv.includes('--pages');
const staticOnly = process.argv.includes('--static');
const staticExport = pages || staticOnly;
const forwarded = process.argv
  .slice(3)
  .filter((argument) => argument !== '--pages' && argument !== '--static');

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'check-current-corpus.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});

function git(...arguments_) {
  try {
    return execFileSync('git', arguments_, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

async function writeProvenance() {
  const packageJson = JSON.parse(
    await readFile(path.join(ROOT, 'package.json'), 'utf8'),
  );
  const builtAt = process.env.BUILD_TIMESTAMP || new Date().toISOString();
  const commitSha =
    process.env.BUILD_COMMIT_SHA || git('rev-parse', 'HEAD') || null;
  const dirty = git('status', '--porcelain').length > 0;
  const provenance = {
    schemaVersion: '1.0.0',
    version: packageJson.version,
    builtAt,
    timezone: 'UTC',
    commitSha,
    dirty,
    deployment: pages
      ? 'github-pages-mirror'
      : staticOnly
        ? 'offline-static-bundle'
        : 'sites-primary-candidate',
  };
  await mkdir(path.join(ROOT, 'public'), { recursive: true });
  await writeFile(
    path.join(ROOT, 'public', 'provenance.json'),
    `${JSON.stringify(provenance, null, 2)}\n`,
    'utf8',
  );
  return provenance;
}

async function readBundledAsset() {
  const manifest = JSON.parse(
    await readFile(path.join(ROOT, 'dependency-manifest.json'), 'utf8'),
  );
  const source = path.join(ROOT, manifest.re2Wasm.packagePath);
  const bytes = await readFile(source);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== manifest.re2Wasm.sha256) {
    throw new Error(
      `re2.wasm digest mismatch. Expected ${manifest.re2Wasm.sha256}; received ${digest}.`,
    );
  }
  console.log(
    `[bundled-asset] re2-wasm=${manifest.re2Wasm.version} bytes=${bytes.byteLength} sha256=${digest}`,
  );
  return { fileName: manifest.re2Wasm.runtimeFileName, source };
}

async function findWorkerDirectories(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory())
      output.push(...(await findWorkerDirectories(target)));
    else if (entry.isFile() && /^regex-worker-.*\.js$/i.test(entry.name))
      output.push(directory);
  }
  return output;
}

async function stageBuiltAsset(asset) {
  const directories = [
    ...new Set(await findWorkerDirectories(path.join(ROOT, 'dist', 'client'))),
  ];
  if (!directories.length)
    throw new Error('The build emitted no regex worker directory.');
  for (const directory of directories) {
    await copyFile(asset.source, path.join(directory, asset.fileName));
  }
  console.log(
    `[bundled-asset] staged ${asset.fileName} beside ${directories.length} worker output(s)`,
  );
}

async function stageSearchIndex() {
  const sourceBytes = await readFile(SEARCH_INDEX_SOURCE);
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  const target = path.join(ROOT, 'dist', 'client', 'search-index.json');
  await copyFile(SEARCH_INDEX_SOURCE, target);
  const targetBytes = await readFile(target);
  const targetDigest = createHash('sha256').update(targetBytes).digest('hex');
  if (sourceBytes.byteLength !== targetBytes.byteLength || digest !== targetDigest)
    throw new Error('The staged search index does not match the tracked source.');
  console.log(
    `[search-index] staged search-index.json bytes=${targetBytes.byteLength} sha256=${targetDigest}`,
  );
}

async function normalizePagesOutput() {
  const client = path.join(ROOT, 'dist', 'client');
  const nestedRoot = path.join(client, 'nazca');
  const nestedAssets = path.join(nestedRoot, '_next');
  const targetAssets = path.join(client, '_next');
  try {
    await rename(nestedAssets, targetAssets);
    await rm(nestedRoot, { recursive: true, force: true });
  } catch (error) {
    throw new Error(
      `Could not normalize GitHub Pages assets from ${nestedAssets} to ${targetAssets}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  console.log('[pages] normalized artifact assets from nazca/_next to _next');
}

const bundledAsset = await readBundledAsset();
const provenance = await writeProvenance();
console.log(
  `[provenance] version=${provenance.version} commit=${provenance.commitSha ?? 'unavailable'} builtAt=${provenance.builtAt} dirty=${provenance.dirty}`,
);

const result = await new Promise((resolve) => {
  const child = spawn(process.execPath, [VINEXT, command, ...forwarded], {
    cwd: ROOT,
    env: {
      ...process.env,
      NEXT_PUBLIC_BUILD_VERSION: provenance.version,
      NEXT_PUBLIC_BUILD_TIMESTAMP: provenance.builtAt,
      NEXT_PUBLIC_BUILD_COMMIT_SHA: provenance.commitSha ?? '',
      NEXT_PUBLIC_BUILD_DIRTY: String(provenance.dirty),
      NEXT_PUBLIC_BUILD_DEPLOYMENT: provenance.deployment,
      ...(staticExport ? { STATIC_EXPORT: '1' } : {}),
      ...(pages
        ? {
            PAGES_BASE_PATH: '/nazca',
            NEXT_PUBLIC_BASE_PATH: '/nazca',
          }
        : {}),
    },
    stdio: 'inherit',
  });
  child.on('error', (error) => resolve({ code: 1, error }));
  child.on('exit', (code, signal) => resolve({ code: code ?? 1, signal }));
});

if (result.error) console.error(`[vinext] ${result.error.message}`);
if (result.signal)
  console.error(`[vinext] terminated by signal ${result.signal}`);
if (result.code === 0 && command === 'build') {
  if (pages) await normalizePagesOutput();
  await stageBuiltAsset(bundledAsset);
  await stageSearchIndex();
}
process.exitCode = result.code;
