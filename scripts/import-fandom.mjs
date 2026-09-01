#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ORIGIN = 'https://enlossengas.fandom.com';
const API = `${SOURCE_ORIGIN}/api.php`;
const ROBOTS = `${SOURCE_ORIGIN}/robots.txt`;
const RIGHTS = 'https://www.fandom.com/licensing';
const TERMS = 'https://www.fandom.com/terms-of-use';
const USER_AGENT =
  'NazcaRailwayCorpusImporter/1.0 (+https://github.com/Ding-Ding-Projects/nazca)';
const OUTPUT = path.join(ROOT, 'data', 'corpus');
const IMPORTER_VERSION = '1.0.0';
const WAIT_MS = 300;
const MAX_ATTEMPTS = 5;
const MAX_PAGINATION_PAGES = 100_000;
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchBounded(
  url,
  {
    accept = 'application/json',
    maxBytes = 16 * 1024 * 1024,
    allowForbiddenBody = false,
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, 'User-Agent': USER_AGENT },
        redirect: 'error',
        signal: controller.signal,
      });
      const retryAfter = Number(response.headers.get('retry-after') ?? 0);
      const declaredLength = Number(
        response.headers.get('content-length') ?? 0,
      );
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new Error(`RESPONSE_TOO_LARGE:${declaredLength}`);
      }
      const bytes = await readResponseBounded(response, maxBytes, controller);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (response.status === 403 && !allowForbiddenBody)
        throw new Error('SOURCE_FORBIDDEN');
      if (response.status === 429 || response.status === 503) {
        throw new Error(`SOURCE_RETRYABLE:${response.status}:${retryAfter}`);
      }
      if (!response.ok && !(allowForbiddenBody && response.status === 403)) {
        throw new Error(`SOURCE_HTTP:${response.status}`);
      }
      return { response, bytes, text, sha256: sha256(bytes) };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        message === 'SOURCE_FORBIDDEN' ||
        message.startsWith('RESPONSE_TOO_LARGE')
      )
        throw error;
      const retryable =
        message.startsWith('SOURCE_RETRYABLE') ||
        (error instanceof Error && error.name === 'AbortError') ||
        error instanceof TypeError;
      if (!retryable) throw error;
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(
        Math.max(retryAfterFromMessage(message), attempt * attempt * 500),
      );
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function readResponseBounded(response, maxBytes, controller) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        throw new Error(`RESPONSE_TOO_LARGE:${total}`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function retryAfterFromMessage(message) {
  const parts = message.split(':');
  return parts[0] === 'SOURCE_RETRYABLE' ? Number(parts[2] || 0) * 1000 : 0;
}

function robotsPatternMatches(pattern, pathname) {
  if (!pattern) return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(pathname);
}

function parseRobotsPolicy(text, userAgentToken, paths) {
  const groups = [];
  let current = { agents: [], rules: [] };
  let hasRules = false;
  const pushCurrent = () => {
    if (current.agents.length) groups.push(current);
    current = { agents: [], rules: [] };
    hasRules = false;
  };
  for (const sourceLine of text.split(/\r\n|\n|\r/)) {
    const line = sourceLine.replace(/\s+#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const directive = line.slice(0, separator).trim().toLocaleLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === 'user-agent') {
      if (hasRules) pushCurrent();
      current.agents.push(value.toLocaleLowerCase());
      continue;
    }
    if (directive === 'allow' || directive === 'disallow') {
      if (!current.agents.length) throw new Error('ROBOTS_UNPARSABLE');
      current.rules.push({ directive, path: value });
      hasRules = true;
    }
  }
  pushCurrent();
  if (!groups.length) throw new Error('ROBOTS_UNPARSABLE');

  const token = userAgentToken.toLocaleLowerCase();
  const exact = groups.filter((group) =>
    group.agents.some((agent) => agent === token),
  );
  const selected = exact.length
    ? exact
    : groups.filter((group) => group.agents.some((agent) => agent === '*'));
  if (!selected.length) throw new Error('ROBOTS_NO_MATCHING_GROUP');
  const rules = selected.flatMap((group) => group.rules);
  const decisions = paths.map((pathname) => {
    const matching = rules
      .filter((rule) => robotsPatternMatches(rule.path, pathname))
      .sort((left, right) => {
        const lengthDelta = right.path.length - left.path.length;
        if (lengthDelta) return lengthDelta;
        return left.directive === 'allow' ? -1 : 1;
      });
    const winning = matching[0];
    return {
      pathname,
      allowed: !winning || winning.directive === 'allow' || winning.path === '',
      winningRule: winning ?? null,
    };
  });
  return {
    userAgentToken,
    matchedAgents: [
      ...new Set(selected.flatMap((group) => group.agents)),
    ].sort(),
    decisions,
  };
}

async function preflightPolicy() {
  const robots = await fetchBounded(ROBOTS, {
    accept: 'text/plain',
    maxBytes: 1024 * 1024,
    allowForbiddenBody: true,
  });
  const contentType = robots.response.headers.get('content-type') ?? '';
  const challenge =
    /text\/html/i.test(contentType) ||
    /enable javascript and cookies|cdn-cgi\/challenge-platform|just a moment/i.test(
      robots.text,
    );
  if (challenge) {
    const error = new Error('ROBOTS_CHALLENGE');
    error.receipt = {
      robotsUrl: ROBOTS,
      status: robots.response.status,
      contentType,
      responseSha256: robots.sha256,
      checkedAt: new Date().toISOString(),
    };
    throw error;
  }
  if (robots.response.status !== 200) {
    const error = new Error('ROBOTS_BLOCKED');
    error.receipt = {
      robotsUrl: ROBOTS,
      status: robots.response.status,
      contentType,
      responseSha256: robots.sha256,
      checkedAt: new Date().toISOString(),
    };
    throw error;
  }
  const policy = parseRobotsPolicy(robots.text, 'nazcarailwaycorpusimporter', [
    '/api.php',
  ]);
  if (policy.decisions.some((decision) => !decision.allowed)) {
    const error = new Error('ROBOTS_DISALLOWED');
    error.receipt = {
      robotsUrl: ROBOTS,
      status: robots.response.status,
      contentType,
      responseSha256: robots.sha256,
      policy,
      checkedAt: new Date().toISOString(),
    };
    throw error;
  }
  const terms = await fetchBounded(TERMS, {
    accept: 'text/html',
    maxBytes: 4 * 1024 * 1024,
  });
  return {
    robotsUrl: ROBOTS,
    status: robots.response.status,
    contentType,
    responseSha256: robots.sha256,
    policy,
    termsUrl: TERMS,
    termsSha256: terms.sha256,
    checkedAt: new Date().toISOString(),
  };
}

function apiUrl(params) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({
    format: 'json',
    formatversion: '2',
    maxlag: '5',
    ...params,
  })) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function apiRequest(params) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await sleep(WAIT_MS);
    const result = await fetchBounded(apiUrl(params));
    const parsed = JSON.parse(result.text);
    if (!parsed.error) return { parsed, rawSha256: result.sha256 };
    if (parsed.error.code !== 'maxlag')
      throw new Error(`MEDIAWIKI_API:${parsed.error.code}`);
    lastError = new Error('SOURCE_RETRYABLE:503:5');
    if (attempt < MAX_ATTEMPTS) await sleep(attempt * attempt * 1000);
  }
  throw lastError;
}

