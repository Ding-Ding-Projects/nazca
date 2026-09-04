#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_ROOT = path.join(ROOT, 'data', 'corpus');
const API = 'https://enlossengas.fandom.com/api.php';
const USER_AGENT = 'NazcaRailwayCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/nazca)';
const BATCH_SIZE = 50;
const CONCURRENCY = 8;
const MAX_ATTEMPTS = 5;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function renameWithRetry(source, target) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      if (!TRANSIENT_RENAME_CODES.has(error?.code) || attempt === 6) throw error;
      await sleep(attempt * 50);
    }
  }
}

async function writeJsonAtomic(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flush: true });
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

function parseUrl(pageId, revisionId) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({
    action: 'parse',
    oldid: revisionId,
    prop: 'text|sections|links|externallinks|categories|images',
    format: 'json',
    formatversion: '2',
    redirects: '0',
    maxlag: '5',
  })) url.searchParams.set(key, String(value));
  return url;
}

async function fetchRendered(pageId, revisionId) {
  const url = parseUrl(pageId, revisionId);
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        redirect: 'error',
        signal: controller.signal,
      });
      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES)
        throw new Error(`RESPONSE_TOO_LARGE:${declaredLength}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error(`RESPONSE_TOO_LARGE:${bytes.byteLength}`);
      const responseSha256 = sha256(bytes);
      if (response.status === 429 || response.status === 503) throw new Error(`SOURCE_RETRYABLE:${response.status}:${responseSha256}`);
      if (!response.ok) throw new Error(`SOURCE_HTTP:${response.status}:${responseSha256}`);
      const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (json.error) {
        if (json.error.code === 'maxlag') throw new Error(`SOURCE_RETRYABLE:503:${responseSha256}`);
        throw new Error(`MEDIAWIKI_API:${json.error.code ?? 'unknown'}`);
      }
      const parsed = json.parse;
      if (!parsed || Number(parsed.pageid) !== pageId || Number(parsed.revid) !== revisionId)
        throw new Error(`PARSE_ID_MISMATCH:${pageId}:${revisionId}`);
      if (typeof parsed.text !== 'string') throw new Error(`PARSE_TEXT_MISSING:${pageId}:${revisionId}`);
      return {
        pageId,
        revisionId,
        renderedHtml: parsed.text,
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        links: Array.isArray(parsed.links) ? parsed.links : [],
        externalLinks: Array.isArray(parsed.externallinks) ? parsed.externallinks : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        images: Array.isArray(parsed.images) ? parsed.images : [],
        sourceUrl: url.toString(),
        responseSha256,
        responseBytes: bytes.byteLength,
        attempt,
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = message.startsWith('SOURCE_RETRYABLE') || message.startsWith('SOURCE_HTTP:5') || error?.name === 'AbortError' || error instanceof TypeError;
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
      await sleep(attempt * attempt * 500);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function mapLimit(values, worker) {
  const output = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, values.length) }, run));
  return output;
}

async function main() {
  const pointer = await readJson(path.join(CORPUS_ROOT, 'current.json'));
  const captureDirectory = path.resolve(CORPUS_ROOT, pointer.capture);
  if (!captureDirectory.startsWith(`${CORPUS_ROOT}${path.sep}`)) throw new Error('CAPTURE_PATH_ESCAPE');
  const sourceBatches = await readdir(path.join(captureDirectory, 'current-pages'));
  const pages = [];
  for (const name of sourceBatches.filter((item) => /^batch-\d+\.json$/.test(item)).sort()) {
    const batch = await readJson(path.join(captureDirectory, 'current-pages', name));
    pages.push(...batch.records);
  }
  if (!pages.length) throw new Error('MISSING_CURRENT_PAGES');
  const outputDirectory = path.join(captureDirectory, 'rendered-pages');
  await mkdir(outputDirectory, { recursive: true });
  const batchCount = Math.ceil(pages.length / BATCH_SIZE);
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const expected = pages.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
    const name = `batch-${String(batchIndex + 1).padStart(6, '0')}.json`;
    const target = path.join(outputDirectory, name);
    if (await exists(target)) {
      const existing = await readJson(target);
      const valid = Array.isArray(existing.records) && existing.records.length === expected.length && existing.records.every((record, index) => record.pageId === expected[index].pageId && record.revisionId === expected[index].currentRevision.revisionId);
      if (!valid) throw new Error(`RESUME_BATCH_MISMATCH:${name}`);
      console.log(JSON.stringify({ state: 'resumed', batch: batchIndex + 1, batchCount }));
      continue;
    }
    const records = await mapLimit(expected, (record) => fetchRendered(Number(record.pageId), Number(record.currentRevision.revisionId)));
    await writeJsonAtomic(target, { recordType: 'CurrentRenderedPageBatchV1', schemaVersion: '1.0.0', batch: batchIndex + 1, batchCount, records });
    await writeJsonAtomic(path.join(outputDirectory, 'journal.json'), { recordType: 'CurrentRenderedPageJournalV1', schemaVersion: '1.0.0', inventoryManifestSha256: pointer.manifestSha256, completedBatches: batchIndex + 1, batchCount, completedPages: Math.min((batchIndex + 1) * BATCH_SIZE, pages.length), pageCount: pages.length, updatedAt: new Date().toISOString() });
    console.log(JSON.stringify({ state: 'captured', batch: batchIndex + 1, batchCount, pages: records.length }));
  }
  const manifestBatches = [];
  let captured = 0;
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const name = `batch-${String(batchIndex + 1).padStart(6, '0')}.json`;
    const bytes = await readFile(path.join(outputDirectory, name));
    const batch = JSON.parse(bytes.toString('utf8'));
    captured += batch.records.length;
    manifestBatches.push({ name, records: batch.records.length, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  if (captured !== pages.length) throw new Error(`RENDERED_COUNT_MISMATCH:${captured}:${pages.length}`);
  const manifest = { recordType: 'CurrentRenderedPageManifestV1', schemaVersion: '1.0.0', inventoryManifestSha256: pointer.manifestSha256, pages: captured, batchSize: BATCH_SIZE, batches: manifestBatches, generatedAt: new Date().toISOString() };
  manifest.manifestSha256 = sha256(JSON.stringify(manifest));
  await writeJsonAtomic(path.join(outputDirectory, 'manifest.json'), manifest);
  console.log(JSON.stringify({ ok: true, pages: captured, batches: manifestBatches.length, manifestSha256: manifest.manifestSha256 }));
}

await main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
