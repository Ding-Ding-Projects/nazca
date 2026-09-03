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
  Landmark,
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

export function ReaderStatePage({
  state: readerState,
  provenance,
  corpusSearch = [],
}: {
  state: ReaderState;
  provenance: BuildProvenance;
  corpusSearch?: CorpusSearchRecord[];
}) {
  const router = useRouter();
  const { notifications, setPaletteOpen, state, text, updateSettings } = useVisitorState();
  const settings = state.settings;
  const languageMode = settings.schoolMode.enabled ? 'en' : settings.languageMode;
  const L = (english: string, cantonese: string) => text(localize(english, cantonese, languageMode));
  const [updatedAt, setUpdatedAt] = useState(() => formatBuildTime(provenance.builtAt));

  useEffect(() => {
    const timer = setTimeout(() => setUpdatedAt(formatBuildTime(provenance.builtAt, true)), 0);
    return () => clearTimeout(timer);
  }, [provenance.builtAt]);

  const openHome = () => router.push(publicPath('/'));
  const openDestination = (destination: string) => {
    if (destination === 'home') {
      openHome();
      return;
    }
    router.push(publicPath(`/?tab=${encodeURIComponent(destination)}`));
  };
  const openRecord = (record: SearchRecord) => {
    const match = corpusSearch.find((candidate) => candidate.id === record.id);
    if (match) router.push(publicPath(match.route));
  };
  const openNotifications = () => {
    window.dispatchEvent(new CustomEvent('nazca:navigate', { detail: 'notifications' }));
  };

  const isRedirect = readerState.kind === 'redirect';
  const redirect = isRedirect ? readerState.record : null;
  const redirectTarget = redirect?.targetRoute ? publicPath(redirect.targetRoute) : null;
  const searchRecords = corpusSearch.map(recordToSearchRecord);

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
            {isRedirect ? (
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
                <p className="reader-state-lede">The current snapshot contains {corpusSearch.length.toLocaleString()} article records. The requested title may be pending import, outside this snapshot, or unavailable at the source.</p>
                <div className="reader-state-search-card">
                  <Search size={17} aria-hidden="true" />
                  <SearchWorkbench
                    surfaceId="reader-not-found-search"
                    label="Search the encyclopedia instead"
                    placeholder="Search the encyclopedia instead"
                    records={searchRecords}
                    onActivate={openRecord}
                    compact
                  />
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
        <button type="button" onClick={() => openDestination('explore')}><BookOpen size={19} aria-hidden="true" /><span>Reading</span></button>
      </nav>
    </div>
  );
}
