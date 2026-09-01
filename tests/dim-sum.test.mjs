import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowDimSumSurprise } from '../lib/dim-sum.ts';

test('suppresses the first launch and School mode', () => {
  assert.equal(
    shouldShowDimSumSurprise({
      hasSeen: false,
      schoolMode: false,
      randomUint32: 0,
    }),
    false,
  );
  assert.equal(
    shouldShowDimSumSurprise({
      hasSeen: true,
      schoolMode: true,
      randomUint32: 0,
    }),
    false,
  );
});

test('uses an exact ten percent threshold', () => {
  const justInside = Math.floor(0x1_0000_0000 * 0.1) - 1;
  const boundary = Math.ceil(0x1_0000_0000 * 0.1);
  assert.equal(
    shouldShowDimSumSurprise({
      hasSeen: true,
      schoolMode: false,
      randomUint32: justInside,
    }),
    true,
  );
  assert.equal(
    shouldShowDimSumSurprise({
      hasSeen: true,
      schoolMode: false,
      randomUint32: boundary,
    }),
    false,
  );
});
