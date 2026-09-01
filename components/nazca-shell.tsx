'use client';

import {
  Building2,
  Clock3,
  Compass,
  History,
  Home,
  Layers3,
  Map,
  Moon,
  Search,
  Settings,
  Sun,
  TramFront,
  TrainFront,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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

function normalized(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase();
}

function recordText(record: AtlasRecord) {
  return `${record.title} ${record.kind} ${record.detail}`;
}

export function NazcaShell({ provenance }: { provenance: BuildProvenance }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [query, setQuery] = useState('');
  const [regexOpen, setRegexOpen] = useState(false);
  const [pattern, setPattern] = useState('Nazca|Station|Line');
  const [flags, setFlags] = useState('i');
  const [dark, setDark] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const regexButton = useRef<HTMLButtonElement>(null);
  const patternInput = useRef<HTMLInputElement>(null);
  const updatedAt = formatBuildTime(provenance.builtAt);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);

  useEffect(() => {
    if (regexOpen) patternInput.current?.focus();
  }, [regexOpen]);

  const closeRegex = () => {
    setRegexOpen(false);
    regexButton.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === 'Escape' && regexOpen) {
        closeRegex();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [regexOpen]);

  const regexPreview = useMemo(() => {
    if (!regexOpen)
      return { results: [] as AtlasRecord[], error: null as string | null };
    try {
      const expression = new RegExp(pattern, flags.replaceAll('g', ''));
      return {
        results: records.filter((record) =>
          expression.test(recordText(record)),
        ),
        error: null,
      };
    } catch (error) {
      return {
        results: [] as AtlasRecord[],
        error:
          error instanceof Error ? error.message : 'The pattern is invalid.',
      };
    }
  }, [flags, pattern, regexOpen]);

  const plainResults = useMemo(() => {
    const needle = normalized(query.trim());
    if (!needle) return [];
    return records.filter((record) =>
      normalized(recordText(record)).includes(needle),
    );
  }, [query]);

  const selectedLabel =
    groups.flatMap((group) => group.items).find((item) => item.id === activeTab)
      ?.label ?? 'Explore';

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
    setQuery('');
    setRegexOpen(false);
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
            <strong>Nazca Railway</strong>
            <span>The Encyclopedia of Los Sengas</span>
          </span>
        </button>

        <div className="global-search-wrap" role="search">
          <label className="sr-only" htmlFor="global-search">
            Search the encyclopedia
          </label>
          <div className="search-row">
            <input
              ref={searchInput}
              id="global-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search stations, lines, places, and articles"
              aria-controls={
                query.trim() && !regexOpen ? 'global-search-results' : undefined
              }
            />
            <button
              ref={regexButton}
              type="button"
              aria-label="Open regular expression builder"
              aria-expanded={regexOpen}
              aria-controls={regexOpen ? 'global-regex-builder' : undefined}
              onClick={() => setRegexOpen((value) => !value)}
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>

          {regexOpen ? (
            <section
              id="global-regex-builder"
              className="regex-popover"
              aria-label="Regular expression builder"
            >
              <div className="popover-title">
                <div>
                  <h2>Advanced regex builder</h2>
                  <p>Local preview for the current atlas records.</p>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Close regex builder"
                  onClick={closeRegex}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="regex-pattern">Pattern</label>
                  <input
                    ref={patternInput}
                    id="regex-pattern"
                    value={pattern}
                    onChange={(event) => setPattern(event.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="field">
                  <label htmlFor="regex-flags">Flags</label>
                  <input
                    id="regex-flags"
                    value={flags}
                    onChange={(event) => setFlags(event.target.value)}
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="regex-explanation" role="status">
                {regexPreview.error
                  ? `Pattern error: ${regexPreview.error}`
                  : `Valid pattern. ${regexPreview.results.length} local records match.`}
                <br />
                This first slice proves the anchored field. The complete build
                adds guided construction, capture tables, replacement preview,
                saved cases, profiling, and bounded worker evaluation.
              </div>
            </section>
          ) : null}

          {query.trim() && !regexOpen ? (
            <section
              id="global-search-results"
              className="search-results-popover"
              aria-label="Search results"
            >
              <div aria-live="polite" className="sr-only">
                {plainResults.length} results
              </div>
              {plainResults.length ? (
                <ul className="result-list">
                  {plainResults.map((record) => (
                    <li key={record.id}>
                      <button
                        className="result-item"
                        type="button"
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
              ) : (
                <p className="empty-result">
                  No atlas records match “{query}”.
                </p>
              )}
            </section>
          ) : null}
        </div>

        <div className="header-actions">
          <div
            className="version-chip"
            aria-label={`Version ${provenance.version}. Updated ${updatedAt}.`}
          >
            <strong>v{provenance.version}</strong>
            <span suppressHydrationWarning>{updatedAt}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            aria-pressed={dark}
            onClick={() => setDark((value) => !value)}
          >
            {dark ? (
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
              <p className="dock-label">{group.label}</p>
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
                      title={item.label}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <span className="tab-icon">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span>{item.label}</span>
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
          <div className="route-content">
            <p className="eyebrow">Nazca Railway atlas</p>
            <h1 className="page-title">
              {activeTab === 'home'
                ? 'Railways without the clutter.'
                : selectedLabel}
            </h1>
            <p className="lede">
              A modern, searchable home for the complete Los Sengas transport
              encyclopedia, with clear routes, readable tables, source history,
              and a focused map-first experience.
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
                    <strong>{link.label}</strong>
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
                      The final interactive view preserves all three source map
                      records and a complete text equivalent.
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
