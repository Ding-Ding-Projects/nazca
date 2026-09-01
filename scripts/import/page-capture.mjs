#!/usr/bin/env node

import { createHash } from 'node:crypto';

/**
 * Bounded MediaWiki page capture.
 *
 * The caller supplies request(), so this module is also usable by an importer
 * with a response cache or by a test without network access. request() receives
 * { url, params, purpose } and must return parsed JSON, or { json, response }.
 * This module never requests robots.txt and never invents a destination for a
 * missing source page or link.
 */

export const PAGE_BATCH_LIMIT = 50;
export const PAGE_CONTINUATION_LIMIT = 10_000;
export const PAGE_RECORD_TYPE = 'PageCaptureRecordV1';
export const PAGE_SCHEMA_VERSION = '1.0.0';

const DEFAULT_API_URL = 'https://enlossengas.fandom.com/api.php';

export class PageCaptureError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PageCaptureError';
    this.code = code;
    this.details = details;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function titleRoute(title) {
  if (typeof title !== 'string' || title.trim() === '') return null;
  const normalized = title.trim().replaceAll(' ', '_');
  return `/wiki/${encodeURIComponent(normalized)}`;
}

function normalizeTarget(target, index) {
  if (typeof target === 'number' && Number.isInteger(target) && target > 0)
    return { key: `pageid:${target}`, pageid: target, requestedIndex: index };
  if (typeof target === 'string' && target.trim()) {
    const title = target.trim();
    return { key: `title:${title}`, title, requestedIndex: index };
  }
  if (isRecord(target)) {
    const pageid = Number(target.pageid ?? target.pageId);
    const title = typeof target.title === 'string' ? target.title.trim() : '';
    if (Number.isInteger(pageid) && pageid > 0)
      return {
        key: `pageid:${pageid}`,
        pageid,
        title: title || undefined,
        requestedRoute:
          typeof target.route === 'string' ? target.route : undefined,
        requestedIndex: index,
      };
    if (title)
      return {
        key: `title:${title}`,
        title,
        requestedRoute:
          typeof target.route === 'string' ? target.route : undefined,
        requestedIndex: index,
      };
  }
  throw new PageCaptureError(
    'INVALID_TARGET',
    `Target at index ${index} must be a positive page id, a non-empty title, or an object with pageid/title.`,
    { index, target },
  );
}

export function normalizeTargets({ targets, titles, pageIds } = {}) {
  const source = targets ?? [
    ...(Array.isArray(pageIds) ? pageIds : []),
    ...(Array.isArray(titles) ? titles : []),
  ];
  if (!Array.isArray(source))
    throw new PageCaptureError(
      'INVALID_TARGETS',
      'targets, titles, or pageIds must be arrays.',
    );
  const unique = new Map();
  source.forEach((target, index) => {
    const normalized = normalizeTarget(target, index);
    if (!unique.has(normalized.key)) unique.set(normalized.key, normalized);
  });
  return [...unique.values()];
}

export function buildPageQueryParams(targets, continuation = {}) {
  if (
    !Array.isArray(targets) ||
    targets.length === 0 ||
    targets.length > PAGE_BATCH_LIMIT
  )
    throw new PageCaptureError(
      'INVALID_BATCH_SIZE',
      `A page query batch must contain 1-${PAGE_BATCH_LIMIT} targets.`,
      { count: targets?.length ?? 0, limit: PAGE_BATCH_LIMIT },
    );

  const pageIds = targets
    .filter((target) => target.pageid)
    .map((target) => target.pageid);
  const titles = targets
    .filter((target) => !target.pageid)
    .map((target) => target.title);
  if (pageIds.length && titles.length)
    throw new PageCaptureError(
      'MIXED_BATCH',
      'A MediaWiki page query cannot mix page ids and titles.',
    );
  return {
    action: 'query',
    prop: 'info|revisions|categories|links|templates|images|extlinks|langlinks',
    inprop: 'displaytitle',
    rvprop:
      'ids|timestamp|sha1|user|comment|contentmodel|content|roles|parsetree',
    rvslots: 'main',
    rvlimit: '1',
    clprop: 'sortkey|timestamp',
    cllimit: 'max',
    plnamespace: '0',
    pllimit: 'max',
    tlnamespace: '10|828|0',
    tllimit: 'max',
    imlimit: 'max',
    ellimit: 'max',
    lllimit: 'max',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
    ...(pageIds.length
      ? { pageids: pageIds.join('|') }
      : { titles: titles.join('|') }),
    ...continuation,
  };
}

