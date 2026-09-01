import { createHash } from 'node:crypto';

const SCHEMA_VERSION = '1.0.0';
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_BATCHES = 10_000;
const DEFAULT_MAX_REQUESTS = 100_000;
const DEFAULT_MAX_REVISIONS = 1_000_000;
const DEFAULT_MAX_CONTENT_BYTES = 16 * 1024 * 1024;

const REVISION_PROPS =
  'ids|flags|timestamp|user|userid|size|sha1|contentmodel|comment|tags|content';

/** Return a stable JSON representation for hashes and resume records. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function stringOrNull(value) {
  return typeof value === 'string' ? value : null;
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function booleanFlag(value, present) {
  if (value === false || value === null || value === 0 || value === '0')
    return false;
  return Boolean(present || value === true || value === 1 || value === '1');
}

function contentFromRevision(revision) {
  const mainSlot = revision?.slots?.main;
  if (isRecord(mainSlot)) {
    const slotContent = firstDefined(mainSlot['*'], mainSlot.content);
    if (typeof slotContent === 'string') return slotContent;
    if (slotContent === null) return null;
  }
  const directContent = firstDefined(revision?.['*'], revision?.content);
  return typeof directContent === 'string' ? directContent : null;
}

function pageSuppressionState(page) {
  const deleted = booleanFlag(page?.deleted, hasOwn(page, 'deleted'));
  const suppressed = booleanFlag(
    page?.suppressed,
    hasOwn(page, 'suppressed') || hasOwn(page, 'oversight'),
  );
  const missing = booleanFlag(page?.missing, hasOwn(page, 'missing'));
  const invalid = booleanFlag(page?.invalid, hasOwn(page, 'invalid'));
  if (deleted) return 'deleted';
  if (suppressed) return 'suppressed';
  if (missing) return 'missing';
  if (invalid) return 'invalid';
  return 'available';
}

/**
 * Normalize one MediaWiki revision without making a request.
 *
 * The API uses presence flags for fields such as `minor`, `userhidden`, and
 * `commenthidden`. The normalized record keeps those exact names and also
 * exposes descriptive aliases for consumers that do not know MediaWiki's
 * wire format.
 */
export function normalizeRevision(
  revision,
  { maxContentBytes = DEFAULT_MAX_CONTENT_BYTES } = {},
) {
  if (!isRecord(revision)) throw new Error('REVISION_INVALID_RECORD');
  const revisionId = numberOrNull(
    firstDefined(revision.revid, revision.revisionId),
  );
  if (!Number.isInteger(revisionId) || revisionId <= 0)
    throw new Error('REVISION_MISSING_ID');

  const rawContent = contentFromRevision(revision);
  if (typeof rawContent === 'string') {
    const contentBytes = Buffer.byteLength(rawContent, 'utf8');
    if (contentBytes > maxContentBytes)
      throw new Error(
        `REVISION_CONTENT_TOO_LARGE:${revisionId}:${contentBytes}`,
      );
  }

  const userHidden = booleanFlag(
    revision.userhidden,
    hasOwn(revision, 'userhidden'),
  );
  const commentHidden = booleanFlag(
    revision.commenthidden,
    hasOwn(revision, 'commenthidden'),
  );
  const contentSuppressed =
    booleanFlag(revision.texthidden, hasOwn(revision, 'texthidden')) ||
    booleanFlag(revision.contenthidden, hasOwn(revision, 'contenthidden')) ||
    (rawContent === null &&
      (userHidden || commentHidden || hasOwn(revision, 'suppressed')));
  const user = stringOrNull(revision.user);
  const comment = stringOrNull(revision.comment);
  const timestamp = stringOrNull(revision.timestamp);
  if (!timestamp) throw new Error(`REVISION_MISSING_TIMESTAMP:${revisionId}`);

  const tags = Array.isArray(revision.tags)
    ? revision.tags.filter((tag) => typeof tag === 'string')
    : [];
  const contentSha256 =
    typeof rawContent === 'string'
      ? sha256(Buffer.from(rawContent, 'utf8'))
      : null;

  const parentId = numberOrNull(
    firstDefined(revision.parentid, revision.parentId),
  );
  const userId = numberOrNull(firstDefined(revision.userid, revision.userId));
  return {
    revid: revisionId,
    revisionId,
    parentid: parentId,
    parentId,
    timestamp,
    user,
    userhidden: userHidden,
    userid: userId,
    userId,
    comment,
    commenthidden: commentHidden,
    minor: booleanFlag(revision.minor, hasOwn(revision, 'minor')),
    sha1: typeof revision.sha1 === 'string' ? revision.sha1 : null,
    size: numberOrNull(revision.size),
    tags,
    contentmodel: stringOrNull(
      firstDefined(revision.contentmodel, revision.contentModel),
    ),
    contentformat: stringOrNull(
      firstDefined(revision.contentformat, revision.contentFormat),
    ),
    rawContent,
    deleted: booleanFlag(revision.deleted, hasOwn(revision, 'deleted')),
    suppressed: booleanFlag(
      revision.suppressed,
      hasOwn(revision, 'suppressed'),
    ),
    contentSuppressed,
    contentSha256,
  };
}

