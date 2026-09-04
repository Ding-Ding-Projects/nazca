'use client';

import {
  Bell,
  BookOpen,
  Building2,
  ArrowUpRight,
  ChevronRight,
  CircleGauge,
  Clock3,
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
  TramFront,
  TrainFront,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import { SettingsWorkspace } from '@/components/settings-workspace';
import { SimpleWorkspace } from '@/components/simple-workspace';
import { StatusWorkspace } from '@/components/status-workspace';
import { ToolsWorkspace } from '@/components/tools-workspace';
import { useVisitorState } from '@/components/visitor-state-provider';
import { labels, localize } from '@/lib/i18n';
import { formatBuildTime, type BuildProvenance } from '@/lib/provenance';
import { publicPath } from '@/lib/public-path';

type AtlasRecord = {
  id: string;
  title: string;
  kind: 'Station' | 'Line' | 'Place' | 'Article';
  detail: string;
  color: string;
};

type AtlasTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  count: string;
};

type AtlasTabGroup = {
  label: string;
  items: readonly AtlasTab[];
};

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

const records: AtlasRecord[] = [
  {
    id: 'nazca',
    title: 'Nazca Railway (Los Sengas Division)',
    kind: 'Article',
    detail:
      'Railway systems, rolling stock, structures, incidents, and future development',
    color: 'var(--route-blue)',
  },
  {
    id: 'dragonire',
    title: 'Dragonire Bay Station',
    kind: 'Station',
    detail: 'Recently updated station record',
    color: 'var(--route-green)',
  },
  {
    id: 'odyssey',
    title: 'Odyssey Circular',
    kind: 'Line',
    detail: 'District circular service, line 44',
    color: 'var(--route-red)',
  },
  {
    id: 'kaling',
    title: 'Kaling Station',
    kind: 'Station',
    detail: 'Nazca Railway and area station',
    color: 'var(--route-gold)',
  },
  {
    id: 'metropolis',
    title: 'Metropolis',
    kind: 'Place',
    detail: 'Interactive map and central railway hub',
    color: 'var(--route-blue)',
  },
  {
    id: 'local-rapid',
    title: 'Local Rapid Transit',
    kind: 'Article',
    detail: 'Local rapid transit systems across Los Sengas',
    color: 'var(--route-green)',
  },
];

const groups: readonly AtlasTabGroup[] = [
  {
    label: 'Reader',
    items: [
      { id: 'home', label: 'Home', icon: Home, count: '' },
      { id: 'explore', label: 'Explore', icon: Compass, count: '' },
      { id: 'search', label: 'Search', icon: Search, count: '3.4k' },
      { id: 'stations', label: 'Stations', icon: TrainFront, count: '1.2k' },
      { id: 'lines', label: 'Lines', icon: Layers3, count: '156' },
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        icon: Landmark,
        count: '',
      },
    ],
  },
  {
    label: 'Atlas',
    items: [
      { id: 'places', label: 'Places', icon: Building2, count: '' },
      { id: 'maps', label: 'Maps', icon: Map, count: '3' },
      { id: 'timeline', label: 'Timeline', icon: Clock3, count: '' },
      { id: 'streetcars', label: 'Streetcars', icon: TramFront, count: '581' },
      { id: 'media', label: 'Media', icon: Image, count: '16.5k' },
    ],
  },
  {
    label: 'Research',
    items: [
      { id: 'history', label: 'History', icon: History, count: '' },
      { id: 'changelog', label: 'Changelog', icon: ScrollText, count: '6' },
      { id: 'status', label: 'Status', icon: CircleGauge, count: '' },
      { id: 'tools', label: 'Tools', icon: Wrench, count: '' },
      { id: 'settings', label: 'Settings', icon: Settings, count: '' },
      { id: 'help', label: 'Help', icon: BookOpen, count: '' },
      { id: 'about', label: 'About', icon: Info, count: '' },
    ],
  },
];

const quickLinks = [
  {
    label: 'Stations',
    meta: '1,222 indexed titles',
    color: 'var(--route-blue)',
    tab: 'stations',
  },
  {
    label: 'Lines',
    meta: '156 line records',
    color: 'var(--route-red)',
    tab: 'lines',
  },
  {
    label: 'Places',
    meta: 'Districts and islands',
    color: 'var(--route-green)',
    tab: 'places',
  },
  {
    label: 'Infrastructure',
    meta: 'Roads, bridges, depots',
    color: 'var(--route-gold)',
    tab: 'infrastructure',
  },
];