export function buildParseParams(page) {
  const pageid = Number(page?.pageid);
  if (!Number.isInteger(pageid) || pageid <= 0)
    throw new PageCaptureError(
      'INVALID_PAGE',
      'A parse request needs a positive source page id.',
      { page },
    );
  return {
    action: 'parse',
    pageid: String(pageid),
    prop: 'text|displaytitle|categories|links|templates|images|externallinks|sections|langlinks',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
  };
}

function unwrapResponse(value) {
  if (isRecord(value) && 'json' in value) return value.json;
  return value;
}

async function invokeRequest(request, params, purpose, apiUrl) {
  if (typeof request !== 'function')
    throw new PageCaptureError(
      'MISSING_REQUEST',
      'capturePages requires an injected request function.',
    );
  const url = new URL(apiUrl);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  let result;
  try {
    result = await request({
      url: url.toString(),
      params: { ...params },
      purpose,
    });
  } catch (error) {
    throw new PageCaptureError(
      'REQUEST_FAILED',
      error instanceof Error ? error.message : String(error),
      {
        cause: error,
        url: url.toString(),
        purpose,
        params,
      },
    );
  }
  const json = unwrapResponse(result);
  if (!isRecord(json))
    throw new PageCaptureError(
      'INVALID_RESPONSE',
      'Injected request returned a non-object JSON value.',
      {
        url: url.toString(),
        purpose,
      },
    );
  if (json.error)
    throw new PageCaptureError(
      `MEDIAWIKI_API:${json.error.code ?? 'unknown'}`,
      'MediaWiki returned an error.',
      {
        url: url.toString(),
        purpose,
        error: json.error,
      },
    );
  return { json, url: url.toString() };
}

function continuationToken(continuation) {
  return canonicalJson(continuation ?? null);
}

async function queryBatch(targets, options) {
  const { request, apiUrl, maxContinuationPages } = options;
  const pages = [];
  const receipts = [];
  const seen = new Set();
  let continuation = null;
  let requestCount = 0;
  while (true) {
    if (requestCount >= maxContinuationPages)
      throw new PageCaptureError(
        'CONTINUATION_LIMIT',
        'MediaWiki continuation page limit exceeded.',
        {
          limit: maxContinuationPages,
          targets,
        },
      );
    const token = continuationToken(continuation);
    if (seen.has(token))
      throw new PageCaptureError(
        'CONTINUATION_CYCLE',
        'MediaWiki returned a repeated continuation token.',
        {
          token,
          targets,
        },
      );
    seen.add(token);
    const params = buildPageQueryParams(targets, continuation ?? {});
    const response = await invokeRequest(
      request,
      params,
      'MediaWiki page query',
      apiUrl,
    );
    requestCount += 1;
    const batchPages = response.json.query?.pages;
    if (!Array.isArray(batchPages))
      throw new PageCaptureError(
        'MISSING_PAGES',
        'MediaWiki response did not include query.pages.',
        {
          url: response.url,
          targets,
        },
      );
    pages.push(...batchPages);
    receipts.push({
      url: response.url,
      continuation: continuation ?? {},
      count: batchPages.length,
    });
    continuation = response.json.continue
      ? { ...response.json.continue }
      : null;
    if (!continuation) break;
  }
  return { pages, receipts };
}

