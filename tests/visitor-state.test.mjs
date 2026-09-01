import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultVisitorState,
  parseVocabularyFile,
  visitorSettingsSchema,
  visitorStateSchema,
} from '../lib/visitor-state.ts';

test('default visitor state is strict and valid', () => {
  assert.deepEqual(
    visitorStateSchema.parse(defaultVisitorState),
    defaultVisitorState,
  );
  assert.equal(defaultVisitorState.settings.funnyLevelEnglish, 5);
  assert.equal(defaultVisitorState.settings.funnyLevelCantonese, 5);
  assert.equal(defaultVisitorState.settings.narrator.enabled, false);
});

test('unknown fields and out-of-range funny levels are rejected', () => {
  assert.equal(
    visitorSettingsSchema.safeParse({
      ...defaultVisitorState.settings,
      unexpected: true,
    }).success,
    false,
  );
  assert.equal(
    visitorSettingsSchema.safeParse({
      ...defaultVisitorState.settings,
      funnyLevelEnglish: 6,
    }).success,
    false,
  );
});

test('invalid schedule times are rejected', () => {
  const result = visitorSettingsSchema.safeParse({
    ...defaultVisitorState.settings,
    schedules: [
      {
        id: 'bad-time',
        label: 'Invalid',
        enabled: true,
        startTime: '25:00',
        endTime: '11:00',
        days: [1],
      },
    ],
  });
  assert.equal(result.success, false);
});

test('personal vocabulary validates bounded unique local entries', async () => {
  const file = new File(
    [
      JSON.stringify({
        schemaVersion: '1.0.0',
        entries: [{ from: 'Alpha', to: 'Beta' }],
      }),
    ],
    'vocabulary.json',
    { type: 'application/json' },
  );
  assert.deepEqual(await parseVocabularyFile(file), [
    { from: 'Alpha', to: 'Beta' },
  ]);
});

test('duplicate and unsafe personal vocabulary keys are rejected', async () => {
  const duplicate = new File(
    [
      JSON.stringify({
        schemaVersion: '1.0.0',
        entries: [
          { from: 'Alpha', to: 'Beta' },
          { from: 'Alpha', to: 'Gamma' },
        ],
      }),
    ],
    'duplicate.json',
  );
  await assert.rejects(
    parseVocabularyFile(duplicate),
    /Duplicate vocabulary key/,
  );

  const unsafe = new File(
    [
      JSON.stringify({
        schemaVersion: '1.0.0',
        entries: [{ from: '__proto__', to: 'No' }],
      }),
    ],
    'unsafe.json',
  );
  await assert.rejects(parseVocabularyFile(unsafe), /unsafe key/);
});

test('personal vocabulary rejects files above the hard byte limit', async () => {
  const oversized = new File(['x'.repeat(256 * 1024 + 1)], 'oversized.json');
  await assert.rejects(parseVocabularyFile(oversized), /256 KiB/);
});
