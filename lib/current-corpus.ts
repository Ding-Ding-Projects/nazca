import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  CurrentArticleRecordV1,
  CurrentCorpusManifestV1,
  CurrentRedirectRecordV1,
} from '@/lib/contracts';

export type CurrentRouteResult =
  | { kind: 'article'; record: CurrentArticleRecordV1 }
  | { kind: 'redirect'; record: CurrentRedirectRecordV1 }
  | { kind: 'missing' };

type RouteEntry = { pageId: number; title: string; normalizedTitle: string; route: string; kind?: 'redirect' };

const ROOT = process.cwd();
const CORPUS = path.join(ROOT, 'data', 'corpus', 'reader', 'v0.1.0');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(CORPUS, name), 'utf8')) as T;
}

let cached: {
  manifest: CurrentCorpusManifestV1;
  routes: RouteEntry[];
  redirects: CurrentRedirectRecordV1[];
  articlesById: Map<number, CurrentArticleRecordV1>;
} | null = null;

function load() {
  if (cached) return cached;
  const manifest = readJson<CurrentCorpusManifestV1>('manifest.json');
  const routes = readJson<RouteEntry[]>(manifest.routes.registry);
  const redirects = readJson<CurrentRedirectRecordV1[]>(manifest.redirects.registry);
  const articlesById = new Map<number, CurrentArticleRecordV1>();
  for (const shard of manifest.shards) {
    const records = readJson<CurrentArticleRecordV1[]>(shard.name);
    for (const record of records) articlesById.set(record.pageId, record);
  }
  cached = { manifest, routes, redirects, articlesById };
  return cached;
}

export function loadCurrentCorpusManifest() {
  return load().manifest;
}

export function loadCurrentRoutes() {
  return load().routes;
}

export function loadCurrentRoute(route: string): CurrentRouteResult {
  const state = load();
  const entry = state.routes.find((candidate) => candidate.route === route);
  if (!entry) return { kind: 'missing' };
  if (entry.kind === 'redirect') {
    const record = state.redirects.find((candidate) => candidate.sourcePageId === entry.pageId);
    return record ? { kind: 'redirect', record } : { kind: 'missing' };
  }
  const record = state.articlesById.get(entry.pageId);
  return record ? { kind: 'article', record } : { kind: 'missing' };
}

export function loadCurrentSearchIndex() {
  return readJson<Array<{ id: string; pageId: number; title: string; displayTitle: string; aliases: string[]; categories: string[]; excerpt: string; route: string }>>(load().manifest.search.index);
}
