'use client';

import {
  Bell,
  BookOpen,
  Building2,
  CircleGauge,
  Command,
  Compass,
  History,
  Home,
  Image,
  Info,
  Layers3,
  Map,
  Moon,
  ScrollText,
  Search,
  Settings,
  Sun,
  TrainFront,
  TramFront,
  Wrench,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchWorkbench, type SearchRecord } from '@/components/search-workbench';
import { useVisitorState } from '@/components/visitor-state-provider';
import type { CurrentRedirectRecordV1 } from '@/lib/contracts';
import { labels, localize } from '@/lib/i18n';
import { formatBuildTime, type BuildProvenance } from '@/lib/provenance';
import { publicPath } from '@/lib/public-path';

type CorpusSearchRecord = {
  id: string;
  pageId: number;
  title: string;
  displayTitle: string;
  aliases: string[];
  categories: string[];
  excerpt: string;
  route: string;
};

type ReaderState =
  | { kind: 'redirect'; record: CurrentRedirectRecordV1 }
  | { kind: 'not-found'; requestedPath?: string };

const destinations = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'stations', label: 'Stations', icon: TrainFront, count: '1.2k' },
  { id: 'lines', label: 'Lines', icon: Layers3, count: '156' },
  { id: 'places', label: 'Places', icon: Building2 },
  { id: 'maps', label: 'Maps', icon: Map, count: '3' },
  { id: 'streetcars', label: 'Streetcars', icon: TramFront, count: '581' },
  { id: 'media', label: 'Media', icon: Image, count: '16.5k' },
  { id: 'history', label: 'History', icon: History },
  { id: 'changelog', label: 'Changelog', icon: ScrollText, count: '6' },
  { id: 'status', label: 'Status', icon: CircleGauge },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: BookOpen },
  { id: 'about', label: 'About', icon: Info },
] as const;

function destinationLabel(id: string, fallback: string, mode: 'en' | 'zh-HK' | 'bilingual') {
  const pair = labels[id as keyof typeof labels];
  return pair ? localize(pair[0], pair[1], mode) : fallback;
}

function recordToSearchRecord(record: CorpusSearchRecord): SearchRecord {
  return {
    id: record.id,
    title: record.displayTitle || record.title,
    subtitle: record.categories.slice(0, 3).join(' · ') || 'Article',
    text: `${record.title} ${record.displayTitle} ${record.aliases.join(' ')} ${record.categories.join(' ')} ${record.excerpt}`,
  };
}

function parseSearchIndex(value: unknown): CorpusSearchRecord[] {
  if (!Array.isArray(value) || value.length > 10_000) throw new Error('The local reader index is outside its supported bounds.');
  const records: CorpusSearchRecord[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('The local reader index has an invalid record.');
    const record = item as Record<string, unknown>;
    const arrays = ['aliases', 'categories'];
    if (typeof record.id !== 'string' || record.id.length < 1 || record.id.length > 240 || ids.has(record.id)) throw new Error('The local reader index has an invalid record id.');
    if (typeof record.pageId !== 'number' || !Number.isInteger(record.pageId) || record.pageId < 1) throw new Error('The local reader index has an invalid page id.');
    if (typeof record.title !== 'string' || record.title.length < 1 || record.title.length > 512 || typeof record.displayTitle !== 'string' || record.displayTitle.length > 1024 || typeof record.excerpt !== 'string' || record.excerpt.length > 640 || typeof record.route !== 'string' || !record.route.startsWith('/wiki/') || record.route.length > 2048) throw new Error('The local reader index has an invalid text or route field.');
    for (const key of arrays) {
      const entries = record[key];
      if (!Array.isArray(entries) || entries.length > 512 || entries.some((entry) => typeof entry !== 'string' || entry.length < 1 || entry.length > 512)) throw new Error('The local reader index has an invalid list field.');
    }
    ids.add(record.id);
    records.push({
      id: record.id,
      pageId: record.pageId,
      title: record.title,
      displayTitle: record.displayTitle,
      aliases: record.aliases as string[],
      categories: record.categories as string[],
      excerpt: record.excerpt,
      route: record.route,
    });
  }
  return records;
}

