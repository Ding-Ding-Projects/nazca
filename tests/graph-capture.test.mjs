import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureMediaWikiGraph,
  captureMediaWikiPage,
  extractWikitextReferences,
  normalizeFragment,
  normalizeMapRecord,
  normalizeRedirect,
  normalizeTitle,
  normalizeWikiTarget,
  titleToRoute,
} from '../scripts/import/graph-capture.mjs';

const SOURCE = {
  sourceHost: 'enlossengas.fandom.com',
  sourceUrl: 'https://enlossengas.fandom.com/wiki/Nazca_Railway',
  cutoffAt: '2026-09-01T00:00:00Z',
};

function basePage() {
  return {
    pageid: 101,
    title: 'Nazca_Railway',
    lastrevid: 42,
    revisions: [
      {
        revid: 42,
        parentid: 41,
        timestamp: '2026-08-31T23:59:00Z',
        user: 'Editor',
        comment: 'Keep the route history tidy',
        slots: {
          main: {
            content: `
== Main station ==
[[Foo Bar#Service history|service history]]
[[Missing Page]]
[[Category:Railways|Nazca]]
[[Category:Railways|Nazca]]
[[File:Route map.png|thumb|route map]]
[[Map:Network map#Stations]]
{{Template:Infobox railway}}
{{Map:Network map}}
{{#display_map:40.1, -73.2|zoom=10}}
<ref>https://example.org/source</ref>
[https://example.com/archive Archive]
https://example.net/raw
`,
          },
        },
      },
    ],
  };
}

function propertyResponse(prop, continuation) {
  const data = {
    categories: [{ title: 'Category:Railways' }],
    links: [{ title: 'Foo Bar' }, { title: 'Missing Page', missing: true }],
    templates: [{ title: 'Template:Infobox railway' }],
    images: [{ title: 'File:Route map.png' }],
    extlinks: [{ url: 'https://api.example.test/reference' }],
  };
  const continuationKeys = {
    categories: 'clcontinue',
    links: 'plcontinue',
    templates: 'tlcontinue',
    images: 'ilcontinue',
    externalLinks: 'elcontinue',
  };
  const key = continuationKeys[prop];
  if (!continuation) {
    return {
      query: {
        pages: [{ [prop === 'externalLinks' ? 'extlinks' : prop]: data[prop] }],
      },
      continue: {
        continue: '-||',
        [key]: `${prop}-page-2`,
        unrelated: 'must-not-leak',
      },
    };
  }
  return {
    query: { pages: [{ [prop === 'externalLinks' ? 'extlinks' : prop]: [] }] },
  };
}

void test('normalizes titles, routes, fragments, and namespace identities', () => {
  assert.equal(normalizeTitle('  nazca__railway  '), 'Nazca railway');
  assert.equal(normalizeFragment('#Service history'), 'Service_history');
  assert.equal(
    titleToRoute('Nazca Railway (Los Sengas Division)'),
    '/wiki/Nazca_Railway_(Los_Sengas_Division)',
  );
  assert.deepEqual(normalizeWikiTarget(' :Category:Railways#History '), {
    raw: ':Category:Railways#History',
    namespace: 'Category',
    title: 'Railways',
    normalizedTitle: 'Railways',
    fragment: 'History',
    anchor: 'History',
    route: '/wiki/Category:Railways#History',
    identity: 'Category:Railways#History',
  });
});

void test('extracts graph references without guessing citation semantics', () => {
  const graph = extractWikitextReferences(
    basePage().revisions[0].slots.main.content,
    {
      sourceTitle: 'Nazca Railway',
      sourceRevisionId: 42,
    },
  );
  assert.equal(graph.categories.length, 1);
  assert.equal(graph.categoryEdges[0].to, 'Railways');
  assert.equal(
    graph.internalLinks.find((item) => item.title === 'Foo Bar').fragment,
    'Service_history',
  );
  assert.equal(
    graph.redLinks.find((item) => item.title === 'Missing Page').redLink,
    false,
  );
  assert.equal(graph.imageUses[0].title, 'Route map.png');
  assert.equal(
    graph.transclusions.some((item) => item.title === 'Infobox railway'),
    true,
  );
  assert.equal(
    graph.mapReferences.some((item) => item.kind === 'inline-map'),
    true,
  );
  assert.equal(graph.citationLikeExternalLinks[0].context, 'ref-tag');
  assert.equal(graph.citationLikeExternalLinks[0].sourceRevisionId, 42);
  assert.equal(
    graph.externalLinks.some((item) => item.url === 'https://example.net/raw'),
    true,
  );
  assert.equal(graph.duplicateIdentities.categories.length, 1);
  assert.equal(graph.anchors[0].anchor, 'Main_station');
});

