#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDED = new Set([
  '.bat',
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

function git(...arguments_) {
  return execFileSync('git', arguments_, { cwd: ROOT, encoding: 'utf8' });
}

function lineCount(text) {
  if (!text) return 0;
  return text.endsWith('\n')
    ? text.split(/\r\n|\n|\r/).length - 1
    : text.split(/\r\n|\n|\r/).length;
}

function category(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.startsWith('components/ui/')) return 'Generated scaffold';
  if (/(^|\/)(tests?|__tests__)(\/|$)|\.(test|spec)\./i.test(normalized))
    return 'Tests';
  if (normalized.endsWith('.md')) return 'Documentation';
  if (/\.(css|html)$/i.test(normalized)) return 'Styles and markup';
  if (
    /\.(json|ya?ml|toml)$/i.test(normalized) ||
    /(^|\/)(build|download-dependencies).*\.bat$/i.test(normalized)
  )
    return 'Configuration and build';
  return 'Source';
}

function blameAgentLines(relativePath) {
  try {
    const output = git('blame', '--line-porcelain', 'HEAD', '--', relativePath);
    const authors = output
      .split(/\r\n|\n|\r/)
      .filter((line) => line.startsWith('author '))
      .map((line) => line.slice('author '.length));
    return {
      agent: authors.filter((author) => author === 'Claude Fable 5').length,
      human: authors.filter((author) => author !== 'Claude Fable 5').length,
    };
  } catch {
    return { agent: 0, human: 0 };
  }
}

const tracked = git('ls-files', '-z')
  .split('\0')
  .filter(Boolean)
  .filter((relativePath) => relativePath !== 'package-lock.json')
  .filter((relativePath) =>
    INCLUDED.has(path.extname(relativePath).toLocaleLowerCase()),
  );

const rows = new Map();
let agentLines = 0;
let humanLines = 0;
for (const relativePath of tracked) {
  const text = await readFile(path.join(ROOT, relativePath), 'utf8');
  const bucket = category(relativePath);
  const current = rows.get(bucket) ?? { files: 0, lines: 0, nonblank: 0 };
  current.files += 1;
  current.lines += lineCount(text);
  current.nonblank += text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim()).length;
  rows.set(bucket, current);
  const blamed = blameAgentLines(relativePath);
  agentLines += blamed.agent;
  humanLines += blamed.human;
}

const ordered = [
  'Source',
  'Tests',
  'Styles and markup',
  'Configuration and build',
  'Documentation',
  'Generated scaffold',
].map((name) => ({
  name,
  ...(rows.get(name) ?? { files: 0, lines: 0, nonblank: 0 }),
}));
const projectRows = ordered.filter(
  (row) => !['Documentation', 'Generated scaffold'].includes(row.name),
);
const sum = (items, field) =>
  items.reduce((total, item) => total + item[field], 0);
const projectNonblank = sum(projectRows, 'nonblank');
const estimateLowHours = Math.ceil(projectNonblank / 30);
const estimateHighHours = Math.ceil(projectNonblank / 15);
const result = {
  commit: git('rev-parse', 'HEAD').trim(),
  categories: ordered,
  projectTotal: {
    lines: sum(projectRows, 'lines'),
    nonblank: projectNonblank,
  },
  grandTotal: {
    lines: sum(ordered, 'lines'),
    nonblank: sum(ordered, 'nonblank'),
  },
  attribution: {
    agent: agentLines,
    human: humanLines,
    rule: 'surviving git blame lines authored by Claude Fable 5 are agent lines',
  },
  humanEstimate: {
    lowHours: estimateLowHours,
    highHours: estimateHighHours,
    method:
      'project nonblank lines divided by 30 to 15 reviewed lines per hour',
  },
  exclusions: [
    'package-lock.json',
    'binary files',
    'dependencies',
    'build output',
  ],
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('| Category | Files | Lines | Nonblank |');
  console.log('|---|---:|---:|---:|');
  for (const row of ordered) {
    console.log(
      `| ${row.name} | ${row.files} | ${row.lines} | ${row.nonblank} |`,
    );
  }
  console.log(
    `\nProject total: ${result.projectTotal.lines} lines, ${result.projectTotal.nonblank} nonblank.`,
  );
  console.log(
    `Grand total: ${result.grandTotal.lines} lines, ${result.grandTotal.nonblank} nonblank.`,
  );
  console.log(
    `Attribution: ${agentLines} agent lines, ${humanLines} human lines.`,
  );
  console.log(
    `Human implementation estimate: ${estimateLowHours}-${estimateHighHours} hours.`,
  );
  console.log(`Method: ${result.humanEstimate.method}.`);
  console.log(`Excluded: ${result.exclusions.join(', ')}.`);
}