function sortRevisions(revisions) {
  return [...revisions].sort((left, right) => {
    if (left.revisionId !== right.revisionId)
      return left.revisionId - right.revisionId;
    return left.timestamp.localeCompare(right.timestamp);
  });
}

/** Build the stable digest for an ordered revision bundle. */
export function revisionBundleHash(bundle) {
  return sha256(canonicalJson(bundle));
}

export function createRevisionCaptureCursor({
  pageIds,
  batchSize = DEFAULT_BATCH_SIZE,
  nextBatchIndex = 0,
  batches = [],
  requestCount = 0,
  revisionCount = 0,
  lastResponseSha256 = null,
  bundleRecords = [],
  partialPages = [],
}) {
  return {
    recordType: 'RevisionCaptureCursorV1',
    schemaVersion: SCHEMA_VERSION,
    pageIds: [...pageIds],
    batchSize,
    nextBatchIndex,
    requestCount,
    revisionCount,
    lastResponseSha256,
    bundleRecords: bundleRecords.map((bundle) => structuredClone(bundle)),
    partialPages: partialPages.map((entry) => ({
      batchIndex: entry.batchIndex,
      page: structuredClone(entry.page),
    })),
    batches: batches.map((batch) => ({
      batchIndex: batch.batchIndex,
      pageIds: [...batch.pageIds],
      continuation: batch.continuation ?? null,
      completed: Boolean(batch.completed),
      revisionCount: batch.revisionCount ?? 0,
      bundleIds: [...(batch.bundleIds ?? [])],
    })),
  };
}

function normalizePageIds(pageIds) {
  if (!Array.isArray(pageIds) || pageIds.length === 0)
    throw new Error('PAGE_IDS_REQUIRED');
  const normalized = pageIds.map((pageId) => numberOrNull(pageId));
  if (normalized.some((pageId) => !Number.isInteger(pageId) || pageId <= 0))
    throw new Error('PAGE_IDS_INVALID');
  if (new Set(normalized).size !== normalized.length)
    throw new Error('PAGE_IDS_DUPLICATE');
  return normalized;
}

function assertCursorCompatible(cursor, pageIds, batchSize) {
  if (!isRecord(cursor)) throw new Error('RESUME_CURSOR_INVALID');
  if (cursor.recordType !== 'RevisionCaptureCursorV1')
    throw new Error('RESUME_CURSOR_TYPE_INVALID');
  if (cursor.schemaVersion !== SCHEMA_VERSION)
    throw new Error('RESUME_CURSOR_VERSION_INVALID');
  if (cursor.batchSize !== batchSize)
    throw new Error('RESUME_CURSOR_BATCH_SIZE_MISMATCH');
  const cursorPageIds = normalizePageIds(cursor.pageIds);
  if (canonicalJson(cursorPageIds) !== canonicalJson(pageIds))
    throw new Error('RESUME_CURSOR_PAGE_IDS_MISMATCH');
}

function cloneCursor(cursor) {
  return createRevisionCaptureCursor({
    pageIds: cursor.pageIds,
    batchSize: cursor.batchSize,
    nextBatchIndex: cursor.nextBatchIndex,
    batches: cursor.batches,
    requestCount: cursor.requestCount,
    revisionCount: cursor.revisionCount,
    lastResponseSha256: cursor.lastResponseSha256,
    bundleRecords: cursor.bundleRecords ?? [],
    partialPages: cursor.partialPages ?? [],
  });
}

