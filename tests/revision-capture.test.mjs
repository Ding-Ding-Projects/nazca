import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalJson,
  captureRevisionBundles,
  normalizeRevision,
  revisionBundleHash,
  revisionCaptureConstants,
} from '../scripts/import/revision-capture.mjs';

function revision(overrides = {}) {
  return {
    revid: 101,
    parentid: 100,
    timestamp: '2025-01-02T03:04:05Z',
    user: 'RailwayAuthor',
    userid: 42,
    comment: 'Update the station table',
    size: 37,
    sha1: '0123456789abcdef0123456789abcdef01234567',
    tags: ['visualeditor'],
    contentmodel: 'wikitext',
    contentformat: 'text/x-wiki',
    slots: { main: { '*': '== Station ==\nNazca' } },
    ...overrides,
  };
}

function page(pageid, revisions, overrides = {}) {
  return { pageid, title: `Page ${pageid}`, revisions, ...overrides };
}

void test('captures serial batches and continuation pages with complete revision provenance', async () => {
  const calls = [];
  const responses = [
    {
      query: {
        pages: [
          page(2, [revision({ revid: 202, parentid: 201 })]),
          page(1, [revision()]),
        ],
      },
      continue: { rvcontinue: 'next-page', continue: '-||' },
    },
    {
      query: {
        pages: [
          page(2, [
            revision({
              revid: 203,
              parentid: 202,
              timestamp: '2025-01-03T03:04:05Z',
            }),
          ]),
          page(1, [
            revision({
              revid: 102,
              parentid: 101,
              timestamp: '2025-01-03T03:04:05Z',
            }),
          ]),
        ],
      },
    },
  ];
  const result = await captureRevisionBundles({
    pageIds: [2, 1],
    batchSize: 2,
    source: {
      sourceUrl: 'https://enlossengas.fandom.com',
      cutoffAt: '2025-01-04T00:00:00Z',
    },
    request: async (params) => {
      calls.push(params);
      return responses[calls.length - 1];
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].pageids, '2|1');
  assert.equal(calls[0].rvdir, 'newer');
  assert.equal(calls[0].rvprop, revisionCaptureConstants.revisionProps);
  assert.equal(calls[1].rvcontinue, 'next-page');
  assert.deepEqual(result.pageIds, [2, 1]);
  assert.deepEqual(
    result.bundles.map((bundle) => bundle.pageId),
    [1, 2],
  );
  assert.deepEqual(
    result.bundles[0].revisions.map((item) => item.revisionId),
    [101, 102],
  );
  assert.deepEqual(
    result.bundles[1].revisions.map((item) => item.revisionId),
    [202, 203],
  );
  assert.equal(
    result.bundles[0].revisions[0].rawContent,
    '== Station ==\nNazca',
  );
  assert.equal(result.bundles[0].revisions[0].user, 'RailwayAuthor');
  assert.equal(result.bundles[0].revisions[0].userhidden, false);
  assert.equal(result.bundles[0].revisions[0].commenthidden, false);
  assert.equal(result.bundles[0].revisions[0].revid, 101);
  assert.equal(result.bundles[0].revisions[0].parentid, 100);
  assert.equal(result.bundles[0].revisions[0].userid, 42);
  assert.equal(result.cursor.nextBatchIndex, 1);
  assert.equal(result.cursor.partialPages.length, 0);
  assert.equal(result.captureSha256.length, 64);
  const { bundleSha256, ...bundleWithoutHash } = result.bundles[0];
  assert.equal(bundleSha256, revisionBundleHash(bundleWithoutHash));
});

void test('preserves suppressed fields and explicit deleted or missing page metadata', async () => {
  const hidden = normalizeRevision(
    revision({
      user: undefined,
      userhidden: '',
      comment: undefined,
      commenthidden: '',
      texthidden: '',
      slots: { main: {} },
    }),
  );
  assert.equal(hidden.user, null);
  assert.equal(hidden.userhidden, true);
  assert.equal(hidden.comment, null);
  assert.equal(hidden.commenthidden, true);
  assert.equal(hidden.contentSuppressed, true);
  assert.equal(hidden.rawContent, null);
  assert.equal(hidden.contentSha256, null);

  const result = await captureRevisionBundles({
    pageIds: [3, 4],
    request: async () => ({
      query: {
        pages: [page(3, [], { missing: true }), page(4, [], { deleted: true })],
      },
    }),
  });
  assert.deepEqual(
    result.bundles.map((bundle) => [bundle.pageId, bundle.pageStatus]),
    [
      [3, 'missing'],
      [4, 'deleted'],
    ],
  );
  assert.equal(result.bundles[0].missing, true);
  assert.equal(result.bundles[1].deleted, true);
});

void test('returns a resumable cursor after an injected request failure and keeps earlier bundles', async () => {
  let calls = 0;
  let failure;
  await assert.rejects(
    captureRevisionBundles({
      pageIds: [1, 2],
      batchSize: 1,
      request: async () => {
        calls += 1;
        if (calls === 2) throw new Error('temporary transport failure');
        return { query: { pages: [page(1, [revision()])] } };
      },
    }).catch((error) => {
      failure = error;
      throw error;
    }),
    /REQUEST_FAILED:1/,
  );
  assert.equal(failure.cursor.nextBatchIndex, 1);
  assert.equal(failure.cursor.bundleRecords.length, 1);
  assert.equal(failure.cursor.bundleRecords[0].pageId, 1);

  const resumed = await captureRevisionBundles({
    pageIds: [1, 2],
    batchSize: 1,
    resume: failure.cursor,
    request: async () => ({
      query: { pages: [page(2, [revision({ revid: 202 })])] },
    }),
  });
  assert.deepEqual(
    resumed.bundles.map((bundle) => bundle.pageId),
    [1, 2],
  );
});

void test('refuses continuation cycles and request limits with a resumable cursor', async () => {
  const cycle = {
    continue: { rvcontinue: 'same' },
    query: { pages: [page(1, [revision()])] },
  };
  let cycleError;
  await assert.rejects(
    captureRevisionBundles({
      pageIds: [1],
      request: async () => cycle,
    }).catch((error) => {
      cycleError = error;
      throw error;
    }),
    /CONTINUATION_CYCLE/,
  );
  assert.ok(cycleError.cursor);

  let limitError;
  await assert.rejects(
    captureRevisionBundles({
      pageIds: [1],
      maxRequests: 1,
      request: async () => ({
        continue: { rvcontinue: 'next' },
        query: { pages: [page(1, [revision()])] },
      }),
    }).catch((error) => {
      limitError = error;
      throw error;
    }),
    /REQUEST_LIMIT:1/,
  );
  assert.ok(limitError.cursor);
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
});