void test('captures injected API properties with independent continuation state and source revision links', async () => {
  const calls = [];
  const request = async (params) => {
    calls.push(params);
    if (params.prop === 'categories')
      return propertyResponse('categories', params.clcontinue);
    if (params.prop === 'links')
      return propertyResponse('links', params.plcontinue);
    if (params.prop === 'templates')
      return propertyResponse('templates', params.tlcontinue);
    if (params.prop === 'images')
      return propertyResponse('images', params.ilcontinue);
    if (params.prop === 'extlinks')
      return propertyResponse('externalLinks', params.elcontinue);
    throw new Error(`unexpected property ${params.prop}`);
  };
  const result = await captureMediaWikiPage({
    request,
    page: basePage(),
    source: SOURCE,
    knownTitles: new Set(['Nazca Railway', 'Foo Bar']),
    renderedHtml:
      '<h2 id="Main_station">Main station</h2><a href="/wiki/Foo_Bar#Service_history">history</a>',
  });
  assert.equal(result.page.sourceRevision.revisionId, 42);
  assert.equal(
    result.page.internalLinks.find((item) => item.title === 'Foo Bar')
      .sourceRevisionId,
    42,
  );
  assert.equal(
    result.page.internalLinks.find((item) => item.title === 'Missing Page')
      .redLink,
    true,
  );
  assert.equal(result.page.categories.includes('Railways'), true);
  assert.equal(result.page.imageUses[0].fileTitle, 'Route map.png');
  assert.equal(result.page.renderedLinks[0].fragment, 'Service_history');
  assert.equal(calls.filter((item) => item.prop === 'categories').length, 2);
  assert.equal(calls.filter((item) => item.prop === 'links').length, 2);
  const categoryContinuation = calls.find(
    (item) => item.prop === 'categories' && item.clcontinue,
  );
  const linkInitial = calls.find(
    (item) => item.prop === 'links' && !item.plcontinue,
  );
  assert.equal(categoryContinuation.clcontinue, 'categories-page-2');
  assert.equal('plcontinue' in categoryContinuation, false);
  assert.equal('clcontinue' in linkInitial, false);
});

void test('normalizes resolved and missing redirects without inventing target routes', () => {
  const resolved = normalizeRedirect(
    {
      pageid: 200,
      title: 'Old name',
      redirect: true,
      revisions: [
        {
          revid: 77,
          slots: { main: { content: '#REDIRECT [[New name#History]]' } },
        },
      ],
    },
    { knownTitles: new Set(['New name']), source: SOURCE },
  );
  assert.equal(resolved.state, 'resolved');
  assert.equal(resolved.targetRoute, '/wiki/New_name#History');
  assert.deepEqual(resolved.fragmentMap, { History: 'History' });
  const missing = normalizeRedirect(
    {
      pageid: 201,
      title: 'Broken name',
      redirect: true,
      revisions: [
        { revid: 78, slots: { main: { content: '#REDIRECT [[Gone name]]' } } },
      ],
    },
    { knownTitles: new Set(), source: SOURCE },
  );
  assert.equal(missing.state, 'missing-target');
  assert.equal('targetRoute' in missing, false);
});

void test('normalizes map payloads with bounds, references, and a textual equivalent', () => {
  const map = normalizeMapRecord(
    {
      pageid: 303,
      title: 'Nazca network map',
      payload: { version: 1, routes: ['A', 'B'] },
      bounds: [-73.4, 40.1, -73.0, 40.5],
      mediaId: 'file:network-map.svg',
      layers: [{ id: 'lines', label: 'Lines' }],
      markers: [{ id: 'station-a', label: 'Station A' }],
      deepLinks: ['/wiki/Station_A'],
      textualEquivalent:
        'Stations and lines are listed in the accompanying table.',
    },
    { source: SOURCE, sourceRevisionId: 88 },
  );
  assert.equal(map.recordType, 'MapRecordV1');
  assert.equal(map.title, 'Nazca network map');
  assert.equal(map.sourceRevisionId, undefined);
  assert.equal(map.source.sourceRevisionId, 88);
  assert.equal(map.sourcePayloadSha256.length, 64);
  assert.deepEqual(map.bounds, [-73.4, 40.1, -73.0, 40.5]);
  assert.equal(map.deepLinks[0], '/wiki/Station_A');
  assert.throws(
    () => normalizeMapRecord({ title: 'No bounds', payload: '{}' }),
    /MAP_BOUNDS_MISSING/,
  );
});

void test('graph capture deduplicates requested identities and reports missing pages', async () => {
  const request = async (params) => {
    if (!params.prop || params.prop === 'info|revisions') {
      return {
        query: {
          pages: [
            params.titles === 'Missing Page'
              ? { title: 'Missing Page', missing: true }
              : basePage(),
          ],
        },
      };
    }
    if (params.prop === 'categories')
      return { query: { pages: [{ categories: [] }] } };
    if (params.prop === 'links') return { query: { pages: [{ links: [] }] } };
    if (params.prop === 'templates')
      return { query: { pages: [{ templates: [] }] } };
    if (params.prop === 'images') return { query: { pages: [{ images: [] }] } };
    if (params.prop === 'extlinks')
      return { query: { pages: [{ extlinks: [] }] } };
    throw new Error('unexpected request');
  };
  const result = await captureMediaWikiGraph({
    request,
    titles: ['Nazca Railway', 'nazca_Railway', 'Missing Page'],
  });
  assert.equal(result.counts.requested, 3);
  assert.equal(result.counts.unique, 2);
  assert.equal(result.duplicateTitles.length, 1);
  assert.equal(result.pages.length, 1);
  assert.equal(result.missing.length, 1);
  assert.equal(result.graphSha256.length, 64);
});

void test('fails closed on continuation cycles and page bounds', async () => {
  const cycleRequest = async (params) => {
    if (params.prop === 'categories')
      return {
        query: { pages: [{ categories: [] }] },
        continue: { continue: '-||', clcontinue: 'same' },
      };
    return { query: { pages: [{ [params.prop]: [] }] } };
  };
  await assert.rejects(
    captureMediaWikiPage({
      request: cycleRequest,
      page: basePage(),
      limits: { maxPropertyPages: 3 },
    }),
    /CONTINUATION_CYCLE:categories/,
  );
  await assert.rejects(
    captureMediaWikiGraph({
      request: async () => ({ query: { pages: [] } }),
      titles: ['one', 'two'],
      limits: { maxPages: 1 },
    }),
    /PAGE_LIMIT:2/,
  );
});
