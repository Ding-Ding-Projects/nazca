#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = path.join(
  ROOT,
  'data',
  'inventories',
  'feature-coverage.json',
);
const REQUIRED_IDS = Array.from(
  { length: 30 },
  (_, index) => `F-${String(index + 1).padStart(3, '0')}`,
);
const REQUIRED_FIELDS = [
  'id',
  'feature',
  'route',
  'component',
  'localization',
  'persistence',
  'documentation',
  'focusedTest',
  'interactionProof',
  'captureEvidence',
  'negativeRegression',
  'state',
];

function validate(rows, release = false) {
  const problems = [];
  const ids = rows.map((row) => row.id);
  for (const id of REQUIRED_IDS) {
    if (!ids.includes(id)) problems.push(`missing required row ${id}`);
  }
  for (const id of new Set(ids)) {
    if (ids.filter((candidate) => candidate === id).length !== 1) {
      problems.push(`duplicate row ${id}`);
    }
  }
  for (const row of rows) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in row) || row[field] === '')
        problems.push(`${row.id}: missing ${field}`);
    }
    if (!['missing', 'partial', 'verified'].includes(row.state)) {
      problems.push(`${row.id}: invalid state ${row.state}`);
    }
    if (release) {
      if (row.state !== 'verified')
        problems.push(`${row.id}: release state is ${row.state}`);
      for (const field of [
        'component',
        'localization',
        'persistence',
        'focusedTest',
        'interactionProof',
        'captureEvidence',
        'negativeRegression',
      ]) {
        if (/\b(pending|missing)\b/i.test(String(row[field]))) {
          problems.push(`${row.id}: ${field} is not release evidence`);
        }
      }
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));
}

const document = JSON.parse(await readFile(INVENTORY, 'utf8'));
const rows = document.rows;
if (!Array.isArray(rows))
  throw new Error('Feature inventory rows must be an array.');

if (process.argv.includes('--self-test')) {
  let turnedRed = false;
  try {
    validate(rows.filter((row) => row.id !== REQUIRED_IDS[0]));
  } catch {
    turnedRed = true;
  }
  if (!turnedRed)
    throw new Error('Feature inventory negative self-test stayed green.');
  validate(rows);
  console.log(
    'Feature inventory negative self-test: red after removal, green after restore.',
  );
} else {
  const release = process.argv.includes('--release');
  validate(rows, release);
  const counts = Object.groupBy(rows, (row) => row.state);
  console.log(
    `Feature inventory verified: ${rows.length} rows, verified=${counts.verified?.length ?? 0}, partial=${counts.partial?.length ?? 0}, missing=${counts.missing?.length ?? 0}, mode=${release ? 'release' : 'development'}.`,
  );
}