function batchesOf(pageIds, batchSize) {
  const result = [];
  for (let offset = 0; offset < pageIds.length; offset += batchSize)
    result.push(pageIds.slice(offset, offset + batchSize));
  return result;
}

function requestParams(pageIds, continuation) {
  return {
    action: 'query',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
    pageids: pageIds.join('|'),
    prop: 'revisions',
    rvdir: 'newer',
    rvlimit: 'max',
    rvprop: REVISION_PROPS,
    rvslots: 'main',
    ...continuation,
  };
}

function continuationKey(continuation) {
  return canonicalJson(continuation ?? null);
}

function responseHash(response) {
  return sha256(canonicalJson(response));
}

function responsePages(response) {
  const pages = response?.query?.pages;
  if (Array.isArray(pages)) return pages;
  if (isRecord(pages)) return Object.values(pages);
  throw new Error('REVISION_RESPONSE_MISSING_PAGES');
}

function normalizePage(page, maxContentBytes) {
  if (!isRecord(page)) throw new Error('REVISION_PAGE_INVALID_RECORD');
  const pageId = numberOrNull(firstDefined(page.pageid, page.pageId));
  if (!Number.isInteger(pageId) || pageId <= 0)
    throw new Error('REVISION_PAGE_MISSING_ID');
  const sourceRevisions = Array.isArray(page.revisions) ? page.revisions : [];
  const revisions = sortRevisions(
    sourceRevisions.map((revision) =>
      normalizeRevision(revision, { maxContentBytes }),
    ),
  );
  const status = pageSuppressionState(page);
  const explicitlyNoRevisions =
    !Array.isArray(page.revisions) &&
    (status !== 'available' || hasOwn(page, 'revisions'));
  return {
    pageId,
    title: stringOrNull(firstDefined(page.title, page['*'])),
    status,
    missing: status === 'missing',
    deleted: status === 'deleted',
    suppressed: status === 'suppressed',
    invalid: status === 'invalid',
    revisionsSuppressed:
      explicitlyNoRevisions ||
      revisions.some((revision) => revision.contentSuppressed),
    revisions,
  };
}

function buildBundle(page, source, captureId) {
  const sourcePageUrl = `${source.sourceUrl.replace(/\/$/, '')}/wiki/${encodeURIComponent(page.title ?? String(page.pageId)).replaceAll('%20', '_')}`;
  const revisionRecords = page.revisions.map((revision) => ({
    revisionId: revision.revisionId,
    parentId: revision.parentId,
    timestamp: revision.timestamp,
    contributor: revision.user ?? '',
    comment: revision.comment ?? '',
    contentSha256: revision.contentSha256 ?? sha256(''),
    ...revision,
  }));
  const base = {
    recordType: 'RevisionBundleV1',
    schemaVersion: SCHEMA_VERSION,
    id: `${captureId}:page:${page.pageId}`,
    pageId: page.pageId,
    title: page.title,
    pageStatus: page.status,
    missing: page.missing,
    deleted: page.deleted,
    suppressed: page.suppressed,
    invalid: page.invalid,
    revisionsSuppressed: page.revisionsSuppressed,
    revisions: revisionRecords,
    source: {
      sourceUrl: sourcePageUrl,
      sourcePageId: page.pageId,
      sourceHost: new URL(source.sourceUrl).hostname,
      cutoffAt: source.cutoffAt,
    },
    ordering: 'ascending-revision-id',
  };
  return { ...base, bundleSha256: revisionBundleHash(base) };
}

function resumeError(code, cursor, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.cursor = cloneCursor(cursor);
  return error;
}

function validateBounds({
  batchSize,
  maxBatches,
  maxRequests,
  maxRevisions,
  maxContentBytes,
}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50)
    throw new Error('BATCH_SIZE_OUT_OF_RANGE');
  for (const [name, value] of [
    ['maxBatches', maxBatches],
    ['maxRequests', maxRequests],
    ['maxRevisions', maxRevisions],
    ['maxContentBytes', maxContentBytes],
  ]) {
    if (!Number.isInteger(value) || value < 1)
      throw new Error(`${name.toUpperCase()}_OUT_OF_RANGE`);
  }
}

