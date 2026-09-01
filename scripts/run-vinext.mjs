#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VINEXT = path.join(ROOT, 'node_modules', 'vinext', 'dist', 'cli.js');
const command = process.argv[2] ?? 'build';
const pages = process.argv.includes('--pages');
const staticOnly = process.argv.includes('--static');
const staticExport = pages || staticOnly;
const forwarded = process.argv
  .slice(3)
  .filter((argument) => argument !== '--pages' && argument !== '--static');

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

const provenance = await writeProvenance();
console.log(
  `[provenance] version=${provenance.version} commit=${provenance.commitSha ?? 'unavailable'} builtAt=${provenance.builtAt} dirty=${provenance.dirty}`,
);

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

child.on('error', (error) => {
  console.error(`[vinext] ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[vinext] terminated by signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
