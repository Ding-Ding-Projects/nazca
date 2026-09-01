'use client';

import {
  Bell,
  Building2,
  Clock3,
  Command,
  Compass,
  History,
  Home,
  Layers3,
  Map,
  Moon,
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
      { id: 'stations', label: 'Stations', icon: TrainFront, count: '1.2k' },
      { id: 'lines', label: 'Lines', icon: Layers3, count: '156' },
    ],
  },
  {
    label: 'Atlas',
    items: [
      { id: 'places', label: 'Places', icon: Building2, count: '' },
      { id: 'maps', label: 'Maps', icon: Map, count: '3' },
      { id: 'timeline', label: 'Timeline', icon: Clock3, count: '' },
      { id: 'streetcars', label: 'Streetcars', icon: TramFront, count: '581' },
    ],
  },
  {
    label: 'Research',
    items: [
      { id: 'history', label: 'History', icon: History, count: '' },
      { id: 'tools', label: 'Tools', icon: Wrench, count: '' },
      { id: 'settings', label: 'Settings', icon: Settings, count: '' },
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
    tab: 'explore',
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

export function NazcaShell({ provenance }: { provenance: BuildProvenance }) {
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
  const [updatedAt, setUpdatedAt] = useState(() =>
    formatBuildTime(provenance.builtAt),
  );

  useEffect(() => {
    setUpdatedAt(formatBuildTime(provenance.builtAt, true));
  }, [provenance.builtAt]);

  useEffect(() => {
    const navigate = (event: Event) => {
      const destination = (event as CustomEvent<string>).detail;
      setActiveTab(destination === 'notifications' ? 'tools' : destination);
      if (destination === 'notifications') {
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent('nazca:open-tool', { detail: 'notifications' }),
            ),
          0,
        );
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
    const record = records.find(
      (candidate) => candidate.id === searchRecord.id,
    );
    if (record) openRecord(record);
  };

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
            records={searchRecords}
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
            onClick={() => {
              setActiveTab('tools');
              setTimeout(
                () =>
                  window.dispatchEvent(
                    new CustomEvent('nazca:open-tool', {
                      detail: 'notifications',
                    }),
                  ),
                0,
              );
            }}
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
          ) : activeTab === 'tools' ? (
            <ToolsWorkspace />
          ) : (
            <div className="route-content">
              <p className="eyebrow">
                {L('Nazca Railway atlas', 'Nazca Railway 鐵路圖鑑')}
              </p>
              <h1 className="page-title">
                {activeTab === 'home'
                  ? localize(
                      settings.funnyLevelEnglish === 1
                        ? 'A clear railway encyclopedia.'
                        : 'Railways without the clutter.',
                      settings.funnyLevelCantonese === 1
                        ? '清晰嘅鐵路百科。'
                        : '清楚睇鐵路，唔使同雜亂版面搏鬥。',
                      languageMode,
                    )
                  : tabLabel(activeTab, selectedLabel)}
              </h1>
              <p className="lede">
                {L(
                  'A modern, searchable home for the complete Los Sengas transport encyclopedia, with clear routes, readable tables, source history, and a focused map-first experience.',
                  '一個現代、可搜尋嘅洛斯辛格斯交通百科首頁，路線清楚、表格易讀、來源歷史齊全，地圖放喺最有用嘅位置。',
                )}
              </p>

              <section
                className="quick-grid"
                aria-label="Explore the encyclopedia"
              >
                {quickLinks.map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    className="quick-card"
                    onClick={() => setActiveTab(link.tab)}
                  >
                    <span
                      className="route-dot"
                      style={{ color: link.color }}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{tabLabel(link.tab, link.label)}</strong>
                      <span>{link.meta}</span>
                    </span>
                  </button>
                ))}
              </section>

              <div className="home-grid">
                <section className="map-card" aria-labelledby="map-heading">
                  <div className="map-card-header">
                    <div>
                      <h2 id="map-heading">Metropolis network overview</h2>
                      <p>
                        The final interactive view preserves all three source
                        map records and a complete text equivalent.
                      </p>
                    </div>
                    <Map size={20} aria-hidden="true" />
                  </div>
                  <span className="map-label one">Metropolis</span>
                  <span className="map-label two">Arcgo</span>
                  <span className="map-label three">Oasis Bay</span>
                </section>

                <div className="content-stack">
                  <section
                    className="content-card"
                    aria-labelledby="corpus-heading"
                  >
                    <h2 id="corpus-heading">Pinned corpus baseline</h2>
                    <p>
                      The importer recaptures and reconciles one stable cutoff
                      before this repository becomes canonical.
                    </p>
                    <div className="stat-row">
                      <div className="stat">
                        <strong>3,422</strong>
                        <span>articles</span>
                      </div>
                      <div className="stat">
                        <strong>194</strong>
                        <span>redirects</span>
                      </div>
                      <div className="stat">
                        <strong>16,555</strong>
                        <span>media</span>
                      </div>
                    </div>
                  </section>

                  <section
                    className="content-card"
                    aria-labelledby="recent-heading"
                  >
                    <h2 id="recent-heading">Start with a useful record</h2>
                    <ul className="recent-list">
                      {records.slice(0, 3).map((record) => (
                        <li key={record.id}>
                          <button
                            type="button"
                            className="recent-item"
                            onClick={() => openRecord(record)}
                          >
                            <span
                              className="route-dot"
                              style={{ color: record.color }}
                              aria-hidden="true"
                            />
                            <span>
                              <strong>{record.title}</strong>
                              <span>
                                {record.kind} · {record.detail}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
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