export function ReaderStatePage({
  state: readerState,
  provenance,
  articleCount = 0,
  fallbackArticleRoute,
}: {
  state: ReaderState;
  provenance: BuildProvenance;
  articleCount?: number;
  fallbackArticleRoute?: string;
}) {
  const router = useRouter();
  const { notifications, setPaletteOpen, state, text, updateSettings } = useVisitorState();
  const settings = state.settings;
  const languageMode = settings.schoolMode.enabled ? 'en' : settings.languageMode;
  const L = (english: string, cantonese: string) => text(localize(english, cantonese, languageMode));
  const [updatedAt, setUpdatedAt] = useState(() => formatBuildTime(provenance.builtAt));
  const [corpusSearch, setCorpusSearch] = useState<CorpusSearchRecord[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setUpdatedAt(formatBuildTime(provenance.builtAt, true)), 0);
    return () => clearTimeout(timer);
  }, [provenance.builtAt]);

  useEffect(() => {
    const controller = new AbortController();
    const loadSearchIndex = async () => {
      try {
        const response = await fetch(publicPath('/search-index.json'), { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`The local reader index could not be loaded (HTTP ${response.status}).`);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('The local reader index exceeds the supported size bound.');
        const parsed = parseSearchIndex(JSON.parse(new TextDecoder().decode(bytes)));
        setCorpusSearch(parsed);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(error instanceof Error ? error.message : 'The local reader index could not be loaded.');
      }
    };
    void loadSearchIndex();
    return () => controller.abort();
  }, []);

  const openHome = () => router.push(publicPath('/'));
  const openDestination = (destination: string) => {
    if (destination === 'home') {
      openHome();
      return;
    }
    router.push(publicPath(`/?tab=${encodeURIComponent(destination)}`));
  };
  const openRecord = (record: SearchRecord) => {
    const match = (corpusSearch ?? []).find((candidate) => candidate.id === record.id);
    if (match) router.push(publicPath(match.route));
  };
  const openNotifications = () => {
    router.push(publicPath('/?tab=notifications'));
  };

  const isRedirect = readerState.kind === 'redirect';
  const redirect = isRedirect ? readerState.record : null;
  const redirectTarget = redirect?.targetRoute ? publicPath(redirect.targetRoute) : null;
  const openReading = () => {
    const route = redirectTarget ?? (fallbackArticleRoute ? publicPath(fallbackArticleRoute) : null);
    if (route) {
      router.push(route);
      return;
    }
    openDestination('explore');
  };
  const searchRecords = (corpusSearch ?? []).map(recordToSearchRecord);

  return (
    <div className="article-app-shell reader-state-page" data-reader-state={readerState.kind} data-element-id={`reader-state:${readerState.kind}`} data-element-kind="page">
      <a className="skip-link" href="#reader-state-content">Skip to reader state</a>
      <header className="top-bar article-app-bar" aria-label="Nazca Railway header">
        <button className="brand" type="button" onClick={openHome} aria-label="Open Nazca Railway home">
          <span className="brand-mark" aria-hidden="true">NR</span>
          <span className="brand-copy">
            <strong>{settings.displayName ?? 'Nazca Railway'}</strong>
            <span>{L('The Encyclopedia of Los Sengas', '洛斯辛格斯百科全書')}</span>
          </span>
        </button>
        <div className="global-search-wrap">
          <SearchWorkbench
            surfaceId="reader-boundary-search"
            label="Search the encyclopedia"
            placeholder="Search stations, lines, places, and articles"
            records={searchRecords}
            onActivate={openRecord}
          />
        </div>
        <div className="header-actions">
          <div className="version-chip" aria-label={`Version ${provenance.version}. Updated ${updatedAt}.`}>
            <strong>v{provenance.version}</strong>
            <span>{updatedAt}</span>
          </div>
          <button className="icon-button" type="button" aria-label={L('Open command palette', '開啟指令面板')} onClick={() => setPaletteOpen(true)}>
            <Command size={19} aria-hidden="true" />
          </button>
          <button className="icon-button notification-button" type="button" aria-label={L('Open notifications', '開啟通知')} onClick={openNotifications}>
            <Bell size={19} aria-hidden="true" />
            {notifications.some((notification) => !notification.dismissed) ? <span className="notification-badge" aria-hidden="true" /> : null}
          </button>
          <button className="icon-button" type="button" aria-label={settings.theme === 'dark' ? L('Use light theme', '用淺色主題') : L('Use dark theme', '用深色主題')} aria-pressed={settings.theme === 'dark'} onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>
            {settings.theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
          </button>
        </div>
      </header>
      <div className="route-color-bar" aria-hidden="true"><span /><span /><span /><span /></div>

      <div className="article-shell-grid">
        <nav className="tab-dock article-tab-dock" aria-label="Reader destinations">
          <div>
            <p className="dock-label">{L('Reader', '閱讀')}</p>
            <div className="tab-list">
              {destinations.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" className="tab-button" title={destinationLabel(item.id, item.label, languageMode)} onClick={() => openDestination(item.id)}>
                    <span className="tab-icon"><Icon size={18} aria-hidden="true" /></span>
                    <span>{destinationLabel(item.id, item.label, languageMode)}</span>
                    {'count' in item && item.count ? <span className="tab-count">{item.count}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <main className="article-main-viewport" id="reader-state-content" tabIndex={-1}>
          <div className="reader-state-layout">
            <p className={`eyebrow reader-state-eyebrow ${isRedirect ? 'reader-state-warning' : 'reader-state-error'}`}>
              <span aria-hidden="true" />
              {isRedirect ? 'REDIRECT · NOT INDEXED AS AN ARTICLE' : 'NOT IN THIS SNAPSHOT'}
            </p>
            {redirect ? (
              <>
                <h1>{redirect.sourceTitle}</h1>
                <p className="reader-state-lede">This title is one of the captured source redirects. Continue to the current article or inspect the source record.</p>
                <div className="reader-state-route-card" aria-label="Redirect mapping">
                  <div><span>From</span><strong>{redirect.sourceTitle}</strong></div>
                  <span className="reader-state-arrow" aria-hidden="true">→</span>
                  <div><span>To</span><strong>{redirect.targetTitle}</strong></div>
                </div>
                <div className="reader-state-actions">
                  {redirectTarget ? <a className="button" href={redirectTarget}>Continue to the current article <span aria-hidden="true">→</span></a> : null}
                  <a className="button button-secondary" href={redirect.sourceUrl} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">Open source redirect record <span aria-hidden="true">↗</span></a>
                </div>
                <p className="reader-state-footnote">Redirects carry <code>noindex, nofollow</code> and are excluded from search results by default.</p>
              </>
            ) : (
              <>
                <h1>That title is not in the current corpus</h1>
                <p className="reader-state-lede">The current snapshot contains {articleCount.toLocaleString()} article records. The requested title may be pending import, outside this snapshot, or unavailable at the source.</p>
                <div className="reader-state-search-card">
                  <Search size={17} aria-hidden="true" />
                  {corpusSearch === null ? <output className="reader-state-search-status">{searchError ?? 'Loading the local reader index…'}</output> : searchError ? <output className="reader-state-search-status">{searchError}</output> : <SearchWorkbench surfaceId="reader-not-found-search" label="Search the encyclopedia instead" placeholder="Search the encyclopedia instead" records={searchRecords} onActivate={openRecord} compact />}
                </div>
                <div className="reader-state-actions reader-state-actions-stack">
                  <button type="button" className="button" onClick={openHome}>Return to the atlas home <span aria-hidden="true">→</span></button>
                  <button type="button" className="button button-secondary" onClick={() => openDestination('stations')}>Browse station titles <span aria-hidden="true">→</span></button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <nav className="reader-bottom-nav" aria-label="Reader quick navigation">
        <button type="button" onClick={openHome}><Home size={19} aria-hidden="true" /><span>Home</span></button>
        <button type="button" onClick={() => openDestination('stations')}><TrainFront size={19} aria-hidden="true" /><span>Stations</span></button>
        <button type="button" onClick={() => document.getElementById('reader-boundary-search-input')?.focus()}><Search size={19} aria-hidden="true" /><span>Search</span></button>
        <button type="button" onClick={openReading}><BookOpen size={19} aria-hidden="true" /><span>{redirectTarget || fallbackArticleRoute ? 'Reading' : 'Explore'}</span></button>
      </nav>
    </div>
  );
}