/**
 * Capture all accessible text revisions for the supplied page IDs.
 *
 * `request` is deliberately injected. It receives one plain MediaWiki query
 * object and returns the decoded JSON response. The function never calls
 * `fetch`, never reads robots.txt, and processes batches and continuations in
 * serial order. On a request failure or an explicit bound refusal, the thrown
 * error carries a resumable `cursor`.
 */
export async function captureRevisionBundles({
  pageIds,
  request,
  source = {
    sourceUrl: 'https://enlossengas.fandom.com',
    cutoffAt: new Date(0).toISOString(),
  },
  captureId = 'fandom:revision-capture-v1',
  batchSize = DEFAULT_BATCH_SIZE,
  maxBatches = DEFAULT_MAX_BATCHES,
  maxRequests = DEFAULT_MAX_REQUESTS,
  maxRevisions = DEFAULT_MAX_REVISIONS,
  maxContentBytes = DEFAULT_MAX_CONTENT_BYTES,
  resume = null,
  onProgress = null,
} = {}) {
  const normalizedPageIds = normalizePageIds(pageIds);
  if (typeof request !== 'function')
    throw new Error('REQUEST_FUNCTION_REQUIRED');
  validateBounds({
    batchSize,
    maxBatches,
    maxRequests,
    maxRevisions,
    maxContentBytes,
  });
  const groupedPageIds = batchesOf(normalizedPageIds, batchSize);
  if (groupedPageIds.length > maxBatches)
    throw new Error(`BATCH_LIMIT:${groupedPageIds.length}:${maxBatches}`);

  const cursor = resume
    ? cloneCursor(resume)
    : createRevisionCaptureCursor({ pageIds: normalizedPageIds, batchSize });
  assertCursorCompatible(cursor, normalizedPageIds, batchSize);
  const bundles = [];
  const seenBatchContinuations = new Set();
  const priorBundles = Array.isArray(cursor.bundleRecords)
    ? cursor.bundleRecords
    : [];
  bundles.push(...priorBundles.map((bundle) => structuredClone(bundle)));

  for (
    let batchIndex = cursor.nextBatchIndex;
    batchIndex < groupedPageIds.length;
    batchIndex += 1
  ) {
    const pageIdsInBatch = groupedPageIds[batchIndex];
    const existingBatch = cursor.batches.find(
      (batch) => batch.batchIndex === batchIndex,
    );
    let continuation = existingBatch?.completed
      ? null
      : (existingBatch?.continuation ?? null);
    const batchKey = `${batchIndex}:${pageIdsInBatch.join('|')}`;
    if (existingBatch?.completed) continue;
    const seenContinuations = new Set();
    let batchRevisionCount = existingBatch?.revisionCount ?? 0;
    const pageStates = new Map(
      (cursor.partialPages ?? [])
        .filter((entry) => entry.batchIndex === batchIndex)
        .map((entry) => [entry.page.pageId, structuredClone(entry.page)]),
    );

    while (true) {
      if (cursor.requestCount >= maxRequests)
        throw resumeError(`REQUEST_LIMIT:${maxRequests}`, cursor);
      const key = `${batchKey}:${continuationKey(continuation)}`;
      if (seenContinuations.has(key) || seenBatchContinuations.has(key))
        throw resumeError(
          `CONTINUATION_CYCLE:${batchIndex}:${continuationKey(continuation)}`,
          cursor,
        );
      seenContinuations.add(key);
      seenBatchContinuations.add(key);

      const params = requestParams(pageIdsInBatch, continuation);
      let response;
      try {
        response = await request(params);
      } catch (error) {
        throw resumeError(`REQUEST_FAILED:${batchIndex}`, cursor, error);
      }
      if (!isRecord(response) || response.error)
        throw resumeError(
          `MEDIAWIKI_RESPONSE_ERROR:${response?.error?.code ?? 'invalid'}`,
          cursor,
        );
      const rawResponseSha256 = responseHash(response);
      cursor.requestCount += 1;
      cursor.lastResponseSha256 = rawResponseSha256;
      const pages = responsePages(response).map((page) =>
        normalizePage(page, maxContentBytes),
      );
      const pageMap = new Map(pages.map((page) => [page.pageId, page]));

      for (const requestedPageId of pageIdsInBatch) {
        const page = pageMap.get(requestedPageId);
        if (!page) continue;
        const previous = pageStates.get(requestedPageId);
        if (!previous) {
          pageStates.set(requestedPageId, page);
          continue;
        }
        const byRevisionId = new Map(
          previous.revisions.map((revision) => [revision.revisionId, revision]),
        );
        for (const revision of page.revisions)
          byRevisionId.set(revision.revisionId, revision);
        pageStates.set(requestedPageId, {
          ...previous,
          ...page,
          revisions: sortRevisions([...byRevisionId.values()]),
          revisionsSuppressed:
            previous.revisionsSuppressed || page.revisionsSuppressed,
        });
      }

      cursor.partialPages = [
        ...(cursor.partialPages ?? []).filter(
          (entry) => entry.batchIndex !== batchIndex,
        ),
        ...[...pageStates.values()].map((page) => ({ batchIndex, page })),
      ];
      cursor.partialPages.sort(
        (left, right) => left.page.pageId - right.page.pageId,
      );
      batchRevisionCount = [...pageStates.values()].reduce(
        (total, page) => total + page.revisions.length,
        0,
      );
      const completedPriorRevisionCount = (cursor.bundleRecords ?? [])
        .filter((bundle) => !pageIdsInBatch.includes(bundle.pageId))
        .reduce((total, bundle) => total + bundle.revisions.length, 0);
      cursor.revisionCount = completedPriorRevisionCount + batchRevisionCount;
      if (cursor.revisionCount > maxRevisions)
        throw resumeError(`REVISION_LIMIT:${maxRevisions}`, cursor);

      const next = response.continue ? { ...response.continue } : null;
      cursor.batches = cursor.batches.filter(
        (batch) => batch.batchIndex !== batchIndex,
      );
      cursor.batches.push({
        batchIndex,
        pageIds: pageIdsInBatch,
        continuation: next,
        completed: next === null,
        revisionCount: batchRevisionCount,
        bundleIds: [...pageStates.values()]
          .filter(
            (page) => page.revisions.length > 0 || page.status !== 'available',
          )
          .map((page) => `${captureId}:page:${page.pageId}`),
      });
      cursor.batches.sort((left, right) => left.batchIndex - right.batchIndex);
      cursor.nextBatchIndex = next === null ? batchIndex + 1 : batchIndex;
      continuation = next;
      if (next === null) {
        const completedBundles = [...pageStates.values()]
          .filter(
            (page) => page.revisions.length > 0 || page.status !== 'available',
          )
          .map((page) => buildBundle(page, source, captureId));
        const completedIds = new Set(
          completedBundles.map((bundle) => bundle.id),
        );
        const oldBundles = bundles.filter(
          (bundle) => !completedIds.has(bundle.id),
        );
        bundles.length = 0;
        bundles.push(...oldBundles, ...completedBundles);
        cursor.bundleRecords = bundles.map((bundle) => structuredClone(bundle));
        cursor.partialPages = (cursor.partialPages ?? []).filter(
          (entry) => entry.batchIndex !== batchIndex,
        );
        cursor.revisionCount = bundles.reduce(
          (total, bundle) => total + bundle.revisions.length,
          0,
        );
      }
      if (typeof onProgress === 'function')
        await onProgress(cloneCursor(cursor));
      if (next === null) break;
    }
  }

  const orderedBundles = [...bundles].sort(
    (left, right) => left.pageId - right.pageId,
  );
  const bundleHashes = Object.fromEntries(
    orderedBundles.map((bundle) => [
      String(bundle.pageId),
      bundle.bundleSha256,
    ]),
  );
  const resultBase = {
    recordType: 'RevisionCaptureResultV1',
    schemaVersion: SCHEMA_VERSION,
    id: captureId,
    pageIds: normalizedPageIds,
    bundles: orderedBundles,
    bundleHashes,
    captureSha256: sha256(
      canonicalJson({ captureId, pageIds: normalizedPageIds, bundleHashes }),
    ),
    cursor: { ...cloneCursor(cursor), nextBatchIndex: groupedPageIds.length },
  };
  return resultBase;
}

export const revisionCaptureConstants = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  revisionProps: REVISION_PROPS,
  defaultBatchSize: DEFAULT_BATCH_SIZE,
  defaultMaxBatches: DEFAULT_MAX_BATCHES,
  defaultMaxRequests: DEFAULT_MAX_REQUESTS,
  defaultMaxRevisions: DEFAULT_MAX_REVISIONS,
  defaultMaxContentBytes: DEFAULT_MAX_CONTENT_BYTES,
});