async function paginate(params, listKey) {
  const records = [];
  const pages = [];
  const seenContinuations = new Set();
  let continuation = {};
  do {
    const continuationKey = canonicalJson(continuation);
    if (seenContinuations.has(continuationKey)) {
      throw new Error(`CONTINUATION_CYCLE:${listKey}:${continuationKey}`);
    }
    seenContinuations.add(continuationKey);
    if (pages.length >= MAX_PAGINATION_PAGES) {
      throw new Error(`PAGINATION_LIMIT:${listKey}:${MAX_PAGINATION_PAGES}`);
    }
    const { parsed, rawSha256 } = await apiRequest({
      ...params,
      ...continuation,
    });
    const items = parsed.query?.[listKey];
    if (!Array.isArray(items)) throw new Error(`MISSING_LIST:${listKey}`);
    records.push(...items);
    pages.push({ continuation, rawSha256, count: items.length });
    continuation = parsed.continue ? { ...parsed.continue } : null;
  } while (continuation);
  return { records, pages };
}

function resolveNamespaceId(siteInfo, expectedNames) {
  const source = siteInfo.query?.namespaces;
  const namespaces = Array.isArray(source)
    ? source
    : Object.values(source ?? {});
  const accepted = new Set(
    expectedNames.map((name) => name.toLocaleLowerCase()),
  );
  const match = namespaces.find((namespace) =>
    [namespace.name, namespace.canonical, namespace['*']]
      .filter((name) => typeof name === 'string')
      .some((name) => accepted.has(name.toLocaleLowerCase())),
  );
  if (!match || !Number.isInteger(Number(match.id))) {
    throw new Error(`MISSING_NAMESPACE:${expectedNames.join('|')}`);
  }
  return Number(match.id);
}

