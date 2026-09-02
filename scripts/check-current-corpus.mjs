#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'data', 'corpus', 'reader', 'v0.1.0');
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort((a, b) => a.localeCompare(b)).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const bytesFor = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = async (name) => JSON.parse(await readFile(path.join(CORPUS, name), 'utf8'));
const forbidden = new Set(['rawWikitext', 'rawHtml', 'rawResponse', 'rawResponseBody', 'sourcePage', 'sourceParse', 'privatePath', 'credential', 'password', 'token']);
function walk(value, location, problems) { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) return value.forEach((item, index) => walk(item, `${location}[${index}]`, problems)); for (const [key, child] of Object.entries(value)) { if (forbidden.has(key)) problems.push(`${location}.${key}: forbidden raw field`); walk(child, `${location}.${key}`, problems); } }
function routePath(route) { return typeof route === 'string' && /^\/wiki\/[^/]+$/.test(route); }

async function main() {
  const manifest = await readJson('manifest.json');
  const routes = await readJson(manifest.routes.registry);
  const redirects = await readJson(manifest.redirects.registry);
  const search = await readJson(manifest.search.index);
  const problems = [];
  if (manifest.recordType !== 'CurrentCorpusManifestV1' || manifest.schemaVersion !== '1.0.0') problems.push('invalid current corpus manifest contract');
  if (manifest.counts.routes !== routes.length || manifest.counts.searchRecords !== search.length || manifest.counts.redirects !== redirects.length) problems.push('manifest counts do not match generated registries');
  const routeSet = new Set(); const titleSet = new Set(); const pageSet = new Set();
  for (const entry of routes) { if (!routePath(entry.route)) problems.push(`invalid route: ${entry.route}`); const routeKey = entry.route.toLocaleLowerCase(); if (routeSet.has(routeKey)) problems.push(`case-insensitive route collision: ${entry.route}`); routeSet.add(routeKey); const titleKey = String(entry.normalizedTitle ?? ''); if (titleSet.has(titleKey)) problems.push(`normalized title collision: ${entry.normalizedTitle}`); titleSet.add(titleKey); if (pageSet.has(entry.pageId)) problems.push(`duplicate page id: ${entry.pageId}`); pageSet.add(entry.pageId); }
  const redirectByRoute = new Map(redirects.map((entry) => [entry.sourceRoute, entry]));
  for (const redirect of redirects) { if (!routePath(redirect.sourceRoute)) problems.push(`invalid redirect route: ${redirect.sourceRoute}`); if (redirect.state === 'resolved' && !redirect.targetRoute) problems.push(`resolved redirect has no target: ${redirect.sourceTitle}`); let current = redirect; const seen = new Set(); while (current?.state === 'resolved' && current.targetRoute && redirectByRoute.has(current.targetRoute)) { if (seen.has(current.sourceRoute)) { problems.push(`redirect cycle: ${redirect.sourceTitle}`); break; } seen.add(current.sourceRoute); current = redirectByRoute.get(current.targetRoute); } }
  for (const shard of manifest.shards) { const records = await readJson(shard.name); if (records.length !== shard.records) problems.push(`shard count mismatch: ${shard.name}`); if (sha256(bytesFor(records)) !== shard.sha256) problems.push(`shard hash mismatch: ${shard.name}`); for (const record of records) { if (sha256(canonical(record)) !== manifest.articleHashes[String(record.pageId)]) problems.push(`article hash mismatch: ${record.pageId}`); if (sha256(record.safeHtml) !== record.renderedSha256) problems.push(`safe HTML hash mismatch: ${record.pageId}`); walk(record, `article:${record.pageId}`, problems); } }
  if (sha256(bytesFor(routes)) !== manifest.routes.sha256) problems.push('routes registry hash mismatch'); if (sha256(bytesFor(redirects)) !== manifest.redirects.sha256) problems.push('redirect registry hash mismatch'); if (sha256(bytesFor(search)) !== manifest.search.sha256) problems.push('search index hash mismatch'); walk(manifest, 'manifest', problems); walk(redirects, 'redirects', problems); walk(search, 'search', problems);
  const archive = path.resolve(ROOT, '..', 'nazca-release', manifest.archive.name); try { const info = await stat(archive); if (info.size !== manifest.archive.bytes) problems.push(`raw archive size mismatch: ${info.size}:${manifest.archive.bytes}`); const archiveBytes = await readFile(archive); if (sha256(archiveBytes) !== manifest.archive.sha256) problems.push('raw archive hash mismatch'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  if (problems.length) throw new Error(problems.join('\n'));
  console.log(JSON.stringify({ ok: true, routes: routes.length, articles: manifest.counts.articles, redirects: redirects.length, shards: manifest.shards.length, search: search.length }, null, 2));
}
await main().catch((error) => { console.error(JSON.stringify({ ok: false, code: error instanceof Error ? error.message : String(error) }, null, 2)); process.exitCode = 1; });
