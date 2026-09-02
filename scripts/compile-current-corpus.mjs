#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_ROOT = path.join(ROOT, 'data', 'corpus');
const READER_ROOT = path.join(CORPUS_ROOT, 'reader', 'v0.1.0');
const RELEASE_ROOT = path.resolve(ROOT, '..', 'nazca-release');
const ARCHIVE_NAME = 'nazca-current-corpus-0.1.0.zip';
const API_ORIGIN = 'https://enlossengas.fandom.com';
const SHARD_SIZE = 64;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort((a, b) => a.localeCompare(b)).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const writeJson = async (file, value) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, jsonBytes(value)); };
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const normalizeTitle = (title) => String(title ?? '').trim().replaceAll(' ', '_').replace(/^:+/, '');
// Keep static-host filenames unambiguous: percent escapes are represented by a
// tilde plus their hex pair, so Unicode, ampersands, slashes, and plus signs do
// not become decoded or nested output paths during Pages prerendering.
const routeForTitle = (title) => `/wiki/${encodeURIComponent(normalizeTitle(title)).replaceAll('%', '~')}`;
const titleKey = (title) => normalizeTitle(title).replaceAll('_', ' ').toLocaleLowerCase();
const plainText = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity] ?? entity)).replace(/\s+/g, ' ').trim();
const headingSlug = (label) => String(label).toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';

function sourceUrl(title, revisionId) {
  const url = new URL(`/wiki/${normalizeTitle(title)}`, API_ORIGIN);
  if (revisionId) url.searchParams.set('oldid', String(revisionId));
  return url.toString();
}