async function captureInventory() {
  const policy = await preflightPolicy();
  const capturedAt = new Date().toISOString();
  const { parsed: siteInfo, rawSha256: siteInfoRawSha256 } = await apiRequest({
    action: 'query',
    meta: 'siteinfo',
    siprop: 'general|statistics|namespaces|namespacealiases|rightsinfo',
  });
  const templateNamespace = resolveNamespaceId(siteInfo, ['Template']);
  const moduleNamespace = resolveNamespaceId(siteInfo, ['Module']);
  const mapNamespace = resolveNamespaceId(siteInfo, ['Map', 'Maps']);
  const routeCapture = await paginate(
    {
      action: 'query',
      list: 'allpages',
      apnamespace: '0',
      apfilterredir: 'all',
      aplimit: 'max',
    },
    'allpages',
  );
  const templateCapture = await paginate(
    {
      action: 'query',
      list: 'allpages',
      apnamespace: String(templateNamespace),
      aplimit: 'max',
    },
    'allpages',
  );
  const moduleCapture = await paginate(
    {
      action: 'query',
      list: 'allpages',
      apnamespace: String(moduleNamespace),
      aplimit: 'max',
    },
    'allpages',
  );
  const mapCapture = await paginate(
    {
      action: 'query',
      list: 'allpages',
      apnamespace: String(mapNamespace),
      aplimit: 'max',
    },
    'allpages',
  );
  const mediaCapture = await paginate(
    {
      action: 'query',
      list: 'allimages',
      ailimit: 'max',
      aiprop: 'timestamp|url|size|sha1|mime|mediatype|canonicaltitle',
    },
    'allimages',
  );
  const routes = routeCapture.records;
  const templates = templateCapture.records;
  const modules = moduleCapture.records;
  const maps = mapCapture.records;
  const media = mediaCapture.records;
  const redirects = routes.filter((route) => route.redirect);
  const bundleSha256 = {
    siteInfo: sha256(canonicalJson(siteInfo)),
    routes: sha256(canonicalJson(routes)),
    redirects: sha256(canonicalJson(redirects)),
    templates: sha256(canonicalJson(templates)),
    modules: sha256(canonicalJson(modules)),
    maps: sha256(canonicalJson(maps)),
    media: sha256(canonicalJson(media)),
    responsePages: sha256(
      canonicalJson({
        siteInfo: siteInfoRawSha256,
        routes: routeCapture.pages,
        templates: templateCapture.pages,
        modules: moduleCapture.pages,
        maps: mapCapture.pages,
        media: mediaCapture.pages,
      }),
    ),
  };
  const normalized = {
    recordType: 'CorpusSnapshotV1',
    schemaVersion: '1.0.0',
    id: `fandom:${capturedAt}`,
    capturedAt,
    stable: false,
    source: {
      apiUrl: API,
      rightsUrl: RIGHTS,
      termsUrl: TERMS,
      termsSha256: policy.termsSha256,
      robotsUrl: ROBOTS,
      robotsState: 'allowed',
      robotsSha256: policy.responseSha256,
      robotsPolicy: policy.policy,
    },
    counts: {
      totalPages: routes.length,
      articles: routes.length - redirects.length,
      routes: routes.length,
      redirects: redirects.length,
      templates: templates.length,
      modules: modules.length,
      maps: maps.length,
      revisions: 0,
      media: media.length,
      mediaBytes: media.reduce(
        (total, item) => total + Number(item.size || 0),
        0,
      ),
    },
    captureCoverage: {
      titleInventory: true,
      currentMediaInventory: true,
      pageBodies: false,
      categoryEdges: false,
      redirectTargets: false,
      templateModuleClosure: false,
      mapPayloads: false,
      revisionBundles: false,
      stableReconciliation: false,
    },
    bundleSha256,
    importerVersion: IMPORTER_VERSION,
  };
  const manifestSha256 = sha256(canonicalJson(normalized));
  return {
    snapshot: { ...normalized, manifestSha256 },
    routes,
    redirects,
    templates,
    modules,
    maps,
    media,
    rawSiteInfo: siteInfo,
    responsePages: {
      routes: routeCapture.pages,
      templates: templateCapture.pages,
      modules: moduleCapture.pages,
      maps: mapCapture.pages,
      media: mediaCapture.pages,
    },
  };
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

async function publishCaptureSet(inventory) {
  const captureName = inventory.snapshot.capturedAt
    .replaceAll(':', '-')
    .replaceAll('.', '-');
  const staging = path.join(
    OUTPUT,
    '.staging',
    `${captureName}-${randomUUID()}`,
  );
  const finalDirectory = path.join(OUTPUT, 'captures', captureName);
  await mkdir(staging, { recursive: true });
  try {
    const files = {
      'snapshot.json': inventory.snapshot,
      'routes.json': inventory.routes,
      'redirects.json': inventory.redirects,
      'templates.json': inventory.templates,
      'modules.json': inventory.modules,
      'maps.json': inventory.maps,
      'media-manifest.json': inventory.media,
      'siteinfo.raw.json': inventory.rawSiteInfo,
      'response-pages.json': inventory.responsePages,
    };
    for (const [name, value] of Object.entries(files)) {
      await writeFile(
        path.join(staging, name),
        `${JSON.stringify(value, null, 2)}\n`,
        {
          encoding: 'utf8',
          flush: true,
        },
      );
    }
    await mkdir(path.dirname(finalDirectory), { recursive: true });
    await renameWithRetry(staging, finalDirectory);
    await writeJsonAtomic(path.join(OUTPUT, 'current.json'), {
      recordType: 'CorpusCapturePointerV1',
      schemaVersion: '1.0.0',
      capture: `captures/${captureName}`,
      snapshotId: inventory.snapshot.id,
      manifestSha256: inventory.snapshot.manifestSha256,
    });
    return finalDirectory;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  try {
    const inventory = await captureInventory();
    const directory = await publishCaptureSet(inventory);
    console.log(
      JSON.stringify(
        { ok: true, directory, snapshot: inventory.snapshot },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const receipt = {
      ok: false,
      code: message,
      checkedAt: new Date().toISOString(),
      source: SOURCE_ORIGIN,
      receipt:
        error && typeof error === 'object' && 'receipt' in error
          ? error.receipt
          : undefined,
    };
    console.error(JSON.stringify(receipt, null, 2));
    process.exitCode = 2;
  }
}

await main();
