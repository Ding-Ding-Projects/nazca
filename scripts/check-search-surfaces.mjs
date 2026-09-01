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
  'search-surfaces.json',
);
const REQUIRED_IDS = Array.from(
  { length: 12 },
  (_, index) => `S-${String(index + 1).padStart(3, '0')}`,
);
const REQUIRED_FIELDS = [
  'id',
  'route',
  'owner',
  'scope',
  'fieldId',
  'builderId',
  'stateKey',
  'activationTarget',
  'focusReturnTarget',
  'plainTextDefault',
  'anchoredBuilder',
  'documentation',
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
  const stateKeys = new Set();
  for (const row of rows) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in row) || row[field] === '')
        problems.push(`${row.id}: missing ${field}`);
    }
    if (stateKeys.has(row.stateKey))
      problems.push(`${row.id}: duplicate stateKey ${row.stateKey}`);
    stateKeys.add(row.stateKey);
    if (row.plainTextDefault !== true)
      problems.push(`${row.id}: plain text must be the default`);
    if (!['missing', 'partial', 'verified'].includes(row.state)) {
      problems.push(`${row.id}: invalid state ${row.state}`);
    }
    if (release && (row.state !== 'verified' || row.anchoredBuilder !== true)) {
      problems.push(`${row.id}: search surface is not release-complete`);
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));
}

const document = JSON.parse(await readFile(INVENTORY, 'utf8'));
const rows = document.rows;
if (!Array.isArray(rows))
  throw new Error('Search inventory rows must be an array.');

if (process.argv.includes('--self-test')) {
  let turnedRed = false;
  try {
    validate(rows.filter((row) => row.id !== REQUIRED_IDS[0]));
  } catch {
    turnedRed = true;
  }
  if (!turnedRed)
    throw new Error('Search inventory negative self-test stayed green.');
  validate(rows);
  console.log(
    'Search inventory negative self-test: red after removal, green after restore.',
  );
} else {
  const release = process.argv.includes('--release');
  validate(rows, release);
  const complete = rows.filter((row) => row.state === 'verified').length;
  console.log(
    `Search inventory verified: ${rows.length} rows, verified=${complete}, incomplete=${rows.length - complete}, mode=${release ? 'release' : 'development'}.`,
  );
}
