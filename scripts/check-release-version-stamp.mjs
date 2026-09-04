#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const stamp = join(root, 'scripts', 'stamp-release-version.mjs');
const directory = await mkdtemp(join(tmpdir(), 'nazca-release-stamp-'));

try {
  const packagePath = join(directory, 'package.json');
  const lockPath = join(directory, 'package-lock.json');
  await writeFile(packagePath, `${JSON.stringify({ name: 'fixture', version: '0.1.2' })}\n`);
  await writeFile(
    lockPath,
    `${JSON.stringify({ name: 'fixture', version: '0.1.2', packages: { '': { name: 'fixture', version: '0.1.2' } } })}\n`,
  );
  execFileSync(
    process.execPath,
    [stamp, '--version', '0.1.777', '--package', packagePath, '--lock', lockPath],
    { stdio: 'inherit' },
  );
  execFileSync(
    process.execPath,
    [stamp, '--version', '0.1.777', '--package', packagePath, '--lock', lockPath, '--check'],
    { stdio: 'inherit' },
  );
  const packageValue = JSON.parse(await readFile(packagePath, 'utf8'));
  const lockValue = JSON.parse(await readFile(lockPath, 'utf8'));
  assert.equal(packageValue.version, '0.1.777');
  assert.equal(lockValue.version, '0.1.777');
  assert.equal(lockValue.packages[''].version, '0.1.777');
  const rejected = spawnSync(
    process.execPath,
    [stamp, '--version', '0.1.release', '--package', packagePath, '--lock', lockPath],
    { encoding: 'utf8' },
  );
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Release version must be numeric/);
  console.log('release version stamp focused check passed');
} finally {
  await rm(directory, { recursive: true, force: true });
}
