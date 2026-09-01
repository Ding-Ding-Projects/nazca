#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pointerHeader = 'version https://git-lfs.github.com/spec/v1';
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const violations = [];

for (const relativePath of tracked) {
  if (relativePath === '.gitattributes') {
    const attributes = await readFile(path.join(ROOT, relativePath), 'utf8');
    if (/filter\s*=\s*lfs|filter=lfs/i.test(attributes)) {
      violations.push(`${relativePath}: standard Git LFS filter declaration`);
    }
  }
  const bytes = await readFile(path.join(ROOT, relativePath));
  const prefix = bytes.subarray(0, 256).toString('utf8');
  if (prefix.startsWith(pointerHeader))
    violations.push(`${relativePath}: standard Git LFS pointer`);
}

if (violations.length) {
  console.error(
    ['Standard Git LFS is forbidden in this repository:', ...violations].join(
      '\n',
    ),
  );
  process.exitCode = 1;
} else {
  console.log(
    `No standard Git LFS declarations or pointers in ${tracked.length} tracked files.`,
  );
}
