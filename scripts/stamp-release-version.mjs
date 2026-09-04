#!/usr/bin/env node

import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

function usage(message) {
  if (message) console.error(message);
  console.error(
    'Usage: node scripts/stamp-release-version.mjs --version <major.minor.patch> [--package <path>]... [--lock <path>]... [--check]',
  );
  process.exitCode = 2;
}

function parseArguments(argv) {
  const options = { packages: [], locks: [], check: false, version: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      options.check = true;
      continue;
    }
    if (argument === '--version' || argument === '--package' || argument === '--lock') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) return null;
      index += 1;
      if (argument === '--version') options.version = value;
      if (argument === '--package') options.packages.push(value);
      if (argument === '--lock') options.locks.push(value);
      continue;
    }
    return null;
  }
  return options;
}

function assertVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Release version must be numeric major.minor.patch, received ${version ?? 'missing'}.`);
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeJsonAtomically(path, value) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}

function assertPackageShape(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string') {
    throw new Error(`${path} is not a package manifest with a package name.`);
  }
}

function assertLockShape(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string') {
    throw new Error(`${path} is not an npm lockfile with a root package name.`);
  }
  if (!value.packages || typeof value.packages !== 'object' || Array.isArray(value.packages) || !value.packages['']) {
    throw new Error(`${path} does not contain the root package lock entry.`);
  }
}

async function stampPackage(path, version, check) {
  const value = await readJson(path);
  assertPackageShape(value, path);
  if (check) {
    if (value.version !== version) throw new Error(`${path} has ${value.version ?? 'no version'}, expected ${version}.`);
    return;
  }
  value.version = version;
  await writeJsonAtomically(path, value);
}

async function stampLock(path, version, check) {
  const value = await readJson(path);
  assertLockShape(value, path);
  if (check) {
    if (value.version !== version || value.packages[''].version !== version) {
      throw new Error(`${path} root version fields must both equal ${version}.`);
    }
    return;
  }
  value.version = version;
  value.packages[''].version = version;
  await writeJsonAtomically(path, value);
}

const options = parseArguments(process.argv.slice(2));
if (!options || !options.version || options.packages.length === 0 || options.locks.length === 0) {
  usage('A version plus at least one package and lock path are required.');
} else {
  try {
    assertVersion(options.version);
    const root = process.cwd();
    const packagePaths = options.packages.map((path) => resolve(root, path));
    const lockPaths = options.locks.map((path) => resolve(root, path));
    for (const path of packagePaths) await stampPackage(path, options.version, options.check);
    for (const path of lockPaths) await stampLock(path, options.version, options.check);
    const mode = options.check ? 'Verified' : 'Stamped';
    console.log(`${mode} ${packagePaths.length} package manifest(s) and ${lockPaths.length} lockfile(s) at ${options.version}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
