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
      className="app-shell"
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
              <section className="home-hero" aria-labelledby="home-heading">
                <div className="home-hero-copy">
                  <p className="home-kicker">
                    <span aria-hidden="true" />
                    {L('Static reader · current snapshot', '靜態閱讀器 · 目前快照')}
                  </p>
                  <h1 id="home-heading" className="home-title">
                    {activeTab === 'home'
                      ? L('The Encyclopedia of Los Sengas', '洛斯辛格斯百科全書')
                      : tabLabel(activeTab, selectedLabel)}
                  </h1>
                  <p className="home-intro">
                    {L(
                      'A clarity-first reader for the Los Sengas transport encyclopedia: searchable routes, readable railway tables, permanent attribution, and no advertising rails.',
                      '清晰易用嘅洛斯辛格斯交通百科：路線可搜尋、鐵路表格易讀、來源註明永久保留，冇廣告欄位阻住你。',
                    )}
                  </p>
                </div>
                <div className="home-hero-art" aria-hidden="true">
                  <span className="hero-orbit hero-orbit-blue" />
                  <span className="hero-orbit hero-orbit-green" />
                  <span className="hero-orbit hero-orbit-gold" />
                  <span className="hero-orbit hero-orbit-red" />
                  <span className="hero-hub">NR</span>
                  <span className="hero-node hero-node-one" />
                  <span className="hero-node hero-node-two" />
                  <span className="hero-node hero-node-three" />
                </div>
              </section>

              <section className="quick-grid home-destinations" aria-labelledby="destinations-heading">
                <div className="section-heading destination-heading">
                  <div>
                    <p className="section-overline">Explore</p>
                    <h2 id="destinations-heading">Choose a destination</h2>
                  </div>
                  <span>Four indexed views</span>
                </div>
                <div className="destination-card-grid">
                  {quickLinks.map((link) => (
                    <button
                      key={link.label}
                      type="button"
                      className="quick-card destination-card"
                      aria-label={tabLabel(link.tab, link.label)}
                      onClick={() => setActiveTab(link.tab)}
                    >
                      <span className="destination-card-top">
                        <span className="route-dot" style={{ color: link.color }} aria-hidden="true" />
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{tabLabel(link.tab, link.label)}</strong>
                        <span>{link.meta}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="home-grid home-grid-reference">
                <div className="home-main-column">
                  <section className="content-card useful-record-card" aria-labelledby="recent-heading">
                    <div className="section-heading">
                      <div>
                        <p className="section-overline">Reader index</p>
                        <h2 id="recent-heading">Start with a useful record</h2>
                      </div>
                      <span>{records.length} featured</span>
                    </div>
                    <ul className="recent-list">
                      {records.slice(0, 6).map((record) => (
                        <li key={record.id}>
                          <button type="button" className="recent-item" aria-label={record.title} onClick={() => openRecord(record)}>
                            <span className="route-dot" style={{ color: record.color }} aria-hidden="true" />
                            <span className="record-copy">
                              <strong>{record.title}</strong>
                              <span>{record.kind} · {record.detail}</span>
                            </span>
                            <ChevronRight size={17} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="content-card corpus-baseline-card" aria-labelledby="corpus-heading">
                    <div className="section-heading">
                      <div>
                        <p className="section-overline">Evidence</p>
                        <h2 id="corpus-heading">Pinned corpus baseline</h2>
                      </div>
                      <span className="baseline-mark" aria-hidden="true" />
                    </div>
                    <div className="baseline-stats">
                      <div className="baseline-stat"><strong>3,422</strong><span>articles</span></div>
                      <div className="baseline-stat"><strong>194</strong><span>redirects</span></div>
                      <div className="baseline-stat"><strong>3,616</strong><span>routes</span></div>
                      <div className="baseline-stat"><strong>54</strong><span>reader shards</span></div>
                      <div className="baseline-stat baseline-stat-warning"><strong>16,555</strong><span>media deferred</span></div>
                    </div>
                    <p className="baseline-note">The importer recaptures and reconciles one stable cutoff before this repository becomes canonical. Historical revisions, media bytes, and maps remain outside the current snapshot.</p>
                  </section>
                </div>

                <div className="home-side-column">
                  <section className="map-card network-card" aria-labelledby="map-heading">
                    <div className="map-card-header">
                      <div>
                        <p className="section-overline">Held for reconciliation</p>
                        <h2 id="map-heading">Network map</h2>
                        <p>Three source map records held back</p>
                      </div>
                      <Map size={20} aria-hidden="true" />
                    </div>
                    <div className="network-placeholder">
                      <span>network map · route diagram deferred</span>
                    </div>
                  </section>

                  <section className="content-card provenance-card" aria-labelledby="provenance-heading">
                    <div className="section-heading">
                      <div>
                        <p className="section-overline">Source record</p>
                        <h2 id="provenance-heading">Source provenance</h2>
                      </div>
                      <span className="status-dot" aria-label="Pending stable import" />
                    </div>
                    <dl className="provenance-list">
                      <div><dt>Source</dt><dd>enlossengas.fandom.com</dd></div>
                      <div><dt>Text licence</dt><dd>CC BY-SA</dd></div>
                      <div><dt>Capture</dt><dd>31 Aug 2026</dd></div>
                      <div><dt>Final cutoff</dt><dd className="provenance-pending">Pending stable import</dd></div>
                    </dl>
                  </section>

                  <section className="content-card status-strip" aria-label="Implementation status">
                    <span className="status-dot" aria-hidden="true" />
                    <span><strong>Running</strong><small>first atlas slice</small></span>
                  </section>
                </div>
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
