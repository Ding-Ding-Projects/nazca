import { createHash } from 'node:crypto';

const DEFAULT_LIMITS = Object.freeze({
  maxPages: 512,
  maxPropertyPages: 256,
  maxItemsPerProperty: 8192,
  maxWikitextBytes: 8 * 1024 * 1024,
  maxRenderedHtmlBytes: 16 * 1024 * 1024,
  maxTitleLength: 512,
  maxContinuationEntries: 32,
});

const PROPERTY_CONFIG = Object.freeze({
  categories: {
    prop: 'categories',
    pageKey: 'categories',
    token: 'clcontinue',
  },
  links: { prop: 'links', pageKey: 'links', token: 'plcontinue' },
  templates: { prop: 'templates', pageKey: 'templates', token: 'tlcontinue' },
  images: { prop: 'images', pageKey: 'images', token: 'ilcontinue' },
  externalLinks: { prop: 'extlinks', pageKey: 'extlinks', token: 'elcontinue' },
});

const NAMESPACE_PREFIXES = new Map([
  ['file', 'File'],
  ['image', 'File'],
  ['category', 'Category'],
  ['template', 'Template'],
  ['module', 'Module'],
  ['map', 'Map'],
  ['maps', 'Map'],
]);

function mergeLimits(limits) {
  return { ...DEFAULT_LIMITS, ...limits };
}

function assertString(value, name, maxLength) {
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`${name} must be a non-empty string`);
  if (value.length > maxLength)
    throw new RangeError(`${name} exceeds ${maxLength} characters`);
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function decodeFragment(fragment) {
  try {
    return decodeURIComponent(fragment.replace(/\+/g, ' '));
  } catch {
    return fragment;
  }
}

/** Normalize a MediaWiki title without treating a missing page as existing. */
export function normalizeTitle(title, limits = DEFAULT_LIMITS) {
  assertString(title, 'title', limits.maxTitleLength);
  const value = [...title.trim()]
    .filter((character) => (character.codePointAt(0) ?? 0) > 0x1f)
    .join('')
    .replaceAll('_', ' ');
  const collapsed = value.replace(/\s+/g, ' ');
  return collapsed.length
    ? `${collapsed[0].toLocaleUpperCase()}${collapsed.slice(1)}`
    : collapsed;
}