function safeInline(input, pageId, knownTitles, routeMap, deferredMedia) {
  let text = String(input ?? '');
  text = text.replace(/<\s*(script|style|iframe|frame|object|embed|form|input|video|audio|source|math|svg)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  text = text.replace(/<\s*(ref|references|gallery|timeline|imagemap)\b[^>]*\/?>[\s\S]*?(?:<\/\s*\1\s*>)?/gi, '');
  text = text.replace(/\{\{[\s\S]*?\}\}/g, '');
  const tokens = [];
  const hold = (value) => { const id = `\u0000${tokens.length}\u0000`; tokens.push(value); return id; };
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, target) => {
    const parts = target.split('|');
    const destination = parts.shift()?.trim() ?? '';
    if (/^(?:File|Image|Media):/i.test(destination)) {
      const fileTitle = destination.replace(/^[^:]+:/, '').trim();
      if (fileTitle) deferredMedia.add(fileTitle);
      const caption = parts.filter((part) => !/^(?:thumb|frame|right|left|center|none|\d+px)$/i.test(part.trim())).pop()?.trim() || `Media deferred: ${fileTitle}`;
      return hold(`<figure class="media-deferred"><figcaption>${escapeHtml(caption)} (${escapeHtml(fileTitle)})</figcaption></figure>`);
    }
    const label = parts.join('|').trim() || destination;
    const key = titleKey(destination.split('#')[0]);
    const fragment = destination.includes('#') ? destination.slice(destination.indexOf('#') + 1) : '';
    if (knownTitles.has(key)) {
      const href = (routeMap.get(key) ?? routeForTitle(destination.split('#')[0])) + (fragment ? `#page-${pageId}-${encodeURIComponent(fragment.toLocaleLowerCase().replaceAll(' ', '-'))}` : '');
      return hold(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
    }
    const href = sourceUrl(destination.split('#')[0]) + (fragment ? `#${encodeURIComponent(fragment)}` : '');
    return hold(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer external" referrerpolicy="no-referrer">${escapeHtml(label)}</a>`);
  });
  text = text.replace(/\[\s*(https:\/\/[^\s\]]+)\s+([^\]]+)\]/gi, (_, href, label) => hold(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer external" referrerpolicy="no-referrer">${escapeHtml(label.trim())}</a>`));
  text = escapeHtml(text);
  text = text.replace(/'''([^']+)'''/g, '<strong>$1</strong>').replace(/''([^']+)''/g, '<em>$1</em>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] ?? '');
}

function renderedSourceTitle(href) {
  try {
    const url = new URL(href, API_ORIGIN);
    if (url.hostname !== new URL(API_ORIGIN).hostname || !url.pathname.startsWith('/wiki/')) return null;
    return decodeURIComponent(url.pathname.slice('/wiki/'.length)).replaceAll('_', ' ');
  } catch {
    return null;
  }
}

function compileRenderedHtml(rendered, pageId, knownTitles, routeMap) {
  const deferredMedia = new Set();
  for (const image of rendered.images ?? []) {
    const label = typeof image === 'string' ? image : image?.title ?? image?.name ?? image?.url;
    if (typeof label === 'string' && label.trim()) deferredMedia.add(label.trim());
  }
  let html = sanitizeHtml(String(rendered.renderedHtml ?? ''), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'figure', 'figcaption', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id', 'colspan', 'rowspan', 'scope'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
  });
  html = html.replace(/<img\b([^>]*)>/gi, (_, attributes) => {
    const source = attributes.match(/\bsrc="([^"]*)"/i)?.[1] ?? '';
    const alt = attributes.match(/\balt="([^"]*)"/i)?.[1] ?? '';
    const label = alt || source.split('/').pop() || 'Source media';
    deferredMedia.add(label);
    return `<figure class="media-deferred"><figcaption>Media deferred: ${escapeHtml(label)}</figcaption></figure>`;
  });
  html = html.replace(/<a\b([^>]*)\bhref="([^"]*)"([^>]*)>/gi, (_, before, href, after) => {
    const title = renderedSourceTitle(href);
    if (!title) {
      if (href.startsWith('#')) {
        const fragmentName = href.slice(1).replace(/^page-\d+-/i, '');
        const local = `#page-${pageId}-${headingSlug(fragmentName.replaceAll('_', ' '))}`;
        return `<a${before}href="${escapeHtml(local)}"${after}>`;
      }
      if (/^https?:\/\//i.test(href)) {
        const safeAfter = after.replace(/\s(?:target|rel|referrerpolicy)="[^"]*"/gi, '');
        return `<a${before}href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer external" referrerpolicy="no-referrer"${safeAfter}>`;
      }
      return `<a${before}href="${escapeHtml(href)}"${after}>`;
    }
    const fragment = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
    const key = titleKey(title);
    const target = knownTitles.has(key)
      ? routeMap.get(key) ?? routeForTitle(title)
      : sourceUrl(title);
    const suffix = fragment ? `#page-${pageId}-${encodeURIComponent(fragment.toLocaleLowerCase().replaceAll(' ', '-'))}` : '';
    const local = `${target}${suffix}`;
    const safeAfter = knownTitles.has(key) ? after : after.replace(/\s(?:target|rel|referrerpolicy)="[^"]*"/gi, '');
    return `<a${before}href="${escapeHtml(local)}"${knownTitles.has(key) ? '' : ' target="_blank" rel="noopener noreferrer external" referrerpolicy="no-referrer"'}${safeAfter}>`;
  });
  const headings = [];
  html = html.replace(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const label = plainText(inner);
    const anchor = `page-${pageId}-${headingSlug(label)}`;
    headings.push({ id: anchor, anchor, level: Number(level), heading: label, markdown: label });
    return `<h${level} id="${anchor}">${inner}</h${level}>`;
  });
  if (!html.trim()) html = '<p>No readable article body was supplied for this revision.</p>';
  return { safeHtml: html, plain: plainText(html), sections: headings, deferredMedia: [...deferredMedia].sort((a, b) => a.localeCompare(b)) };
}

