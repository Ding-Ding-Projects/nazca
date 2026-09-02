#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_ROOT = path.join(ROOT, 'data', 'corpus');
const API = 'https://enlossengas.fandom.com/api.php';
const USER_AGENT = 'NazcaRailwayCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/nazca)';
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const WAIT_MS = 300;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function renameWithRetry(source, target) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try { await rename(source, target); return; }
    catch (error) {
      lastError = error;
      if (!TRANSIENT_RENAME_CODES.has(error?.code) || attempt === 6) throw error;
      await sleep(attempt * 50);
    }
  }
  throw lastError;
}

async function writeJsonAtomic(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flush: true });
  await renameWithRetry(temporary, target);
}

const exists = async (target) => {
  try { await stat(target); return true; }
  catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
};

function queryUrl(pageIds) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({
    action: 'query', prop: 'info|revisions', inprop: 'url|displaytitle',
    rvprop: 'ids|timestamp|user|comment|flags|sha1|size|contentmodel|content|tags',
    rvslots: 'main', pageids: pageIds.join('|'), format: 'json', formatversion: '2', maxlag: '5',
  })) url.searchParams.set(key, String(value));
  return url;
}

async function fetchBatch(pageIds) {
  const url = queryUrl(pageIds);
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await sleep(WAIT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }, redirect: 'error', signal: controller.signal });
      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > MAX_RESPONSE_BYTES) throw new Error(`RESPONSE_TOO_LARGE:${declaredLength}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error(`RESPONSE_TOO_LARGE:${bytes.byteLength}`);
      const responseHash = sha256(bytes);
      if (response.status === 429 || response.status === 503) throw new Error(`SOURCE_RETRYABLE:${response.status}:${response.headers.get('retry-after') ?? 0}:${responseHash}`);
      if (!response.ok) throw new Error(`SOURCE_HTTP:${response.status}:${responseHash}`);
      const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (json.error) throw new Error(`MEDIAWIKI_API:${json.error.code ?? 'unknown'}`);
      return { json, receipt: { requestUrl: url.toString(), responseSha256: responseHash, responseBytes: bytes.byteLength, attempt } };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = message.startsWith('SOURCE_RETRYABLE') || error?.name === 'AbortError' || error instanceof TypeError;
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
      await sleep(attempt * attempt * 500);
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

function normalizePage(page) {
  const revision = Array.isArray(page.revisions) ? page.revisions[0] : null;
  if (!revision) throw new Error(`MISSING_CURRENT_REVISION:${page.pageid}:${page.title}`);
  const slot = revision.slots?.main ?? revision;
  const content = slot.content ?? slot['*'];
  if (typeof content !== 'string') throw new Error(`MISSING_CURRENT_CONTENT:${page.pageid}:${page.title}`);
  return {
    recordType: 'CurrentRedirectCaptureV1', schemaVersion: '1.0.0', pageId: Number(page.pageid), namespace: Number(page.ns),
    title: page.title, canonicalUrl: page.canonicalurl ?? page.fullurl ?? null, displayTitle: page.displaytitle ?? page.title,
    currentRevision: { revisionId: Number(revision.revid), parentId: Number(revision.parentid) || null, timestamp: revision.timestamp ?? null,
      user: revision.user ?? null, userHidden: Boolean(revision.userhidden), comment: revision.comment ?? '', commentHidden: Boolean(revision.commenthidden),
      minor: Boolean(revision.minor), sha1: revision.sha1 ?? null, size: Number(revision.size ?? Buffer.byteLength(content)),
      contentModel: slot.contentmodel ?? revision.contentmodel ?? null, contentFormat: slot.contentformat ?? revision.contentformat ?? null,
      tags: Array.isArray(revision.tags) ? revision.tags : [], rawWikitext: content, rawWikitextSha256: sha256(content), rawWikitextBytes: Buffer.byteLength(content, 'utf8') },
    sourcePage: page,
  };
}

async function main() {
  const pointer = JSON.parse(await readFile(path.join(CORPUS_ROOT, 'current.json'), 'utf8'));
  const captureDirectory = path.resolve(CORPUS_ROOT, pointer.capture);
  const redirects = JSON.parse(await readFile(path.join(captureDirectory, 'redirects.json'), 'utf8'));
  if (!Array.isArray(redirects) || redirects.length === 0) throw new Error('MISSING_REDIRECT_INVENTORY');
  const pageIds = redirects.map((entry) => Number(entry.pageid));
  if (pageIds.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error('INVALID_REDIRECT_PAGE_ID');
  const outputDirectory = path.join(captureDirectory, 'current-redirects');
  await mkdir(outputDirectory, { recursive: true });
  const batchCount = Math.ceil(pageIds.length / BATCH_SIZE);
  const startedAt = new Date().toISOString();
  for (let index = 0; index < batchCount; index += 1) {
    const expectedPageIds = pageIds.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE);
    const name = `batch-${String(index + 1).padStart(6, '0')}.json`;
    const target = path.join(outputDirectory, name);
    if (await exists(target)) {
      const existing = JSON.parse(await readFile(target, 'utf8'));
      if (JSON.stringify(existing.requestedPageIds) !== JSON.stringify(expectedPageIds)) throw new Error(`RESUME_BATCH_MISMATCH:${name}`);
      console.log(JSON.stringify({ state: 'resumed', batch: index + 1, batchCount }));
      continue;
    }
    const { json, receipt } = await fetchBatch(expectedPageIds);
    const pages = json.query?.pages;
    if (!Array.isArray(pages)) throw new Error(`MISSING_PAGES:${name}`);
    const byId = new Map(pages.map((page) => [Number(page.pageid), page]));
    const missing = expectedPageIds.filter((id) => !byId.has(id));
    if (missing.length) throw new Error(`MISSING_PAGE_IDS:${name}:${missing.join(',')}`);
    const records = expectedPageIds.map((id) => normalizePage(byId.get(id)));
    await writeJsonAtomic(target, { recordType: 'CurrentRedirectBatchV1', schemaVersion: '1.0.0', batch: index + 1, batchCount, capturedAt: new Date().toISOString(), requestedPageIds: expectedPageIds, records, receipt });
    await writeJsonAtomic(path.join(outputDirectory, 'journal.json'), { recordType: 'CurrentRedirectJournalV1', schemaVersion: '1.0.0', inventoryManifestSha256: pointer.manifestSha256, startedAt, updatedAt: new Date().toISOString(), completedBatches: index + 1, batchCount, completedPages: Math.min((index + 1) * BATCH_SIZE, pageIds.length), pageCount: pageIds.length });
    console.log(JSON.stringify({ state: 'captured', batch: index + 1, batchCount, pages: records.length }));
  }
  const batches = [];
  let capturedPages = 0;
  for (let index = 0; index < batchCount; index += 1) {
    const name = `batch-${String(index + 1).padStart(6, '0')}.json`;
    const bytes = await readFile(path.join(outputDirectory, name));
    const batch = JSON.parse(bytes.toString('utf8'));
    capturedPages += batch.records.length;
    batches.push({ name, sha256: sha256(bytes), bytes: bytes.byteLength, records: batch.records.length });
  }
  if (capturedPages !== pageIds.length) throw new Error(`PAGE_COUNT_MISMATCH:${capturedPages}:${pageIds.length}`);
  const manifest = { recordType: 'CurrentRedirectManifestV1', schemaVersion: '1.0.0', capturedAt: new Date().toISOString(), inventoryManifestSha256: pointer.manifestSha256, redirects: pageIds.length, capturedPages, batches };
  manifest.manifestSha256 = sha256(JSON.stringify(manifest));
  await writeJsonAtomic(path.join(outputDirectory, 'manifest.json'), manifest);
  console.log(JSON.stringify({ ok: true, manifest }, null, 2));
}

await main().catch((error) => { console.error(JSON.stringify({ ok: false, code: error instanceof Error ? error.message : String(error), checkedAt: new Date().toISOString() }, null, 2)); process.exitCode = 2; });