function currentRevision(page) {
  const revision = Array.isArray(page?.revisions) ? page.revisions[0] : null;
  const slot = revision?.slots?.main ?? null;
  const rawWikitext =
    slot?.content ?? slot?.['*'] ?? revision?.content ?? revision?.['*'] ?? '';
  return {
    source: revision,
    id:
      Number(revision?.revid ?? revision?.revisionid ?? page?.lastrevid) ||
      null,
    parentId: Number(revision?.parentid) || undefined,
    timestamp: revision?.timestamp ?? null,
    sha1: revision?.sha1 ?? null,
    user: revision?.user ?? null,
    comment: revision?.comment ?? '',
    contentModel:
      slot?.contentmodel ??
      revision?.contentmodel ??
      page?.contentmodel ??
      null,
    contentFormat: slot?.contentformat ?? revision?.contentformat ?? null,
    rawWikitext,
  };
}

function valuesFromParse(parse, queryPage, key) {
  const parsed = parse?.[key];
  if (Array.isArray(parsed)) return parsed;
  const queried = queryPage?.[key];
  return Array.isArray(queried) ? queried : [];
}

function textFromParse(parse) {
  const text = parse?.text;
  if (typeof text === 'string') return text;
  if (isRecord(text)) return text['*'] ?? text.value ?? '';
  return '';
}

function pageRecord(
  page,
  parse,
  target,
  sourceQueryUrl,
  sourceParseUrl,
  capturedAt,
) {
  const revision = currentRevision(page);
  const title = page.title ?? target.title ?? '';
  const route = target.requestedRoute ?? titleRoute(title);
  const renderedHtml = textFromParse(parse);
  const categories = valuesFromParse(parse, page, 'categories');
  const links = valuesFromParse(parse, page, 'links');
  const templates = valuesFromParse(parse, page, 'templates');
  const images = valuesFromParse(parse, page, 'images');
  const externalLinks = valuesFromParse(parse, page, 'externallinks');
  const languageLinks = valuesFromParse(parse, page, 'langlinks');
  const sections = valuesFromParse(parse, page, 'sections');
  return {
    recordType: PAGE_RECORD_TYPE,
    schemaVersion: PAGE_SCHEMA_VERSION,
    id: `fandom-page:${page.pageid}`,
    capturedAt,
    pageId: Number(page.pageid),
    ns: Number(page.ns),
    title,
    normalizedTitle: page.normalized ?? title,
    route,
    displayTitle: parse?.displaytitle ?? page.displaytitle ?? title,
    missing: false,
    currentRevisionId: revision.id,
    currentRevision: revision,
    sourceRevision: revision.source,
    rawWikitext: revision.rawWikitext,
    renderedHtml,
    categories,
    links,
    templates,
    images,
    externalLinks,
    languageLinks,
    sections,
    sourcePage: page,
    sourceParse: parse ?? null,
    sourceQueryUrl,
    sourceParseUrl,
    sourceRevisionSha256: revision.rawWikitext
      ? sha256(revision.rawWikitext)
      : null,
  };
}

function missingRecord(target, reason, capturedAt) {
  return {
    recordType: PAGE_RECORD_TYPE,
    schemaVersion: PAGE_SCHEMA_VERSION,
    id: `missing:${target.key}`,
    capturedAt,
    missing: true,
    requested: target,
    error: {
      code: 'MISSING_PAGE',
      reason,
    },
  };
}

function errorRecord(target, error, phase, capturedAt) {
  return {
    recordType: PAGE_RECORD_TYPE,
    schemaVersion: PAGE_SCHEMA_VERSION,
    id: `error:${target?.key ?? phase}:${capturedAt}`,
    capturedAt,
    missing: false,
    requested: target ?? null,
    error: {
      code: error?.code ?? 'CAPTURE_FAILED',
      message: error instanceof Error ? error.message : String(error),
      phase,
      details: error?.details ?? null,
    },
  };
}

function requestedPageMatches(page, target) {
  if (target.pageid) return Number(page.pageid) === target.pageid;
  return page.title === target.title || page.normalized === target.title;
}

/**
 * Capture current namespace-0 pages in bounded API batches.
 *
 * Missing pages, parse errors, and query errors are retained in records and
 * errors. With strict=true an Aggregate PageCaptureError is thrown after the
 * complete bounded attempt, so callers cannot silently publish a partial corpus.
 */