/** Normalize a section fragment into the identity used by generated anchors. */
export function normalizeFragment(fragment, limits = DEFAULT_LIMITS) {
  if (fragment == null || fragment === '') return null;
  assertString(String(fragment), 'fragment', limits.maxTitleLength);
  const decoded = decodeFragment(String(fragment).replace(/^#/, '').trim());
  const normalized = decoded
    .replace(/\s+/g, ' ')
    .replaceAll(' ', '_')
    .replace(/[<>"'`]/g, '')
    .trim();
  return normalized || null;
}

/** Build the stable reader URL. Parentheses are kept readable in legacy wiki links. */
export function titleToRoute(title, fragment = null, limits = DEFAULT_LIMITS) {
  const normalized = normalizeTitle(title, limits);
  const routeTitle = normalized.replaceAll(' ', '_');
  const encoded = encodeURIComponent(routeTitle)
    .replaceAll('%28', '(')
    .replaceAll('%29', ')')
    .replaceAll('%3A', ':');
  const anchor = normalizeFragment(fragment, limits);
  return `/wiki/${encoded}${anchor ? `#${encodeURIComponent(anchor).replaceAll('%2F', '/')}` : ''}`;
}

function namespaceAndTitle(rawTitle, limits) {
  const withoutColon = rawTitle.trim().replace(/^:/, '');
  const separator = withoutColon.indexOf(':');
  if (separator < 1)
    return { namespace: null, title: normalizeTitle(withoutColon, limits) };
  const prefix = withoutColon.slice(0, separator).toLocaleLowerCase();
  const namespace = NAMESPACE_PREFIXES.get(prefix);
  if (!namespace)
    return { namespace: null, title: normalizeTitle(withoutColon, limits) };
  return {
    namespace,
    title: normalizeTitle(withoutColon.slice(separator + 1), limits),
  };
}

/** Normalize one wiki link, preserving a fragment separately from its target identity. */
export function normalizeWikiTarget(
  rawTarget,
  { sourceTitle = '', limits = DEFAULT_LIMITS } = {},
) {
  assertString(String(rawTarget), 'rawTarget', limits.maxTitleLength * 2);
  const target = String(rawTarget).trim();
  const hash = target.indexOf('#');
  const titlePart = hash >= 0 ? target.slice(0, hash) : target;
  const fragment =
    hash >= 0 ? normalizeFragment(target.slice(hash + 1), limits) : null;
  const raw = titlePart || sourceTitle;
  const parsed = namespaceAndTitle(raw, limits);
  const record = {
    raw: target,
    namespace: parsed.namespace,
    title: parsed.title,
    normalizedTitle: parsed.title,
    fragment,
    anchor: fragment,
    route: titleToRoute(
      parsed.namespace ? `${parsed.namespace}:${parsed.title}` : parsed.title,
      fragment,
      limits,
    ),
    identity: `${parsed.namespace ?? 'Main'}:${parsed.title}${fragment ? `#${fragment}` : ''}`,
  };
  return record;
}

function sourceRevisionId(page, explicit) {
  const revision = page?.revisions?.[0] ?? page?.revision ?? null;
  return Number(explicit ?? page?.lastrevid ?? revision?.revid ?? 0) || null;
}

function sourceReference(page, source, revisionId) {
  const host = source?.sourceHost ?? 'enlossengas.fandom.com';
  const sourceUrl =
    source?.sourceUrl ??
    `https://${host}/wiki/${encodeURIComponent(page.title)}`;
  const record = {
    sourceHost: host,
    sourceUrl,
    sourcePageId: Number(page.pageid ?? page.id ?? 0) || undefined,
    sourceRevisionId: revisionId ?? undefined,
    sourceTitle: page.title,
    cutoffAt: source?.cutoffAt ?? new Date(0).toISOString(),
  };
  return record;
}

function pageWikitext(page) {
  const slot = page?.revisions?.[0]?.slots?.main;
  return String(
    page?.wikitext ??
      page?.content ??
      slot?.content ??
      slot?.['*'] ??
      page?.revisions?.[0]?.content ??
      '',
  );
}

function stripCommentsAndCode(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<nowiki(?:\s[^>]*)?>[\s\S]*?<\/nowiki>/gi, '')
    .replace(/<pre(?:\s[^>]*)?>[\s\S]*?<\/pre>/gi, '')
    .replace(/<source(?:\s[^>]*)?>[\s\S]*?<\/source>/gi, '');
}

function uniqueBy(records, identity) {
  const seen = new Set();
  const duplicates = [];
  const unique = [];
  for (const record of records) {
    const id = identity(record);
    if (seen.has(id)) {
      duplicates.push(id);
      continue;
    }
    seen.add(id);
    unique.push(record);
  }
  return { unique, duplicates: [...new Set(duplicates)] };
}

function headingAnchors(text, limits) {
  const anchors = [];
  const counts = new Map();
  for (const match of stripCommentsAndCode(text).matchAll(
    /^\s*(={1,6})\s*(.+?)\s*\1\s*$/gm,
  )) {
    const heading = match[2].replace(/\s+#+$/, '').trim();
    const base = normalizeFragment(heading, limits);
    if (!base) continue;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    const anchor = count ? `${base}_${count}` : base;
    anchors.push({
      heading,
      level: match[1].length,
      anchor,
      id: `${anchor}-${anchors.length + 1}`,
    });
  }
  return anchors;
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Extract structural references from wikitext. Citation context is recorded only when
 * syntax supplies it, never inferred from a URL or a domain name.
 */
export function extractWikitextReferences(
  wikitext,
  { sourceTitle = '', sourceRevisionId = null, limits: suppliedLimits } = {},
) {
  const limits = mergeLimits(suppliedLimits);
  assertString(String(wikitext), 'wikitext', limits.maxWikitextBytes);
  const text = stripCommentsAndCode(String(wikitext));
  const internal = [];
  const categories = [];
  const images = [];
  const maps = [];
  const transclusions = [];
  const external = [];

  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const body = match[1].trim();
    if (!body) continue;
    const [rawTarget, ...pipe] = body.split('|');
    const target = normalizeWikiTarget(rawTarget, { sourceTitle, limits });
    const namespace = target.namespace;
    const metadata = {
      sourceRevisionId,
      label: pipe.join('|').trim() || null,
      raw: body,
    };
    if (namespace === 'Category') {
      categories.push({
        ...target,
        sortKey: pipe[0]?.trim() || null,
        ...metadata,
      });
    } else if (namespace === 'File') {
      images.push({
        ...target,
        fileTitle: target.title,
        options: pipe.map((item) => item.trim()).filter(Boolean),
        ...metadata,
      });
    } else if (namespace === 'Map') {
      maps.push({ ...target, mapTitle: target.title, ...metadata });
    } else {
      internal.push({ ...target, exists: null, redLink: null, ...metadata });
    }
  }

  for (const match of text.matchAll(/\{\{\s*([^{}|]+)(?:\|[^{}]*)?\}\}/g)) {
    const rawName = match[1].trim();
    if (!rawName || rawName.startsWith('#')) continue;
    const target = normalizeWikiTarget(rawName, { sourceTitle, limits });
    if (target.namespace === 'Map')
      maps.push({
        ...target,
        mapTitle: target.title,
        kind: 'template-map',
        sourceRevisionId,
      });
    else transclusions.push({ ...target, sourceRevisionId, raw: match[0] });
  }

  for (const match of text.matchAll(
    /\{\{\s*#display_map\s*:\s*([^|}]+)[^}]*\}\}/gi,
  )) {
    maps.push({
      identity: `inline-map:${sha256(match[1].trim())}`,
      kind: 'inline-map',
      query: match[1].trim(),
      title: null,
      normalizedTitle: null,
      route: null,
      fragment: null,
      sourceRevisionId,
    });
  }

  const refRanges = [];
  for (const match of text.matchAll(/<ref(?:\s[^>]*)?>([\s\S]*?)<\/ref>/gi)) {
    refRanges.push([match.index, match.index + match[0].length]);
    for (const urlMatch of match[1].matchAll(
      /https?:\/\/[^\s<>{}"'\x5B\x5D]+/gi,
    )) {
      const url = externalUrl(urlMatch[0].replace(/[),.;]+$/, ''));
      if (url)
        external.push({
          url,
          source: 'wikitext',
          context: 'ref-tag',
          sourceRevisionId,
        });
    }
  }
  for (const match of text.matchAll(
    /\[\s*(https?:\/\/[^\s]]+)(?:\s+([^]]+))?\]/g,
  )) {
    const url = externalUrl(match[1].replace(/[),.;]+$/, ''));
    if (url)
      external.push({
        url,
        source: 'wikitext',
        context: 'external-link',
        label: match[2]?.trim() || null,
        sourceRevisionId,
      });
  }
  for (const match of text.matchAll(/https?:\/\/[^\s<>{}"'\x5B\x5D]+/gi)) {
    const inRef = refRanges.some(
      ([start, end]) => match.index >= start && match.index < end,
    );
    if (inRef) continue;
    const url = externalUrl(match[0].replace(/[),.;]+$/, ''));
    if (url)
      external.push({
        url,
        source: 'wikitext',
        context: 'bare-url',
        sourceRevisionId,
      });
  }

  const categorySet = uniqueBy(categories, (item) => item.identity);
  const internalSet = uniqueBy(internal, (item) => item.identity);
  const imageSet = uniqueBy(images, (item) => item.identity);
  const templateSet = uniqueBy(transclusions, (item) => item.identity);
  const mapSet = uniqueBy(maps, (item) => item.identity);
  const externalSet = uniqueBy(
    external,
    (item) => `${item.url}|${item.context}`,
  );

  return {
    categories: categorySet.unique,
    categoryEdges: categorySet.unique.map((category) => ({
      from: sourceTitle,
      to: category.title,
      sortKey: category.sortKey,
      sourceRevisionId,
    })),
    internalLinks: internalSet.unique,
    redLinks: internalSet.unique.map((link) => ({
      ...link,
      redLink: link.exists === false,
    })),
    transclusions: templateSet.unique,
    imageUses: imageSet.unique,
    externalLinks: externalSet.unique,
    citationLikeExternalLinks: externalSet.unique.filter(
      (item) => item.context === 'ref-tag',
    ),
    mapReferences: mapSet.unique,
    anchors: headingAnchors(text, limits),
    duplicateIdentities: {
      categories: categorySet.duplicates,
      internalLinks: internalSet.duplicates,
      transclusions: templateSet.duplicates,
      imageUses: imageSet.duplicates,
      externalLinks: externalSet.duplicates,
      maps: mapSet.duplicates,
    },
  };
}

function htmlReferences(html, sourceRevisionId, limits) {
  if (!html) return { internal: [], external: [], images: [] };
  assertString(String(html), 'renderedHtml', limits.maxRenderedHtmlBytes);
  const internal = [];
  const external = [];
  const images = [];
  for (const match of String(html).matchAll(
    /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi,
  )) {
    const value = match[1];
    if (value.startsWith('/wiki/')) {
      const decoded = decodeFragment(
        value.slice('/wiki/'.length).split('#')[0],
      );
      const fragment = value.includes('#')
        ? value.slice(value.indexOf('#') + 1)
        : null;
      internal.push({
        ...normalizeWikiTarget(decoded, { limits }),
        fragment: normalizeFragment(fragment, limits),
        source: 'rendered-html',
        sourceRevisionId,
      });
    } else if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = externalUrl(value);
      if (url)
        external.push({
          url,
          source: 'rendered-html',
          context: 'rendered-attribute',
          sourceRevisionId,
        });
    }
  }
  for (const match of String(html).matchAll(
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
  )) {
    images.push({ url: match[1], source: 'rendered-html', sourceRevisionId });
  }
  return { internal, external, images };
}

function contentRevision(page) {
  const revision = page?.revisions?.[0] ?? {};
  const slot = revision?.slots?.main ?? {};
  const content = String(
    slot.content ?? slot['*'] ?? revision.content ?? pageWikitext(page),
  );
  return {
    revisionId: Number(revision.revid ?? page.lastrevid ?? 0) || null,
    parentId: Number(revision.parentid ?? 0) || undefined,
    timestamp: revision.timestamp ?? null,
    contributor:
      (revision.user ?? revision.userid)
        ? String(revision.user ?? revision.userid)
        : 'unknown',
    comment: String(revision.comment ?? ''),
    content,
    contentSha256: sha256(content),
  };
}

function pageFromResponse(response) {
  const pages = response?.query?.pages;
  if (Array.isArray(pages)) return pages[0] ?? null;
  if (pages && typeof pages === 'object')
    return Object.values(pages)[0] ?? null;
  return null;
}

function continuationFor(response, config, limits) {
  const token = response?.continue;
  if (!token || typeof token !== 'object') return null;
  const values = {};
  for (const key of ['continue', config.token]) {
    if (typeof token[key] === 'string') values[key] = token[key];
  }
  if (Object.keys(values).length === 0) return null;
  if (Object.keys(values).length > limits.maxContinuationEntries)
    throw new RangeError(`CONTINUATION_TOO_LARGE:${config.prop}`);
  return values;
}

async function captureProperty({
  request,
  title,
  config,
  limits,
  requestBase = {},
}) {
  const records = [];
  const pages = [];
  const seen = new Set();
  let continuation = {};
  for (
    let pageNumber = 1;
    pageNumber <= limits.maxPropertyPages;
    pageNumber += 1
  ) {
    const identity = canonicalJson(continuation);
    if (seen.has(identity))
      throw new Error(`CONTINUATION_CYCLE:${config.prop}:${identity}`);
    seen.add(identity);
    const params = {
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: title,
      prop: config.prop,
      ...requestBase,
      ...continuation,
    };
    const response = await request(params);
    const page = pageFromResponse(response);
    const items = Array.isArray(page?.[config.pageKey])
      ? page[config.pageKey]
      : [];
    records.push(...items);
    pages.push({
      pageNumber,
      continuation,
      count: items.length,
      responseHash: sha256(canonicalJson(response)),
    });
    if (records.length > limits.maxItemsPerProperty)
      throw new RangeError(`PROPERTY_LIMIT:${config.prop}`);
    continuation = continuationFor(response, config, limits);
    if (!continuation) break;
    if (pageNumber === limits.maxPropertyPages)
      throw new RangeError(`PAGINATION_LIMIT:${config.prop}`);
  }
  return { records, pages };
}

function redirectTargetFromPage(page, limits) {
  if (page?.redirecttarget?.title) {
    const raw =
      page.redirecttarget.title +
      (page.redirecttarget.fragment ? `#${page.redirecttarget.fragment}` : '');
    return normalizeWikiTarget(raw, { limits });
  }
  const match = pageWikitext(page).match(
    /^\s*#redirect\s*:?\s*\[\[([^\]]+)\]\]/i,
  );
  return match ? normalizeWikiTarget(match[1], { limits }) : null;
}

/** Normalize a redirect with explicit target state and no guessed destination. */
export function normalizeRedirect(
  page,
  { knownTitles = new Set(), source, limits: suppliedLimits } = {},
) {
  const limits = mergeLimits(suppliedLimits);
  const target = redirectTargetFromPage(page, limits);
  const revisionId = sourceRevisionId(page);
  if (!target) {
    return {
      recordType: 'RedirectRecordV1',
      schemaVersion: '1.0.0',
      id: `redirect:${page.pageid ?? normalizeTitle(page.title, limits)}`,
      sourceTitle: normalizeTitle(page.title, limits),
      sourceRoute: titleToRoute(page.title, null, limits),
      targetTitle: 'Unknown target',
      fragmentMap: {},
      sourceRevisionId: revisionId,
      state: 'invalid',
      source: sourceReference(page, source, revisionId),
    };
  }
  const resolved = knownTitles.has(target.title);
  const record = {
    recordType: 'RedirectRecordV1',
    schemaVersion: '1.0.0',
    id: `redirect:${page.pageid ?? normalizeTitle(page.title, limits)}`,
    sourceTitle: normalizeTitle(page.title, limits),
    sourceRoute: titleToRoute(page.title, null, limits),
    targetTitle: target.title,
    fragmentMap: target.fragment ? { [target.fragment]: target.fragment } : {},
    sourceRevisionId: revisionId,
    state: resolved ? 'resolved' : 'missing-target',
    source: sourceReference(page, source, revisionId),
  };
  if (resolved)
    record.targetRoute = titleToRoute(target.title, target.fragment, limits);
  return record;
}

/** Normalize a source map payload while retaining a complete textual equivalent. */
export function normalizeMapRecord(
  map,
  { source, sourceRevisionId = null, limits: suppliedLimits } = {},
) {
  const limits = mergeLimits(suppliedLimits);
  if (!map || typeof map !== 'object')
    throw new TypeError('map must be an object');
  const title = map.title ?? map.name;
  assertString(String(title), 'map.title', limits.maxTitleLength);
  const payload =
    map.payload ?? map.sourcePayload ?? map.data ?? map.content ?? '';
  const serializedPayload =
    typeof payload === 'string' ? payload : canonicalJson(payload);
  const bounds = map.bounds;
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    bounds.some((value) => typeof value !== 'number' || !Number.isFinite(value))
  )
    throw new Error(`MAP_BOUNDS_MISSING:${title}`);
  const textualEquivalent = String(
    map.textualEquivalent ?? map.description ?? serializedPayload,
  ).trim();
  if (!textualEquivalent)
    throw new Error(`MAP_TEXTUAL_EQUIVALENT_MISSING:${title}`);
  return {
    recordType: 'MapRecordV1',
    schemaVersion: '1.0.0',
    id: String(map.id ?? `map:${normalizeTitle(title, limits)}`),
    title: normalizeTitle(title, limits),
    sourcePayloadSha256: sha256(serializedPayload),
    bounds,
    mediaId: map.mediaId ? String(map.mediaId) : undefined,
    layers: Array.isArray(map.layers) ? map.layers : [],
    markers: Array.isArray(map.markers) ? map.markers : [],
    deepLinks: Array.isArray(map.deepLinks) ? map.deepLinks.map(String) : [],
    textualEquivalent,
    source: sourceReference(
      { pageid: map.pageid, title },
      source,
      sourceRevisionId,
    ),
  };
}

function normalizePropertyRecords(property, pageTitle, sourceRevision, limits) {
  if (property === 'categories')
    return property.map((item) =>
      normalizeWikiTarget(item.title ?? item['*'], {
        sourceTitle: pageTitle,
        limits,
      }),
    );
  if (property === 'links')
    return property.map((item) => ({
      ...normalizeWikiTarget(item.title ?? item['*'], {
        sourceTitle: pageTitle,
        limits,
      }),
      exists: item.missing
        ? false
        : item.exists === false
          ? false
          : item.exists === true
            ? true
            : null,
      redLink: item.missing ? true : null,
      sourceRevisionId: sourceRevision,
    }));
  if (property === 'templates')
    return property.map((item) => ({
      ...normalizeWikiTarget(item.title ?? item['*'], {
        sourceTitle: pageTitle,
        limits,
      }),
      sourceRevisionId: sourceRevision,
    }));
  if (property === 'images')
    return property.map((item) => ({
      ...normalizeWikiTarget(item.title ?? item['*'], {
        sourceTitle: pageTitle,
        limits,
      }),
      fileTitle: normalizeTitle(item.title ?? item['*'], limits),
      sourceRevisionId: sourceRevision,
    }));
  return property
    .map((item) => {
      const url = externalUrl(item.url ?? item['*'] ?? String(item));
      return url
        ? {
            url,
            source: 'api',
            context: null,
            sourceRevisionId: sourceRevision,
          }
        : null;
    })
    .filter(Boolean);
}

/**
 * Capture one page using an injected request function. Every property has its own
 * continuation state, so a long links list cannot consume a categories token.
 */
export async function captureMediaWikiPage({
  request,
  page: suppliedPage = null,
  title,
  renderedHtml = '',
  source,
  limits: suppliedLimits,
  knownTitles = new Set(),
} = {}) {
  if (typeof request !== 'function')
    throw new TypeError('request must be an injected function');
  const limits = mergeLimits(suppliedLimits);
  const initialTitle = title ?? suppliedPage?.title;
  assertString(String(initialTitle), 'title', limits.maxTitleLength);
  let page = suppliedPage;
  if (!page) {
    const response = await request({
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: initialTitle,
      prop: 'info|revisions',
      inprop: 'url',
      rvprop: 'ids|timestamp|user|userid|comment|content',
      rvslots: 'main',
      rvlimit: '1',
    });
    page = pageFromResponse(response);
  }
  if (!page || page.missing)
    return {
      missing: true,
      title: normalizeTitle(initialTitle, limits),
      route: titleToRoute(initialTitle, null, limits),
    };
  const revision = contentRevision(page);
  const revisionId = revision.revisionId;
  const propertyResults = {};
  for (const [name, config] of Object.entries(PROPERTY_CONFIG)) {
    propertyResults[name] = await captureProperty({
      request,
      title: page.title,
      config,
      limits,
    });
  }
  const parsed = extractWikitextReferences(revision.content, {
    sourceTitle: page.title,
    sourceRevisionId: revisionId,
    limits,
  });
  const apiCategories = normalizePropertyRecords(
    propertyResults.categories.records,
    page.title,
    revisionId,
    limits,
  );
  const apiLinks = normalizePropertyRecords(
    propertyResults.links.records,
    page.title,
    revisionId,
    limits,
  );
  const apiTemplates = normalizePropertyRecords(
    propertyResults.templates.records,
    page.title,
    revisionId,
    limits,
  );
  const apiImages = normalizePropertyRecords(
    propertyResults.images.records,
    page.title,
    revisionId,
    limits,
  );
  const apiExternal = normalizePropertyRecords(
    propertyResults.externalLinks.records,
    page.title,
    revisionId,
    limits,
  );
  const merged = {
    categories: uniqueBy(
      [...parsed.categories, ...apiCategories],
      (item) => item.identity,
    ).unique,
    internalLinks: uniqueBy(
      [...parsed.internalLinks, ...apiLinks],
      (item) => item.identity,
    ).unique,
    transclusions: uniqueBy(
      [...parsed.transclusions, ...apiTemplates],
      (item) => item.identity,
    ).unique,
    imageUses: uniqueBy(
      [...parsed.imageUses, ...apiImages],
      (item) => item.identity,
    ).unique,
    externalLinks: uniqueBy(
      [...parsed.externalLinks, ...apiExternal],
      (item) => `${item.url}|${item.context}`,
    ).unique,
    mapReferences: parsed.mapReferences,
  };
  const rendered = htmlReferences(renderedHtml, revisionId, limits);
  const route = titleToRoute(page.title, null, limits);
  const internalTitles = new Set(
    [...knownTitles].map((item) => normalizeTitle(item, limits)),
  );
  for (const link of merged.internalLinks) {
    if (internalTitles.size) {
      link.exists = internalTitles.has(link.title);
      link.redLink = !link.exists;
    }
  }
  const redirect = page.redirect
    ? normalizeRedirect(page, { knownTitles: internalTitles, source, limits })
    : null;
  const mapRecords = Array.isArray(page.mapRecords)
    ? page.mapRecords.map((map) =>
        normalizeMapRecord(map, {
          source,
          sourceRevisionId: revisionId,
          limits,
        }),
      )
    : [];
  const body = revision.content;
  const record = {
    recordType: 'PageRecordV1',
    schemaVersion: '1.0.0',
    id: `page:${page.pageid}`,
    pageId: Number(page.pageid),
    title: page.title,
    normalizedTitle: normalizeTitle(page.title, limits),
    route,
    summary: page.extract ?? page.description ?? undefined,
    aliases: [],
    safeBody: body,
    sections: parsed.anchors.map((anchor) => ({
      id: anchor.id,
      anchor: anchor.anchor,
      level: anchor.level,
      heading: anchor.heading,
      markdown: '',
    })),
    categories: merged.categories.map((item) => item.title),
    categoryEdges: parsed.categoryEdges,
    tables: [],
    citations: parsed.citationLikeExternalLinks,
    internalLinks: merged.internalLinks,
    externalLinks: merged.externalLinks,
    mediaIds: merged.imageUses.map((item) => `file:${item.title}`),
    imageUses: merged.imageUses,
    mapIds: merged.mapReferences
      .filter((item) => item.title)
      .map((item) => `map:${item.title}`)
      .concat(mapRecords.map((map) => map.id)),
    mapReferences: merged.mapReferences,
    mapRecords,
    transclusions: merged.transclusions,
    renderedLinks: rendered.internal,
    renderedImages: rendered.images,
    revisionBundleId: `revisions:${page.pageid}`,
    importTransforms: [
      'graph-capture-v1-normalized-routes',
      'graph-capture-v1-structural-wikitext-references',
    ],
    source: sourceReference(page, source, revisionId),
    translation: { sourceLanguage: 'en', cantonese: 'untranslated' },
    renderedSha256: sha256(String(renderedHtml ?? '')),
    sourceRevision: revision,
    propertyPages: Object.fromEntries(
      Object.entries(propertyResults).map(([key, value]) => [key, value.pages]),
    ),
    duplicateIdentities: parsed.duplicateIdentities,
  };
  return {
    page: record,
    redirect,
    rawPage: page,
    propertyRecords: propertyResults,
  };
}

/** Capture a bounded set of pages and resolve red links only against captured titles. */
export async function captureMediaWikiGraph({
  request,
  titles,
  renderedHtmlByTitle = {},
  source,
  limits: suppliedLimits,
} = {}) {
  if (!Array.isArray(titles)) throw new TypeError('titles must be an array');
  const limits = mergeLimits(suppliedLimits);
  if (titles.length > limits.maxPages)
    throw new RangeError(`PAGE_LIMIT:${titles.length}`);
  const normalizedTitles = titles.map((item) => normalizeTitle(item, limits));
  const duplicateTitles = uniqueBy(
    normalizedTitles.map((title) => ({ title })),
    (item) => item.title,
  ).duplicates;
  const uniqueTitles = [...new Set(normalizedTitles)];
  const knownTitles = new Set(uniqueTitles);
  const pages = [];
  const redirects = [];
  const mapRecords = [];
  const missing = [];
  const requests = [];
  for (const pageTitle of uniqueTitles) {
    const result = await captureMediaWikiPage({
      request: async (params) => {
        requests.push(params);
        return request(params);
      },
      title: pageTitle,
      renderedHtml: renderedHtmlByTitle[pageTitle] ?? '',
      source,
      knownTitles,
      limits,
    });
    if (result.missing) missing.push(result.missing);
    else {
      pages.push(result.page);
      mapRecords.push(...result.page.mapRecords);
      if (result.redirect) redirects.push(result.redirect);
    }
  }
  return {
    recordType: 'MediaWikiGraphCaptureV1',
    schemaVersion: '1.0.0',
    pages,
    redirects,
    mapRecords,
    missing,
    duplicateTitles,
    requestCount: requests.length,
    requestLog: requests,
    counts: {
      requested: titles.length,
      unique: uniqueTitles.length,
      pages: pages.length,
      redirects: redirects.length,
      missing: missing.length,
    },
    graphSha256: sha256(
      canonicalJson({ pages, redirects, mapRecords, missing, duplicateTitles }),
    ),
  };
}

export const graphCaptureLimits = DEFAULT_LIMITS;
