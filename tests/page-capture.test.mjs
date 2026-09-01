import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAGE_BATCH_LIMIT,
  PageCaptureError,
  buildPageQueryParams,
  capturePages,
} from '../scripts/import/page-capture.mjs';

function pageResponse(page, continuation) {
  return {
    query: { pages: [page] },
    ...(continuation ? { continue: continuation } : {}),
  };
}

void test('captures current namespace-0 page fields and parse output without network access', async () => {
  const calls = [];
  const sourcePage = {
    pageid: 42,
    ns: 0,
    title: 'Nazca Railway (Los Sengas Division)',
    normalized: 'Nazca Railway (Los Sengas Division)',
    displaytitle: 'Nazca Railway',
    lastrevid: 9001,
    contentmodel: 'wikitext',
    revisions: [
      {
        revid: 9001,
        parentid: 9000,
        timestamp: '2026-08-31T12:00:00Z',
        user: 'Author',
        comment: 'Source update',
        sha1: '0123456789abcdef0123456789abcdef01234567',
        contentmodel: 'wikitext',
        contentformat: 'text/x-wiki',
        slots: {
          main: {
            contentmodel: 'wikitext',
            contentformat: 'text/x-wiki',
            content: "'''Nazca Railway'''\n\n[[Station Alpha]]",
          },
        },
      },
    ],
    categories: [{ title: 'Category:Railways', sortkey: 'Nazca' }],
    links: [{ ns: 0, title: 'Station Alpha', exists: true }],
    templates: [{ ns: 10, title: 'Template:Infobox railway' }],
    images: [{ ns: 6, title: 'File:Nazca.png' }],
    extlinks: ['https://example.test/source'],
    langlinks: [{ lang: 'zh', title: '納斯卡鐵路', autonym: '中文' }],
  };
  const sourceParse = {
    parse: {
      title: sourcePage.title,
      pageid: sourcePage.pageid,
      displaytitle: 'Nazca Railway',
      text: { '*': '<h2 id="History">History</h2><p>...</p>' },
      categories: [{ category: 'Railways', sortkey: 'Nazca' }],
      links: [{ ns: 0, title: 'Station Alpha', exists: true }],
      templates: [{ ns: 10, title: 'Template:Infobox railway' }],
      images: [{ ns: 6, title: 'File:Nazca.png' }],
      externallinks: ['https://example.test/source'],
      sections: [{ anchor: 'History', level: 2, line: 'History', index: '1' }],
      langlinks: [{ lang: 'zh', title: '納斯卡鐵路', autonym: '中文' }],
    },
  };
  const result = await capturePages({
    titles: [sourcePage.title],
    request: async (context) => {
      calls.push(context);
      if (context.purpose === 'MediaWiki page query')
        return pageResponse(sourcePage);
      if (context.purpose === 'MediaWiki page parse') return sourceParse;
      throw new Error('Unexpected request');
    },
  });

  assert.deepEqual(result.counts, {
    requested: 1,
    captured: 1,
    missing: 0,
    failed: 0,
  });
  assert.equal(calls.length, 2);
  assert.equal(
    calls.some((call) => call.url.includes('robots')),
    false,
  );
  const record = result.records[0];
  assert.equal(record.pageId, 42);
  assert.equal(record.ns, 0);
  assert.equal(record.currentRevisionId, 9001);
  assert.equal(record.currentRevision.user, 'Author');
  assert.equal(record.currentRevision.comment, 'Source update');
  assert.equal(record.rawWikitext, "'''Nazca Railway'''\n\n[[Station Alpha]]");
  assert.match(record.renderedHtml, /History/);
  assert.deepEqual(record.sections, sourceParse.parse.sections);
  assert.deepEqual(record.languageLinks, sourceParse.parse.langlinks);
  assert.equal(record.route, '/wiki/Nazca_Railway_(Los_Sengas_Division)');
  assert.deepEqual(record.sourcePage, sourcePage);
  assert.deepEqual(record.sourceRevision, sourcePage.revisions[0]);
  assert.deepEqual(record.sourceParse, sourceParse.parse);
});

void test('batches bounded title requests and preserves strict missing-page records', async () => {
  const requested = [];
  const result = await capturePages({
    titles: ['One', 'Two', 'Missing'],
    batchSize: 2,
    strict: false,
    parse: false,
    request: async ({ purpose, params }) => {
      if (purpose !== 'MediaWiki page query') throw new Error('parse disabled');
      requested.push(params.titles);
      const titles = params.titles.split('|');
      const pages = titles
        .filter((title) => title !== 'Missing')
        .map((title, index) => ({
          pageid: index + 1,
          ns: 0,
          title,
          revisions: [
            {
              revid: index + 10,
              timestamp: '2026-08-31T12:00:00Z',
              sha1: '0123456789abcdef0123456789abcdef01234567',
              content: title,
            },
          ],
        }));
      return { query: { pages } };
    },
  });

  assert.deepEqual(requested, ['One|Two', 'Missing']);
  assert.deepEqual(result.counts, {
    requested: 3,
    captured: 2,
    missing: 1,
    failed: 0,
  });
  const missing = result.records.find((record) => record.missing);
  assert.equal(missing.requested.title, 'Missing');
  assert.equal(missing.error.code, 'MISSING_PAGE');
  await assert.rejects(
    capturePages({
      titles: ['Missing'],
      request: async () => ({ query: { pages: [] } }),
    }),
    (error) =>
      error instanceof PageCaptureError &&
      error.code === 'PAGE_CAPTURE_INCOMPLETE',
  );
});

void test('detects repeated continuation tokens and rejects invalid batch bounds', async () => {
  let calls = 0;
  await assert.rejects(
    capturePages({
      titles: ['Loop'],
      request: async () => {
        calls += 1;
        return pageResponse(
          {
            pageid: 1,
            ns: 0,
            title: 'Loop',
            revisions: [
              {
                revid: 1,
                timestamp: '2026-08-31T12:00:00Z',
                sha1: '0123456789abcdef0123456789abcdef01234567',
                content: 'x',
              },
            ],
          },
          { continue: '-||', gapcontinue: 'same' },
        );
      },
    }),
    (error) =>
      error instanceof PageCaptureError &&
      error.code === 'PAGE_CAPTURE_INCOMPLETE',
  );
  assert.equal(calls, 2);
  assert.throws(
    () =>
      buildPageQueryParams(
        Array.from({ length: PAGE_BATCH_LIMIT + 1 }, (_, index) => ({
          title: String(index),
        })),
      ),
    (error) =>
      error instanceof PageCaptureError && error.code === 'INVALID_BATCH_SIZE',
  );
});

void test('rejects non-namespace-0 responses instead of guessing a destination', async () => {
  const result = await capturePages({
    titles: ['Template:Nope'],
    strict: false,
    request: async ({ purpose }) => {
      if (purpose === 'MediaWiki page query')
        return pageResponse({ pageid: 9, ns: 10, title: 'Template:Nope' });
      throw new Error('must not parse wrong namespace');
    },
  });
  assert.equal(result.counts.failed, 1);
  assert.equal(result.records[0].error.code, 'WRONG_NAMESPACE');
  assert.equal(result.records[0].route, undefined);
});