export async function capturePages({
  request,
  apiUrl = DEFAULT_API_URL,
  targets,
  titles,
  pageIds,
  batchSize = PAGE_BATCH_LIMIT,
  maxContinuationPages = PAGE_CONTINUATION_LIMIT,
  strict = true,
  parse = true,
  capturedAt = new Date().toISOString(),
} = {}) {
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > PAGE_BATCH_LIMIT
  )
    throw new PageCaptureError(
      'INVALID_BATCH_SIZE',
      `batchSize must be between 1 and ${PAGE_BATCH_LIMIT}.`,
      {
        batchSize,
        limit: PAGE_BATCH_LIMIT,
      },
    );
  if (!Number.isInteger(maxContinuationPages) || maxContinuationPages < 1)
    throw new PageCaptureError(
      'INVALID_CONTINUATION_LIMIT',
      'maxContinuationPages must be a positive integer.',
    );
  const normalizedTargets = normalizeTargets({ targets, titles, pageIds });
  const records = [];
  const errors = [];
  const requestReceipts = [];
  for (let offset = 0; offset < normalizedTargets.length; offset += batchSize) {
    const batch = normalizedTargets.slice(offset, offset + batchSize);
    const queryTargets = batch.map((target) =>
      target.pageid ? target : { title: target.title },
    );
    let queried;
    try {
      queried = await queryBatch(queryTargets, {
        request,
        apiUrl,
        maxContinuationPages,
      });
      requestReceipts.push(...queried.receipts);
    } catch (error) {
      const record = errorRecord(null, error, 'query', capturedAt);
      records.push(record);
      errors.push(record.error);
      continue;
    }
    for (const target of batch) {
      const page = queried.pages.find((candidate) =>
        requestedPageMatches(candidate, target),
      );
      if (!page || page.missing) {
        const record = missingRecord(
          target,
          page?.reason ?? 'MediaWiki returned no matching current page.',
          capturedAt,
        );
        records.push(record);
        errors.push(record.error);
        continue;
      }
      if (Number(page.ns) !== 0) {
        const record = errorRecord(
          target,
          new PageCaptureError(
            'WRONG_NAMESPACE',
            'Requested page was not in namespace 0.',
            { ns: page.ns },
          ),
          'query',
          capturedAt,
        );
        records.push(record);
        errors.push(record.error);
        continue;
      }
      if (!parse) {
        records.push(
          pageRecord(
            page,
            null,
            target,
            queried.receipts[0]?.url ?? null,
            null,
            capturedAt,
          ),
        );
        continue;
      }
      try {
        const params = buildParseParams(page);
        const parsed = await invokeRequest(
          request,
          params,
          'MediaWiki page parse',
          apiUrl,
        );
        records.push(
          pageRecord(
            page,
            parsed.json.parse ?? parsed.json,
            target,
            queried.receipts[0]?.url ?? null,
            parsed.url,
            capturedAt,
          ),
        );
        requestReceipts.push({
          url: parsed.url,
          pageid: page.pageid,
          phase: 'parse',
        });
      } catch (error) {
        const record = errorRecord(target, error, 'parse', capturedAt);
        records.push(record);
        errors.push(record.error);
      }
    }
  }
  const result = {
    recordType: 'PageCaptureSetV1',
    schemaVersion: PAGE_SCHEMA_VERSION,
    capturedAt,
    apiUrl,
    namespace: 0,
    batchSize,
    requestedCount: normalizedTargets.length,
    records,
    errors,
    requestReceipts,
    counts: {
      requested: normalizedTargets.length,
      captured: records.filter((record) => !record.missing && !record.error)
        .length,
      missing: records.filter((record) => record.missing).length,
      failed: records.filter((record) => record.error && !record.missing)
        .length,
    },
  };
  if (strict && errors.length) {
    throw new PageCaptureError(
      'PAGE_CAPTURE_INCOMPLETE',
      'Page capture produced missing pages or errors.',
      result,
    );
  }
  return result;
}

export default capturePages;
