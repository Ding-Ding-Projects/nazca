#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_ROOT = path.join(ROOT, 'data', 'corpus');
const API = 'https://enlossengas.fandom.com/api.php';
const USER_AGENT =
  'NazcaRailwayCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/nazca)';
const BATCH_SIZE = 50;
const WAIT_MS = 300;
const MAX_ATTEMPTS = 5;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function renameWithRetry(source, target) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      lastError = error;
      if (!TRANSIENT_RENAME_CODES.has(error?.code) || attempt === 6)
        throw error;
      await sleep(attempt * 50);
    }
  }
  throw lastError;
}

async function writeJsonAtomic(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flush: true,
  });
  await renameWithRetry(temporary, target);
}

async function readJson(target) {
  return JSON.parse(await readFile(target, 'utf8'));
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function apiUrl(pageIds) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({
    action: 'query',
    prop: 'info|revisions',
    inprop: 'url|displaytitle',
    rvprop:
      'ids|timestamp|user|comment|flags|sha1|size|contentmodel|content|tags',
    rvslots: 'main',
    pageids: pageIds.join('|'),
    format: 'json',
    formatversion: '2',
    maxlag: '5',
  })) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchBatch(pageIds) {
  const url = apiUrl(pageIds);
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await sleep(WAIT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        redirect: 'error',
        signal: controller.signal,
      });
      const declaredLength = Number(
        response.headers.get('content-length') ?? 0,
      );
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_RESPONSE_BYTES
      ) {
        throw new Error(`RESPONSE_TOO_LARGE:${declaredLength}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES)
        throw new Error(`RESPONSE_TOO_LARGE:${bytes.byteLength}`);
      const responseHash = sha256(bytes);
      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get('retry-after') ?? 0);
        throw new Error(
          `SOURCE_RETRYABLE:${response.status}:${retryAfter}:${responseHash}`,
        );
      }
      if (!response.ok)
        throw new Error(`SOURCE_HTTP:${response.status}:${responseHash}`);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const json = JSON.parse(text);
      if (json.error) {
        if (json.error.code === 'maxlag')
          throw new Error(`SOURCE_RETRYABLE:503:5:${responseHash}`);
        throw new Error(`MEDIAWIKI_API:${json.error.code ?? 'unknown'}`);
      }
      return {
        json,
        receipt: {
          requestUrl: url.toString(),
          responseSha256: responseHash,
          responseBytes: bytes.byteLength,
          attempt,
        },
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.startsWith('SOURCE_RETRYABLE') ||
        (error instanceof Error && error.name === 'AbortError') ||
        error instanceof TypeError;
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
      const parts = message.split(':');
      const retryAfter = Number(parts[2] ?? 0);
      await sleep(Math.max(retryAfter * 1000, attempt * attempt * 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function contentOf(revision) {
  const slot = revision?.slots?.main;
  return slot?.content ?? slot?.['*'] ?? revision?.content ?? revision?.['*'];
}

function normalizePage(page) {
  const revision = Array.isArray(page.revisions) ? page.revisions[0] : null;
  const content = contentOf(revision);
  if (!revision || typeof content !== 'string')
    throw new Error(`MISSING_CURRENT_CONTENT:${page.pageid}:${page.title}`);
  return {
    recordType: 'CurrentPageCaptureV1',
    schemaVersion: '1.0.0',
    pageId: Number(page.pageid),
    namespace: Number(page.ns),
    title: page.title,
    canonicalUrl: page.canonicalurl ?? null,
    displayTitle: page.displaytitle ?? page.title,
    currentRevision: {
      revisionId: Number(revision.revid),
      parentId: Number(revision.parentid) || null,
      timestamp: revision.timestamp,
      user: revision.user ?? null,
      userHidden: Boolean(revision.userhidden),
      comment: revision.comment ?? '',
      commentHidden: Boolean(revision.commenthidden),
      minor: Boolean(revision.minor),
      sha1: revision.sha1,
      size: Number(revision.size),
      contentModel:
        revision.slots?.main?.contentmodel ?? revision.contentmodel ?? null,
      contentFormat:
        revision.slots?.main?.contentformat ?? revision.contentformat ?? null,
      tags: Array.isArray(revision.tags) ? revision.tags : [],
      rawWikitext: content,
      rawWikitextSha256: sha256(content),
      rawWikitextBytes: Buffer.byteLength(content, 'utf8'),
    },
    sourcePage: page,
  };
}

function sameIds(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => Number(value) === Number(right[index]))
  );
}

async function main() {
  const pointer = await readJson(path.join(CORPUS_ROOT, 'current.json'));
  const captureDirectory = path.resolve(CORPUS_ROOT, pointer.capture);
  if (
    captureDirectory !== CORPUS_ROOT &&
    !captureDirectory.startsWith(`${CORPUS_ROOT}${path.sep}`)
  ) {
    throw new Error('CAPTURE_PATH_ESCAPE');
  }
  const articles = await readJson(path.join(captureDirectory, 'articles.json'));
  if (!Array.isArray(articles) || !articles.length)
    throw new Error('MISSING_ARTICLE_INVENTORY');
  const pageIds = articles.map((article) => Number(article.pageid));
  if (pageIds.some((pageId) => !Number.isInteger(pageId) || pageId <= 0))
    throw new Error('INVALID_ARTICLE_PAGE_ID');
  const outputDirectory = path.join(captureDirectory, 'current-pages');
  await mkdir(outputDirectory, { recursive: true });
  const batchCount = Math.ceil(pageIds.length / BATCH_SIZE);
  const startedAt = new Date().toISOString();
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const expectedIds = pageIds.slice(
      batchIndex * BATCH_SIZE,
      (batchIndex + 1) * BATCH_SIZE,
    );
    const batchName = `batch-${String(batchIndex + 1).padStart(6, '0')}.json`;
    const batchPath = path.join(outputDirectory, batchName);
    if (await exists(batchPath)) {
      const existing = await readJson(batchPath);
      if (!sameIds(existing.requestedPageIds ?? [], expectedIds))
        throw new Error(`RESUME_BATCH_MISMATCH:${batchName}`);
      console.log(
        JSON.stringify({ state: 'resumed', batch: batchIndex + 1, batchCount }),
      );
      continue;
    }
    const capturedAt = new Date().toISOString();
    const { json, receipt } = await fetchBatch(expectedIds);
    const pages = json.query?.pages;
    if (!Array.isArray(pages)) throw new Error(`MISSING_PAGES:${batchName}`);
    const byId = new Map(pages.map((page) => [Number(page.pageid), page]));
    const missingIds = expectedIds.filter((pageId) => !byId.has(pageId));
    if (missingIds.length)
      throw new Error(`MISSING_PAGE_IDS:${batchName}:${missingIds.join(',')}`);
    const records = expectedIds.map((pageId) =>
      normalizePage(byId.get(pageId)),
    );
    const batch = {
      recordType: 'CurrentPageBatchV1',
      schemaVersion: '1.0.0',
      batch: batchIndex + 1,
      batchCount,
      capturedAt,
      requestedPageIds: expectedIds,
      records,
      receipt,
    };
    await writeJsonAtomic(batchPath, batch);
    await writeJsonAtomic(path.join(outputDirectory, 'journal.json'), {
      recordType: 'CurrentPageJournalV1',
      schemaVersion: '1.0.0',
      inventoryManifestSha256: pointer.manifestSha256,
      startedAt,
      updatedAt: new Date().toISOString(),
      completedBatches: batchIndex + 1,
      batchCount,
      completedPages: Math.min((batchIndex + 1) * BATCH_SIZE, pageIds.length),
      pageCount: pageIds.length,
    });
    console.log(
      JSON.stringify({
        state: 'captured',
        batch: batchIndex + 1,
        batchCount,
        pages: records.length,
      }),
    );
  }

  const batches = [];
  let capturedPages = 0;
  let rawWikitextBytes = 0;
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const batchName = `batch-${String(batchIndex + 1).padStart(6, '0')}.json`;
    const bytes = await readFile(path.join(outputDirectory, batchName));
    const batch = JSON.parse(bytes.toString('utf8'));
    capturedPages += batch.records.length;
    rawWikitextBytes += batch.records.reduce(
      (total, record) => total + record.currentRevision.rawWikitextBytes,
      0,
    );
    batches.push({
      name: batchName,
      sha256: sha256(bytes),
      bytes: bytes.byteLength,
      records: batch.records.length,
    });
  }
  if (capturedPages !== pageIds.length)
    throw new Error(`PAGE_COUNT_MISMATCH:${capturedPages}:${pageIds.length}`);
  const manifest = {
    recordType: 'CurrentPageManifestV1',
    schemaVersion: '1.0.0',
    capturedAt: new Date().toISOString(),
    inventoryManifestSha256: pointer.manifestSha256,
    articles: pageIds.length,
    capturedPages,
    rawWikitextBytes,
    batches,
  };
  manifest.manifestSha256 = sha256(JSON.stringify(manifest));
  await writeJsonAtomic(path.join(outputDirectory, 'manifest.json'), manifest);
  console.log(JSON.stringify({ ok: true, manifest }, null, 2));
}

await main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
});