function compileWikitext(raw, pageId, knownTitles, routeMap) {
  const deferredMedia = new Set();
  const sections = [];
  const blocks = [];
  const lines = String(raw ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  let paragraph = [];
  let list = null;
  const flushParagraph = () => { if (paragraph.length) { blocks.push(`<p>${safeInline(paragraph.join(' '), pageId, knownTitles, routeMap, deferredMedia)}</p>`); paragraph = []; } };
  const flushList = () => { if (!list) return; blocks.push(`<${list.kind}>${list.items.map((item) => `<li>${safeInline(item, pageId, knownTitles, routeMap, deferredMedia)}</li>`).join('')}</${list.kind}>`); list = null; };
  for (const line of lines) {
    const heading = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(6, heading[1].length);
      const label = heading[2].trim();
      const anchor = `page-${pageId}-${encodeURIComponent(label.toLocaleLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section')}`;
      sections.push({ id: anchor, anchor, level, heading: label });
      blocks.push(`<h${level} id="${anchor}">${safeInline(label, pageId, knownTitles, routeMap, deferredMedia)}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*([*#;:]+)\s*(.*)$/);
    if (bullet) {
      flushParagraph();
      const kind = bullet[1][0] === '#' ? 'ol' : 'ul';
      if (!list || list.kind !== kind) { flushList(); list = { kind, items: [] }; }
      list.items.push(bullet[2]);
      continue;
    }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    if (/^\s*\|[-+].*\|\s*$/.test(line) || /^\s*\|\s*\}\s*$/.test(line)) continue;
    paragraph.push(line.trim());
  }
  flushParagraph(); flushList();
  if (!blocks.length) blocks.push('<p>No readable article body was supplied for this revision.</p>');
  for (const section of sections) section.markdown = section.heading;
  return { safeHtml: blocks.join('\n'), plain: plainText(blocks.join(' ')), sections, deferredMedia: [...deferredMedia].sort((a, b) => a.localeCompare(b)) };
}

async function findCapture() {
  const pointer = JSON.parse(await readFile(path.join(CORPUS_ROOT, 'current.json'), 'utf8'));
  const capture = path.resolve(CORPUS_ROOT, pointer.capture);
  if (!capture.startsWith(`${CORPUS_ROOT}${path.sep}`)) throw new Error('CAPTURE_PATH_ESCAPE');
  return { pointer, capture };
}

async function loadCurrentPages(capture, directoryName, expectedCount) {
  const directory = path.join(capture, directoryName);
  const names = (await readdir(directory)).filter((name) => /^batch-\d+\.json$/.test(name)).sort();
  const records = [];
  for (const name of names) {
    const batch = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
    if (!Array.isArray(batch.records)) throw new Error(`INVALID_BATCH:${name}`);
    records.push(...batch.records);
  }
  if (records.length !== expectedCount) throw new Error(`CAPTURE_COUNT_MISMATCH:${directoryName}:${records.length}:${expectedCount}`);
  const ids = new Set(records.map((record) => record.pageId));
  if (ids.size !== records.length) throw new Error(`DUPLICATE_CAPTURE_PAGE_ID:${directoryName}`);
  return records;
}

async function loadRenderedPages(capture, expectedCount) {
  const directory = path.join(capture, 'rendered-pages');
  const names = (await readdir(directory)).filter((name) => /^batch-\d+\.json$/.test(name)).sort();
  const records = [];
  for (const name of names) {
    const batch = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
    if (!Array.isArray(batch.records)) throw new Error(`INVALID_RENDERED_BATCH:${name}`);
    records.push(...batch.records);
  }
  if (records.length !== expectedCount) throw new Error(`RENDERED_COUNT_MISMATCH:${records.length}:${expectedCount}`);
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.pages !== records.length) throw new Error(`RENDERED_MANIFEST_COUNT_MISMATCH:${manifest.pages}:${records.length}`);
  const byId = new Map(records.map((record) => [Number(record.pageId), record]));
  if (byId.size !== records.length) throw new Error('DUPLICATE_RENDERED_PAGE_ID');
  return { byId, manifest };
}

function redirectDetails(record, knownArticles, knownRedirects, routeMap) {
  const raw = record.currentRevision?.rawWikitext ?? '';
  const match = raw.match(/^\s*#redirect\s*:?\s*\[\[([^\]]+)\]\]/im);
  if (!match) return { targetTitle: '', targetRoute: undefined, fragment: undefined, state: 'invalid' };
  const target = match[1].trim();
  const [targetTitle, fragment] = target.split('#', 2);
  const key = titleKey(targetTitle);
  if (knownArticles.has(key)) return { targetTitle, targetRoute: routeMap.get(key) ?? routeForTitle(targetTitle), fragment, state: 'resolved' };
  if (knownRedirects.has(key)) return { targetTitle, targetRoute: routeMap.get(key) ?? routeForTitle(targetTitle), fragment, state: 'resolved' };
  if (/^(?:[^:]+:)/.test(targetTitle)) return { targetTitle, fragment, state: 'outside-reader-corpus' };
  return { targetTitle, fragment, state: 'outside-reader-corpus' };
}

async function buildArchive(capture, pointer, articlePages, redirectPages) {
  const staging = path.join(RELEASE_ROOT, 'archive-staging');
  const archivePath = path.join(RELEASE_ROOT, ARCHIVE_NAME);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const selected = ['snapshot.json', 'routes.json', 'articles.json', 'redirects.json', 'templates.json', 'modules.json', 'maps.json', 'media-manifest.json', 'siteinfo.raw.json', 'response-pages.json'];
  for (const file of selected) await cp(path.join(capture, file), path.join(staging, file));
  await cp(path.join(capture, 'current-pages'), path.join(staging, 'current-pages'), { recursive: true });
  await cp(path.join(capture, 'rendered-pages'), path.join(staging, 'rendered-pages'), { recursive: true });
  await cp(path.join(capture, 'current-redirects'), path.join(staging, 'current-redirects'), { recursive: true });
  const files = [];
  async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const target = path.join(dir, entry.name); if (entry.isDirectory()) await walk(target); else { const bytes = await readFile(target); files.push({ path: path.relative(staging, target).replaceAll('\\', '/'), bytes: bytes.byteLength, sha256: sha256(bytes) }); } } }
  await walk(staging);
  const archiveManifest = { recordType: 'CurrentRawArchiveManifestV1', schemaVersion: '1.0.0', archive: ARCHIVE_NAME, sourceCapture: path.basename(capture), inventoryManifestSha256: pointer.manifestSha256, articlePages: articlePages.length, redirectPages: redirectPages.length, excluded: ['media bytes', 'historical revisions', 'maps payloads', 'unrelated response caches'], files: files.sort((a, b) => a.path.localeCompare(b.path)) };
  await writeJson(path.join(staging, 'archive-manifest.json'), archiveManifest);
  if (process.platform !== 'win32') throw new Error('ARCHIVE_REQUIRES_WINDOWS_ARCHIVER');
  const result = spawnSync('tar.exe', ['-a', '-c', '-f', archivePath, '-C', staging, '.'], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ARCHIVE_FAILED:${result.status}`);
  const bytes = await readFile(archivePath);
  return { path: archivePath, bytes: bytes.byteLength, sha256: sha256(bytes), manifest: archiveManifest };
}

async function main() {
  const { pointer, capture } = await findCapture();
  const sourceSnapshot = JSON.parse(await readFile(path.join(capture, 'snapshot.json'), 'utf8'));
  const inventoryArticles = JSON.parse(await readFile(path.join(capture, 'articles.json'), 'utf8'));
  const inventoryRedirects = JSON.parse(await readFile(path.join(capture, 'redirects.json'), 'utf8'));
  const articlePages = await loadCurrentPages(capture, 'current-pages', inventoryArticles.length);
  const renderedCapture = await loadRenderedPages(capture, articlePages.length);
  const renderedPages = renderedCapture.byId;
  const redirectPages = await loadCurrentPages(capture, 'current-redirects', inventoryRedirects.length);
  const articleTitles = new Map(articlePages.map((record) => [titleKey(record.title), record]));
  const redirectTitles = new Map(redirectPages.map((record) => [titleKey(record.title), record]));
  const knownTitles = new Set([...articleTitles.keys(), ...redirectTitles.keys()]);
  const routeMap = new Map();
  const routeByPageId = new Map();
  const routeOwners = new Map();
  for (const record of [...articlePages, ...redirectPages].sort((a, b) => a.title.localeCompare(b.title) || a.pageId - b.pageId)) {
    const key = titleKey(record.title);
    const base = routeForTitle(record.title);
    const folded = base.toLocaleLowerCase();
    const route = routeOwners.has(folded) ? `${base}--page-${record.pageId}` : base;
    routeOwners.set(route.toLocaleLowerCase(), record.pageId);
    routeByPageId.set(record.pageId, route);
    if (!routeMap.has(key)) routeMap.set(key, route);
  }
  const articles = articlePages.map((record) => {
    const rendered = renderedPages.get(record.pageId);
    if (!rendered || Number(rendered.revisionId) !== Number(record.currentRevision.revisionId)) throw new Error(`RENDERED_REVISION_MISMATCH:${record.pageId}`);
    const compiled = compileRenderedHtml(rendered, record.pageId, knownTitles, routeMap);
    const route = routeByPageId.get(record.pageId) ?? routeForTitle(record.title);
    const value = { recordType: 'CurrentArticleRecordV1', schemaVersion: '1.0.0', pageId: record.pageId, title: record.title, displayTitle: record.displayTitle ?? record.title, normalizedTitle: normalizeTitle(record.title), route, aliases: [record.title], safeHtml: compiled.safeHtml, plainTextExcerpt: compiled.plain.slice(0, 640), headings: compiled.sections, categories: [], knownInternalLinks: [], externalLinks: [], deferredMedia: compiled.deferredMedia, currentRevisionId: record.currentRevision.revisionId, sha1: record.sha1 ?? record.currentRevision.sha1, timestamp: record.timestamp ?? record.currentRevision.timestamp, contributor: record.userHidden ? null : record.user ?? record.currentRevision.user, contributorState: (record.userHidden ?? record.currentRevision.userHidden) ? 'hidden' : (record.user ?? record.currentRevision.user) ? 'visible' : 'unknown', sourceUrl: sourceUrl(record.title, record.currentRevision.revisionId), transforms: ['exact-oldid-rendered-html', 'sanitized-html', 'source-anchor-prefix', 'local-target-only-links', 'remote-media-deferred', 'unknown-links-externalized'], renderedSha256: sha256(compiled.safeHtml) };
    value.categories = [...new Set((record.currentRevision.rawWikitext.match(/\[\[Category:([^\]|]+)/gi) ?? []).map((item) => item.replace(/^\[\[Category:/i, '').trim()))].sort((a, b) => a.localeCompare(b));
    value.knownInternalLinks = [...new Set((record.currentRevision.rawWikitext.match(/\[\[([^\]|#:]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g) ?? []).map((item) => item.replace(/^\[\[/, '').split(/[|#]/)[0].trim()).filter((title) => articleTitles.has(titleKey(title)) || redirectTitles.has(titleKey(title))))].sort((a, b) => a.localeCompare(b));
    value.externalLinks = [...new Set((record.currentRevision.rawWikitext.match(/https:\/\/[^\s<]+/gi) ?? []).map((item) => item.replace(/[)>.,]+$/, '')))].slice(0, 4096);
    return value;
  }).sort((a, b) => a.normalizedTitle.localeCompare(b.normalizedTitle));
  const redirects = redirectPages.map((record) => { const detail = redirectDetails(record, articleTitles, redirectTitles, routeMap); return { recordType: 'CurrentRedirectRecordV1', schemaVersion: '1.0.0', sourcePageId: record.pageId, sourceTitle: record.title, sourceRoute: routeByPageId.get(record.pageId) ?? routeForTitle(record.title), targetTitle: detail.targetTitle || record.title, targetRoute: detail.targetRoute, fragment: detail.fragment, sourceRevisionId: record.currentRevision.revisionId, sourceUrl: sourceUrl(record.title, record.currentRevision.revisionId), state: detail.state }; }).sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle));
  const redirectsByRoute = new Map(redirects.map((record) => [record.sourceRoute, record]));
  for (const redirect of redirects) {
    if (redirect.state !== 'resolved' || !redirect.targetRoute) continue;
    const seen = new Set([redirect.sourceRoute]);
    let next = redirect.targetRoute;
    while (redirectsByRoute.has(next)) {
      if (seen.has(next)) { redirect.state = 'invalid'; delete redirect.targetRoute; delete redirect.fragment; break; }
      seen.add(next);
      const target = redirectsByRoute.get(next);
      if (!target || target.state !== 'resolved' || !target.targetRoute) break;
      next = target.targetRoute;
    }
  }
  const articleHashes = Object.fromEntries(articles.map((record) => [String(record.pageId), sha256(canonical(record))]));
  const redirectHashes = Object.fromEntries(redirects.map((record) => [String(record.sourcePageId), sha256(canonical(record))]));
  await rm(READER_ROOT, { recursive: true, force: true }); await mkdir(READER_ROOT, { recursive: true });
  const shards = [];
  for (let offset = 0; offset < articles.length; offset += SHARD_SIZE) { const name = `articles-${String(Math.floor(offset / SHARD_SIZE) + 1).padStart(4, '0')}.json`; const chunk = articles.slice(offset, offset + SHARD_SIZE); await writeJson(path.join(READER_ROOT, name), chunk); shards.push({ name, records: chunk.length, sha256: sha256(jsonBytes(chunk)), bytes: jsonBytes(chunk).byteLength }); }
  const routeRegistry = articles.map(({ pageId, title, normalizedTitle, route }) => ({ pageId, title, normalizedTitle, route })).concat(redirects.map(({ sourcePageId, sourceTitle, sourceRoute }) => ({ pageId: sourcePageId, title: sourceTitle, normalizedTitle: normalizeTitle(sourceTitle), route: sourceRoute, kind: 'redirect' }))).sort((a, b) => a.normalizedTitle.localeCompare(b.normalizedTitle));
  const searchIndex = articles.map((record) => ({ id: `article:${record.pageId}`, pageId: record.pageId, title: record.title, displayTitle: record.displayTitle, aliases: record.aliases, categories: record.categories, excerpt: record.plainTextExcerpt, route: record.route })).sort((a, b) => a.title.localeCompare(b.title));
  await writeJson(path.join(READER_ROOT, 'routes.json'), routeRegistry); await writeJson(path.join(READER_ROOT, 'redirects.json'), redirects); await writeJson(path.join(READER_ROOT, 'search-index.json'), searchIndex);
  const archive = await buildArchive(capture, pointer, articlePages, redirectPages);
  const manifest = { recordType: 'CurrentCorpusManifestV1', schemaVersion: '1.0.0', release: '0.1.0', captureWindow: { startedAt: sourceSnapshot.capturedAt, finishedAt: new Date().toISOString() }, source: { apiUrl: sourceSnapshot.source.apiUrl, rightsUrl: sourceSnapshot.source.rightsUrl, termsUrl: sourceSnapshot.source.termsUrl, termsState: sourceSnapshot.source.termsState, robotsState: sourceSnapshot.source.robotsState, policyReceipts: { termsSha256: sourceSnapshot.source.termsSha256, robotsSha256: sourceSnapshot.source.robotsSha256, termsOverrideReason: sourceSnapshot.source.termsOverrideReason, robotsSkipReason: sourceSnapshot.source.robotsSkipReason } }, counts: { routes: routeRegistry.length, articles: articles.length, redirects: redirects.length, articleShards: shards.length, searchRecords: searchIndex.length }, redirectStates: Object.fromEntries(['resolved', 'outside-reader-corpus', 'invalid'].map((state) => [state, redirects.filter((record) => record.state === state).length])), routes: { registry: 'routes.json', sha256: sha256(jsonBytes(routeRegistry)) }, redirects: { registry: 'redirects.json', sha256: sha256(jsonBytes(redirects)), hashes: redirectHashes }, search: { index: 'search-index.json', sha256: sha256(jsonBytes(searchIndex)) }, rendered: { manifest: 'rendered-pages/manifest.json', pages: renderedCapture.manifest.pages, sha256: renderedCapture.manifest.manifestSha256 }, shards, articleHashes, archive: { name: ARCHIVE_NAME, bytes: archive.bytes, sha256: archive.sha256, manifestSha256: sha256(canonical(archive.manifest)) }, deferredScope: ['historical revisions', 'media bytes', 'maps', 'template and module closure', 'stable cutoff reconciliation'], generatedAt: new Date().toISOString() };
  manifest.manifestSha256 = sha256(canonical(manifest)); await writeJson(path.join(READER_ROOT, 'manifest.json'), manifest); await writeJson(path.join(CORPUS_ROOT, 'current-capture-summary.json'), { recordType: 'CorpusCaptureSummaryV1', schemaVersion: '1.0.0', capturedAt: manifest.generatedAt, stable: false, source: sourceSnapshot.source.apiUrl, inventory: { manifestSha256: pointer.manifestSha256, routes: routeRegistry.length, articles: articles.length, redirects: redirects.length, templates: sourceSnapshot.counts.templates, modules: sourceSnapshot.counts.modules, maps: sourceSnapshot.counts.maps, media: sourceSnapshot.counts.media, mediaBytes: sourceSnapshot.counts.mediaBytes }, currentPages: { captured: articles.length, rawWikitextBytes: articlePages.reduce((sum, item) => sum + item.currentRevision.rawWikitextBytes, 0), batches: shards.length, manifestSha256: manifest.manifestSha256, renderedManifestSha256: renderedCapture.manifest.manifestSha256 }, policyReceipts: manifest.source.policyReceipts, storage: { currentCapture: 'ignored local resumable capture', releaseArchive: ARCHIVE_NAME, ordinaryGitContainsRawCorpus: false }, remaining: manifest.deferredScope });
  console.log(JSON.stringify({ ok: true, captureWindow: manifest.captureWindow, counts: manifest.counts, redirectStates: manifest.redirectStates, archive, generated: { readerRoot: READER_ROOT, shards: shards.length, routes: routeRegistry.length, redirects: redirects.length, search: searchIndex.length } }, null, 2));
}

await main().catch((error) => { console.error(JSON.stringify({ ok: false, code: error instanceof Error ? error.message : String(error), checkedAt: new Date().toISOString() }, null, 2)); process.exitCode = 2; });
