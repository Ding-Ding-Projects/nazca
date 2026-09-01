import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRegex,
  normalizeRegexFlags,
} from '../lib/search/regex-engine.ts';

function evaluate(overrides = {}) {
  return evaluateRegex({
    requestId: 1,
    pattern: 'Nazca',
    flags: 'i',
    values: ['Nazca Railway', 'Other line'],
    replacement: 'Atlas',
    ...overrides,
  });
}

test('normalizes supported flags and forces Unicode plus global matching', () => {
  assert.equal(normalizeRegexFlags('i'), 'giu');
  assert.throws(() => normalizeRegexFlags('d'), /Unsupported flag/);
});

test('matches Unicode text and reports record indexes', () => {
  const result = evaluate({
    pattern: '鐵路',
    flags: 'i',
    values: ['Nazca 鐵路', 'Bus'],
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.matchedValueIndexes, [0]);
  assert.equal(result.hits[0].match, '鐵路');
});

test('returns capture groups and a replacement preview', () => {
  const result = evaluate({
    pattern: '(Nazca) (Railway)',
    replacement: '$2, $1',
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.hits[0].captures, ['Nazca', 'Railway']);
  assert.equal(result.replacementPreview, 'Railway, Nazca');
});

test('reports unsupported backreferences without a JavaScript fallback', () => {
  const result = evaluate({ pattern: '(rail)\\1', values: ['railrail'] });
  assert.equal(result.valid, false);
  assert.match(result.unsupported, /does not support/i);
});

test('advances zero-width matches and respects the output bound', () => {
  const result = evaluate({
    pattern: '^',
    flags: 'm',
    values: ['a\nb\nc'],
    maxMatches: 2,
  });
  assert.equal(result.valid, true);
  assert.equal(result.hits.length, 2);
  assert.equal(result.truncated, true);
  assert.match(result.replacementPreview, /unavailable for zero-width/i);
});

test('rejects oversized patterns', () => {
  const result = evaluate({ pattern: 'a'.repeat(257) });
  assert.equal(result.valid, false);
  assert.match(result.error, /exceeds 256/);
});