function recordText(record: AtlasRecord) {
  return `${record.title} ${record.kind} ${record.detail}`;
}

const searchRecords: SearchRecord[] = records.map((record) => ({
  id: record.id,
  title: record.title,
  subtitle: `${record.kind} · ${record.detail}`,
  text: recordText(record),
}));

function CorpusDestination({
  eyebrow,
  title,
  description,
  records: destinationRecords,
  onOpen,
}: {
  eyebrow: string;
  title: string;
  description: string;
  records: CorpusSearchRecord[];
  onOpen: (record: CorpusSearchRecord) => void;
}) {
  return (
    <div className="route-content">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="lede">{description}</p>
      {destinationRecords.length ? (
        <ul className="recent-list destination-record-list">
          {destinationRecords.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                className="recent-item"
                aria-label={`Open ${record.displayTitle || record.title}`}
                onClick={() => onOpen(record)}
              >
                <span className="route-dot" aria-hidden="true" />
                <span>
                  <strong>{record.displayTitle || record.title}</strong>
                  <span>
                    {record.categories.slice(0, 3).join(' · ') || 'Article'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="content-card" aria-label="No records available">
          <h2>No records in this destination yet</h2>
          <p>
            The current generated index has no matching records. The source
            boundary remains visible instead of recycling the Home content.
          </p>
        </section>
      )}
    </div>
  );
}

function CorpusSearchDestination({
  records,
  onOpen,
}: {
  records: CorpusSearchRecord[];
  onOpen: (record: CorpusSearchRecord) => void;
}) {
  const searchRecords: SearchRecord[] = records.map((record) => ({
    id: record.id,
    title: record.displayTitle || record.title,
    subtitle: record.categories.slice(0, 3).join(' · ') || 'Article',
    text: `${record.title} ${record.displayTitle} ${record.aliases.join(' ')} ${record.categories.join(' ')} ${record.excerpt}`,
  }));
  return (
    <div className="route-content reader-search-state" data-reader-state="search">
      <p className="eyebrow"><span aria-hidden="true" />SEARCH · LOCAL, NO NETWORK CALLS</p>
      <h1 className="page-title">Search the current reader</h1>
      <p className="lede">Search {records.length.toLocaleString()} captured article records, aliases, categories, and excerpts. Every result opens its exact static route.</p>
      <div className="reader-search-panel">
        <SearchWorkbench
          surfaceId="dedicated-reader-search"
          label="Search the current reader"
          placeholder="Search articles, stations, lines, and places"
          records={searchRecords}
          onActivate={(result) => {
            const record = records.find((candidate) => candidate.id === result.id);
            if (record) onOpen(record);
          }}
        />
      </div>
      <section className="content-card reader-search-summary" aria-label="Search index summary">
        <div className="section-heading">
          <div><p className="section-overline">Indexed source</p><h2>Complete current index</h2></div>
          <span>{records.length.toLocaleString()} records</span>
        </div>
        <p>Plain text is the default. Open the adjacent regular-expression builder when you need bounded RE2 matching, captures, replacement preview, and timing.</p>
      </section>
    </div>
  );
}

export function NazcaShell({ provenance, corpusSearch = [] }: { provenance: BuildProvenance; corpusSearch?: CorpusSearchRecord[] }) {
  const router = useRouter();
  const { notifications, setPaletteOpen, state, text, updateSettings } =
    useVisitorState();
  const settings = state.settings;
  const languageMode = settings.schoolMode.enabled
    ? 'en'
    : settings.languageMode;
  const L = (english: string, cantonese: string) =>
    text(localize(english, cantonese, languageMode));
  const [activeTab, setActiveTab] = useState('home');
  const [requestedTool, setRequestedTool] = useState<'notifications' | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() =>
    formatBuildTime(provenance.builtAt),
  );

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab === 'notifications') {
      setActiveTab('tools');
      setRequestedTool('notifications');
      return;
    }
    if (requestedTab && groups.some((group) => group.items.some((item) => item.id === requestedTab))) {
      setActiveTab(requestedTab);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => setUpdatedAt(formatBuildTime(provenance.builtAt, true)),
      0,
    );
    return () => clearTimeout(timer);
  }, [provenance.builtAt]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const destination = (event as CustomEvent<string>).detail;
      setActiveTab(destination === 'notifications' ? 'tools' : destination);
      if (destination === 'notifications') {
        setRequestedTool('notifications');
      }
    };
    window.addEventListener('nazca:navigate', navigate);
    return () => window.removeEventListener('nazca:navigate', navigate);
  }, []);

  const selectedLabel =
    groups.flatMap((group) => group.items).find((item) => item.id === activeTab)
      ?.label ?? 'Explore';
  const tabLabel = (id: string, fallback: string) => {
    const pair = labels[id as keyof typeof labels];
    return pair ? L(pair[0], pair[1]) : fallback;
  };

  const openRecord = (record: AtlasRecord) => {
    if (record.kind === 'Article') {
      const corpusRecord = corpusSearch.find(
        (candidate) =>
          candidate.title === record.title ||
          candidate.displayTitle === record.title,
      );
      if (corpusRecord) {
        router.push(publicPath(corpusRecord.route));
        return;
      }
    }
    if (record.id === 'nazca') {
      router.push(publicPath('/wiki/Nazca_Railway_(Los_Sengas_Division)'));
      return;
    }
    setActiveTab(
      record.kind === 'Station'
        ? 'stations'
        : record.kind === 'Line'
          ? 'lines'
          : record.kind === 'Place'
            ? 'places'
            : 'explore',
    );
  };

  const activateSearchRecord = (searchRecord: SearchRecord) => {
    const corpusRecord = corpusSearch.find((candidate) => candidate.id === searchRecord.id);
    if (corpusRecord) {
      router.push(publicPath(corpusRecord.route));
      return;
    }
    const record = records.find(
      (candidate) => candidate.id === searchRecord.id,
    );
    if (record) openRecord(record);
  };

  const openCorpusRecord = (record: CorpusSearchRecord) => {
    router.push(publicPath(record.route));
  };
  const destinationRecords = (destination: string) =>
    corpusSearch.filter((record) => {
      const text = `${record.title} ${record.displayTitle} ${record.categories.join(' ')}`.toLocaleLowerCase();
      if (destination === 'stations') return text.includes('station');
      if (destination === 'lines') return text.includes('line') || text.includes('railway');
      if (destination === 'places') return text.includes('district') || text.includes('island') || text.includes('bay');
      if (destination === 'streetcars') return text.includes('tram') || text.includes('streetcar') || text.includes('light rail');
      return true;
    });

  return (
    <div
      className={`app-shell ${activeTab === 'home' ? 'home-shell' : ''}`}
      data-element-id="shell:nazca"
      data-element-kind="page"
    >
      <a className="skip-link" href="#main-content">
        Skip to atlas content
      </a>

      <header className="top-bar" aria-label="Nazca Railway header">
        <button
          className="brand"
          type="button"
          onClick={() => setActiveTab('home')}
          aria-label="Open Nazca Railway home"
        >
          <span className="brand-mark" aria-hidden="true">
            NR
          </span>
          <span className="brand-copy">
            <strong>{settings.displayName ?? 'Nazca Railway'}</strong>
            <span>
              {L('The Encyclopedia of Los Sengas', '洛斯辛格斯百科全書')}
            </span>
          </span>
        </button>

        <div className="global-search-wrap">
          <SearchWorkbench
            surfaceId="global-atlas-search"
            label="Search the encyclopedia"
            placeholder="Search stations, lines, places, and articles"
            records={corpusSearch.length ? corpusSearch.map((record) => ({ id: record.id, title: record.displayTitle || record.title, subtitle: record.categories.slice(0, 3).join(' · ') || 'Article', text: `${record.title} ${record.displayTitle} ${record.aliases.join(' ')} ${record.categories.join(' ')} ${record.excerpt}` })) : searchRecords}
            onActivate={activateSearchRecord}
          />
        </div>

        <div className="header-actions">
          <div
            className="version-chip"
            aria-label={`Version ${provenance.version}. Updated ${updatedAt}.`}
          >
            <strong>v{provenance.version}</strong>
            <span>{updatedAt}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={L('Open command palette', '開啟指令面板')}
            onClick={() => setPaletteOpen(true)}
          >
            <Command size={19} aria-hidden="true" />
          </button>
          <button
            className="icon-button notification-button"
            type="button"
            aria-label={L('Open notifications', '開啟通知')}
            onClick={() => router.push(publicPath('/?tab=notifications'))}
          >
            <Bell size={19} aria-hidden="true" />
            {notifications.some((notification) => !notification.dismissed) ? (
              <span className="notification-badge" aria-hidden="true" />
            ) : null}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={
              settings.theme === 'dark'
                ? L('Use light theme', '用淺色主題')
                : L('Use dark theme', '用深色主題')
            }
            aria-pressed={settings.theme === 'dark'}
            onClick={() =>
              updateSettings({
                theme: settings.theme === 'dark' ? 'light' : 'dark',
              })
            }
          >
            {settings.theme === 'dark' ? (
              <Sun size={19} aria-hidden="true" />
            ) : (
              <Moon size={19} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <div className="route-color-bar home-route-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="shell-grid">
        <nav className="tab-dock" aria-label="Atlas tabs">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="dock-label">
                {group.label === 'Reader'
                  ? L('Reader', '閱讀')
                  : group.label === 'Atlas'
                    ? L('Atlas', '圖鑑')
                    : L('Research', '研究')}
              </p>
              <div className="tab-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const selected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="tab-button"
                      aria-current={selected ? 'page' : undefined}
                      title={tabLabel(item.id, item.label)}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <span className="tab-icon">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span>{tabLabel(item.id, item.label)}</span>
                      {item.count ? (
                        <span className="tab-count">{item.count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <main id="main-content" className="main-viewport" tabIndex={-1}>
          {activeTab === 'settings' ? (
            <SettingsWorkspace />
          ) : ['tools', 'history', 'changelog', 'help'].includes(activeTab) ? (
            <ToolsWorkspace
              initialTab={
                activeTab === 'history'
                  ? 'history'
                  : activeTab === 'changelog'
                    ? 'changelog'
                      : activeTab === 'help'
                        ? 'help'
                        : requestedTool ?? 'authenticator'
              }
            />
          ) : activeTab === 'status' ? (
            <StatusWorkspace provenance={provenance} />
          ) : activeTab === 'search' ? (
            <CorpusSearchDestination records={corpusSearch} onOpen={openCorpusRecord} />
          ) : ['explore', 'stations', 'lines', 'places', 'streetcars'].includes(activeTab) ? (
            <CorpusDestination
              eyebrow={tabLabel(activeTab, selectedLabel)}
              title={tabLabel(activeTab, selectedLabel)}
              description={
                activeTab === 'explore'
                  ? 'Browse the generated current reader index. Every result opens its exact static article route.'
                  : 'Browse records from the generated current reader index. Selecting a record opens its exact static article route.'
              }
              records={destinationRecords(activeTab)}
              onOpen={openCorpusRecord}
            />
          ) : activeTab === 'maps' ? (
            <SimpleWorkspace
              eyebrow="Maps"
              title="Map records are retained, rendering is deferred."
              description="The current source inventory includes three map records. Interactive map rendering remains pending stable source reconciliation."
              cards={[
                { id: 'map-inventory', title: 'Three source map records', body: 'The inventory is available for later reconciliation. No map image or guessed geometry is presented here.' },
                { id: 'map-status', title: 'Current status', body: 'Map rendering is deferred until source policy and stable cutoff checks complete.' },
              ]}
            />
          ) : activeTab === 'timeline' ? (
            <SimpleWorkspace
              eyebrow="Timeline"
              title="Timeline records are not in this snapshot."
              description="Historical revision history is explicitly deferred, so this destination reports the boundary instead of repeating Home content."
              cards={[
                { id: 'timeline-status', title: 'Historical revisions deferred', body: 'No timeline records are fabricated from the current-only capture.' },
              ]}
            />
          ) : activeTab === 'media' ? (
            <SimpleWorkspace
              eyebrow="Media catalog"
              title="Media with rights attached."
              description="The planning inventory contains 16,555 current media objects. Original bytes remain unimported until the source policy and release-backed storage checks pass."
              cards={[
                {
                  id: 'media-catalog',
                  title: 'Catalog',
                  body: 'Planning inventory only. Final SHA-1, SHA-256, MIME, dimensions, variants, and exact-tag URLs remain pending.',
                },
                {
                  id: 'media-rights',
                  title: 'Rights',
                  body: 'Every future public object requires one creator, attribution, permission basis, obligation, and takedown record.',
                },
                {
                  id: 'media-volumes',
                  title: 'Volumes',
                  body: 'Immutable release volumes are limited to 900 objects and 1 GiB. None are published yet.',
                },
              ]}
            />
          ) : activeTab === 'infrastructure' ? (
            <SimpleWorkspace
              eyebrow="Infrastructure"
              title="Structures, roads, bridges, and depots."
              description="This destination is ready for imported infrastructure records. Current cards are explicit scope markers, not invented source articles."
              cards={[
                {
                  id: 'infra-rail',
                  title: 'Railway structures',
                  body: 'Stations, depots, yards, junctions, and operational structures will come from the stable source manifest.',
                },
                {
                  id: 'infra-road',
                  title: 'Roads and bridges',
                  body: 'Road and bridge records remain pending source import and category reconciliation.',
                },
                {
                  id: 'infra-air',
                  title: 'Air and port connections',
                  body: 'Airport and container-terminal links will preserve source relationships without guessed destinations.',
                },
              ]}
            />
          ) : activeTab === 'about' ? (
            <SimpleWorkspace
              eyebrow="About this reader"
              title="Nazca Railway · The Encyclopedia of Los Sengas"
              description="A static reader and transit atlas, not the original source platform and not a live synchronization service."
              cards={[
                {
                  id: 'about-source',
                  title: 'Legacy source',
                  body: 'Fandom remains credited. This repository becomes canonical only at a stable imported cutoff.',
                },
                {
                  id: 'about-browser',
                  title: 'Browser boundary',
                  body: 'Visitor settings remain local. The website does not claim native vault, arbitrary executable, or unrestricted file-system powers.',
                },
                {
                  id: 'about-version',
                  title: `Version ${provenance.version}`,
                  body: `Build commit ${provenance.commitSha ?? 'unavailable'} · ${provenance.builtAt ?? 'updated time unavailable'}`,
                },
              ]}
            />
          ) : (
            <div className="route-content home-overview">
              <section className="home-welcome" aria-labelledby="home-heading">
                <div className="home-welcome-copy">
                  <p className="home-kicker">
                    <span aria-hidden="true" />
                    {L('Independent static encyclopedia', '獨立靜態百科全書')}
                  </p>
                  <h1 id="home-heading" className="home-title">
                    {L(
                      'Find your way through Los Sengas.',
                      '搵到你嘅洛斯辛格斯路線。',
                    )}
                  </h1>
                  <p className="home-intro">
                    {L(
                      'A reorganized, reader-first home for railway lines, stations, places, infrastructure, and history. No advertising columns, fandom chrome, or maze of unrelated links.',
                      '以讀者為先，重新整理鐵路線、車站、地點、基建同歷史。冇廣告欄，冇社群網站雜亂介面，搵資料唔使行迷宮。',
                    )}
                  </p>
                  <div className="home-actions">
                    <button
                      type="button"
                      className="home-primary-action"
                      onClick={() => setActiveTab('search')}
                    >
                      <Search size={18} aria-hidden="true" />
                      {L('Search the encyclopedia', '搜尋百科全書')}
                    </button>
                    <button
                      type="button"
                      className="home-secondary-action"
                      onClick={() => setActiveTab('explore')}
                    >
                      {L('Browse all articles', '瀏覽所有文章')}
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div
                  className="home-at-a-glance"
                  aria-label="Current reader at a glance"
                >
                  <p>Current reader</p>
                  <strong>3,422</strong>
                  <span>captured articles</span>
                  <dl>
                    <div>
                      <dt>Routes</dt>
                      <dd>3,616</dd>
                    </div>
                    <div>
                      <dt>Redirects</dt>
                      <dd>194</dd>
                    </div>
                    <div>
                      <dt>Reader shards</dt>
                      <dd>54</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section
                className="home-directory"
                aria-labelledby="directory-heading"
              >
                <div className="section-heading directory-heading">
                  <div>
                    <p className="section-overline">Directory</p>
                    <h2 id="directory-heading">Browse by subject</h2>
                  </div>
                  <span>Clear routes into the archive</span>
                </div>
                <div className="directory-grid">
                  {quickLinks.map((link, index) => {
                    const DirectoryIcon = [
                      TrainFront,
                      Layers3,
                      Building2,
                      Landmark,
                    ][index];
                    return (
                      <button
                        key={link.label}
                        type="button"
                        className="directory-card"
                        onClick={() => setActiveTab(link.tab)}
                      >
                        <span
                          className="directory-icon"
                          style={{ color: link.color }}
                        >
                          <DirectoryIcon size={21} aria-hidden="true" />
                        </span>
                        <span className="directory-copy">
                          <strong>{tabLabel(link.tab, link.label)}</strong>
                          <small>{link.meta}</small>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="home-reading-grid">
                <section
                  className="home-featured"
                  aria-labelledby="featured-heading"
                >
                  <div className="section-heading">
                    <div>
                      <p className="section-overline">
                        Recommended starting points
                      </p>
                      <h2 id="featured-heading">Featured records</h2>
                    </div>
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => setActiveTab('explore')}
                    >
                      View index <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <ul className="featured-records">
                    {records.slice(0, 6).map((record, index) => (
                      <li key={record.id}>
                        <button
                          type="button"
                          onClick={() => openRecord(record)}
                          aria-label={`Open ${record.title}`}
                        >
                          <span className="featured-number">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span
                            className="route-dot"
                            style={{ color: record.color }}
                            aria-hidden="true"
                          />
                          <span className="record-copy">
                            <strong>{record.title}</strong>
                            <small>
                              {record.kind} · {record.detail}
                            </small>
                          </span>
                          <ChevronRight size={17} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <aside className="home-notes" aria-label="Reader notes">
                  <section>
                    <p className="section-overline">Why this reader</p>
                    <h2>Built for reading, not engagement</h2>
                    <p>
                      Content is arranged around subjects and records, with calm
                      navigation, local search, readable tables, and no
                      advertising rail.
                    </p>
                  </section>
                  <section>
                    <p className="section-overline">Source &amp; scope</p>
                    <h2>Preserved with attribution</h2>
                    <p>
                      Fandom remains the credited legacy source under CC BY-SA.
                      This current snapshot is not a live synchronization
                      service.
                    </p>
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => setActiveTab('about')}
                    >
                      Read project notes{' '}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                  </section>
                  <section className="snapshot-note">
                    <span className="status-dot" aria-hidden="true" />
                    <div>
                      <strong>Current snapshot</strong>
                      <small>
                        Media and historical revisions remain deferred.
                      </small>
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          )}
        </main>

        <aside className="right-rail" aria-label="Provenance and status">
          <section className="rail-card">
            <h2>Source provenance</h2>
            <p>
              Fandom remains the credited legacy source. This repository becomes
              canonical at the stable import cutoff.
            </p>
            <table className="source-table">
              <tbody>
                <tr>
                  <th scope="row">Source</th>
                  <td>enlossengas.fandom.com</td>
                </tr>
                <tr>
                  <th scope="row">Text license</th>
                  <td>CC BY-SA</td>
                </tr>
                <tr>
                  <th scope="row">Planning capture</th>
                  <td>31 Aug 2026</td>
                </tr>
                <tr>
                  <th scope="row">Final cutoff</th>
                  <td>Pending stable import</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section className="rail-card">
            <h2>Implementation status</h2>
            <p>
              The Sites foundation is active. Corpus, media, universal features,
              verification, and public delivery remain in progress.
            </p>
            <div className="status-line">
              <span className="status-dot" aria-hidden="true" /> Running · first
              atlas slice
            </div>
          </section>
          <section className="rail-card">
            <h2>Modern by design</h2>
            <p>
              One navigation model, calm product chrome, route colours as data,
              no advertising, readable tables, and search wherever information
              lives.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
