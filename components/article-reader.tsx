'use client';

import {
  Bell,
  BookOpen,
  Building2,
  CircleGauge,
  Clock3,
  Command,
  Compass,
  ExternalLink,
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
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SearchWorkbench, type SearchRecord } from '@/components/search-workbench';
import { useVisitorState } from '@/components/visitor-state-provider';
import type { CurrentArticleRecordV1 } from '@/lib/contracts';
import { labels, localize } from '@/lib/i18n';
import { publishedMediaAssetForTitle } from '@/lib/media-volumes';
import { formatBuildTime, type BuildProvenance } from '@/lib/provenance';
import { publicPath } from '@/lib/public-path';

type ReaderDestination = {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: string;
};

type ArticlePresentation = 'generic' | 'station' | 'year';

const readerGroups: Array<{ label: string; items: ReaderDestination[] }> = [
  {
    label: 'Reader',
    items: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'explore', label: 'Explore', icon: Compass },
      { id: 'stations', label: 'Stations', icon: TrainFront, count: '1.2k' },
      { id: 'lines', label: 'Lines', icon: Layers3, count: '156' },
      { id: 'infrastructure', label: 'Infrastructure', icon: Landmark },
    ],
  },
  {
    label: 'Atlas',
    items: [
      { id: 'places', label: 'Places', icon: Building2 },
      { id: 'maps', label: 'Maps', icon: Map, count: '3' },
      { id: 'timeline', label: 'Timeline', icon: Clock3 },
      { id: 'streetcars', label: 'Streetcars', icon: TramFront, count: '581' },
      { id: 'media', label: 'Media', icon: Image, count: '16.5k' },
    ],
  },
  {
    label: 'Research',
    items: [
      { id: 'history', label: 'History', icon: History },
      { id: 'changelog', label: 'Changelog', icon: ScrollText, count: '6' },
      { id: 'status', label: 'Status', icon: CircleGauge },
      { id: 'tools', label: 'Tools', icon: Wrench },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help', icon: BookOpen },
      { id: 'about', label: 'About', icon: Info },
    ],
  },
];

function articleHtmlForSurface(html: string) {
  return html
    .replace(/href="(\/wiki\/[^\"]*)"/g, (_, pathname: string) => `href="${publicPath(pathname)}"`)
    .replace(/<span class="mw-editsection-bracket">[\s\S]*?<\/span>/g, '')
    .replace(/<span class="mw-editsection">[\s\S]*?<\/span>/g, '')
    .replace(/<div id="toc"[\s\S]*?<\/div>\s*<\/div>/g, '');
}

function displayLabel(id: string, fallback: string, languageMode: 'en' | 'zh-HK' | 'bilingual') {
  const pair = labels[id as keyof typeof labels];
  return pair ? localize(pair[0], pair[1], languageMode) : fallback;
}

function articlePresentation(record: CurrentArticleRecordV1): ArticlePresentation {
  if (/^\d{4}$/.test(record.displayTitle.trim()) || record.categories.some((category) => category.toLocaleLowerCase() === 'years')) {
    return 'year';
  }
  if (record.displayTitle.toLocaleLowerCase().endsWith(' station') || record.categories.some((category) => category.toLocaleLowerCase().includes('station'))) {
    return 'station';
  }
  return 'generic';
}

function DeferredMediaNotice({ titles }: { titles: string[] }) {
  if (!titles.length) return <p>No source media file titles were referenced in this article.</p>;
  return (
    <p>
      Media deferred:{' '}
      {titles.map((title, index) => {
        const asset = publishedMediaAssetForTitle(title);
        const separator = index < titles.length - 1 ? ', ' : '';
        return asset ? (
          <span key={title}>
            <a href={asset.immutableUrl} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">{title}</a>{separator}
          </span>
        ) : (
          <span key={title}>{title}{separator}</span>
        );
      })}
      .
    </p>
  );
}

export function ArticleReader({
  record,
  provenance,
}: {
  record: CurrentArticleRecordV1;
  provenance: BuildProvenance;
}) {
  const router = useRouter();
  const { notifications, setPaletteOpen, state, text, updateSettings } = useVisitorState();
  const settings = state.settings;
  const languageMode = settings.schoolMode.enabled ? 'en' : settings.languageMode;
  const L = (english: string, cantonese: string) => text(localize(english, cantonese, languageMode));
  const presentation = articlePresentation(record);
  const [activeSection, setActiveSection] = useState(record.headings[0]?.id ?? 'article-content');
  const [updatedAt, setUpdatedAt] = useState(() => formatBuildTime(provenance.builtAt));

  useEffect(() => {
    const timer = setTimeout(() => setUpdatedAt(formatBuildTime(provenance.builtAt, true)), 0);
    return () => clearTimeout(timer);
  }, [provenance.builtAt]);

  const searchRecords = useMemo<SearchRecord[]>(
    () => record.headings.map((heading) => ({
      id: heading.id,
      title: heading.heading.replace(/\s*\[\s*\]\s*$/, ''),
      subtitle: `Section · level ${heading.level}`,
      text: `${heading.heading} ${heading.markdown}`,
    })),
    [record.headings],
  );

  const openSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const navigateDestination = (destination: string) => {
    if (destination === 'home') {
      router.push(publicPath('/'));
      return;
    }
    router.push(publicPath(`/?tab=${encodeURIComponent(destination)}`));
  };

  const focusArticle = () => {
    const target = document.getElementById('article-content');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="article-app-shell" data-element-id="article-shell" data-element-kind="page">
      <a className="skip-link" href="#article-content">Skip to article content</a>
      <header className="top-bar article-app-bar" aria-label="Nazca Railway header">
        <button className="brand" type="button" onClick={() => navigateDestination('home')} aria-label="Open Nazca Railway home">
          <span className="brand-mark" aria-hidden="true">NR</span>
          <span className="brand-copy">
            <strong>{settings.displayName ?? 'Nazca Railway'}</strong>
            <span>{L('The Encyclopedia of Los Sengas', '洛斯辛格斯百科全書')}</span>
          </span>
        </button>
        <div className="global-search-wrap">
          <SearchWorkbench
            surfaceId="article-global-search"
            label="Search this article"
            placeholder="Find a section in this article"
            records={searchRecords}
            onActivate={(section) => openSection(section.id)}
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
          <button className="icon-button notification-button" type="button" aria-label={L('Open notifications', '開啟通知')} onClick={() => router.push(publicPath('/?tab=notifications'))}>
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
          {readerGroups.map((group) => (
            <div key={group.label}>
              <p className="dock-label">{L(group.label, group.label === 'Reader' ? '閱讀' : group.label === 'Atlas' ? '圖鑑' : '研究')}</p>
              <div className="tab-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" className="tab-button" title={displayLabel(item.id, item.label, languageMode)} onClick={() => navigateDestination(item.id)}>
                      <span className="tab-icon"><Icon size={18} aria-hidden="true" /></span>
                      <span>{displayLabel(item.id, item.label, languageMode)}</span>
                      {item.count ? <span className="tab-count">{item.count}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <main className="article-main-viewport" id="main-content" tabIndex={-1}>
          <div className="article-layout article-layout-reference">
            <article className={`article-body article-body-${presentation}`} id="article-content" tabIndex={-1} data-reader-state={`article-${presentation}`}>
              <nav className="article-breadcrumbs" aria-label="Breadcrumb">
                <button type="button" onClick={() => navigateDestination('home')}>Atlas</button>
                <span aria-hidden="true">›</span>
                <span>{presentation === 'station' ? 'Stations' : presentation === 'year' ? 'Years' : 'Current reader'}</span>
                <span aria-hidden="true">›</span>
                <strong>{record.displayTitle}</strong>
              </nav>
              <p className="eyebrow article-eyebrow"><span aria-hidden="true" />{presentation === 'station' ? 'STATION · CURRENT SNAPSHOT' : presentation === 'year' ? 'YEAR · CURRENT SNAPSHOT' : 'CURRENT ARTICLE · SOURCE SNAPSHOT'}</p>
              <h1 className={presentation === 'year' ? 'article-year-heading' : undefined}>{record.displayTitle}</h1>
              <p className="article-subtitle">{presentation === 'station' ? 'A captured station record from the current reader index.' : presentation === 'year' ? 'A captured year record from the current reader index.' : 'Current article body captured from the source.'} Revision <code>{record.currentRevisionId}</code>. This reader is a static, sanitized presentation.</p>
              {presentation !== 'generic' ? (
                <section className="reader-fact-grid" aria-label={presentation === 'station' ? 'Station record facts' : 'Year record facts'}>
                  <div className="reader-fact-card reader-fact-card-primary">
                    <span className="reader-fact-label">{presentation === 'station' ? 'STATION RECORD' : 'YEAR RECORD'}</span>
                    <strong>{record.displayTitle}</strong>
                    <span>{record.plainTextExcerpt.slice(0, 220)}{record.plainTextExcerpt.length > 220 ? '…' : ''}</span>
                  </div>
                  <div className="reader-fact-card">
                    <span className="reader-fact-label">CATEGORIES</span>
                    <div className="reader-fact-tags">
                      {record.categories.length ? record.categories.slice(0, 8).map((category) => <span key={category}>{category}</span>) : <span>None captured</span>}
                    </div>
                  </div>
                  <div className="reader-fact-card">
                    <span className="reader-fact-label">SOURCE BOUNDARY</span>
                    <strong>Revision {record.currentRevisionId}</strong>
                    <span>{record.deferredMedia.length ? `${record.deferredMedia.length} media references deferred` : 'No media references deferred'}</span>
                  </div>
                </section>
              ) : null}
              <div className="article-meta-tabs" role="tablist" aria-label="Article views">
                <a href="#read" aria-current="page">Read</a>
                <a href="#source">Source and attribution</a>
                <a href="#history"><History size={15} aria-hidden="true" /> History boundary</a>
              </div>
              <section id="read" className="article-section">
                {presentation !== 'generic' ? <h2 className="reader-captured-heading">Captured source content</h2> : null}
                <div className="article-rendered-content" dangerouslySetInnerHTML={{ __html: articleHtmlForSurface(record.safeHtml) }} />
              </section>
              <section id="source" className="article-source-card">
                <div>
                  <h2>Source and attribution</h2>
                  <p>Source: <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">Fandom revision {record.currentRevisionId}</a>. Text is presented under the source CC BY-SA terms.</p>
                  <p>Revision timestamp: {record.timestamp}. Contributor: {record.contributorState === 'visible' ? record.contributor : 'hidden or unavailable'}.</p>
                  <p>Historical revisions, maps, and media bytes remain outside this current snapshot.</p>
                </div>
                <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">Open exact source revision <ExternalLink size={15} aria-hidden="true" /></a>
              </section>
              <section id="history" className="article-source-card">
                <div>
                  <h2>History boundary</h2>
                  <p>This release includes the current revision only. Complete revision history is explicitly deferred.</p>
                  <DeferredMediaNotice titles={record.deferredMedia} />
                </div>
              </section>
            </article>

            <aside className="article-right-rail" aria-label="Article summary">
              <section className="article-summary-card">
                <p className="article-card-label">{presentation === 'station' ? 'STATION AT A GLANCE' : presentation === 'year' ? 'YEAR AT A GLANCE' : 'ARTICLE AT A GLANCE'}</p>
                <dl>
                  <div><dt>Title</dt><dd>{record.displayTitle}</dd></div>
                  <div><dt>Sections</dt><dd>{record.headings.length}</dd></div>
                  <div><dt>Revision</dt><dd>{record.currentRevisionId}</dd></div>
                  <div><dt>Captured</dt><dd>{record.timestamp}</dd></div>
                  <div><dt>Media</dt><dd>{record.deferredMedia.length ? `${record.deferredMedia.length} deferred` : 'None referenced'}</dd></div>
                </dl>
              </section>
              <section className="article-section-card">
                <p className="article-card-label">SECTIONS</p>
                <nav className="article-section-links" aria-label="Article section links">
                  {record.headings.slice(0, 18).map((heading) => (
                    <button key={heading.id} type="button" aria-current={heading.id === activeSection ? 'page' : undefined} onClick={() => openSection(heading.id)}>
                      <span>{heading.heading.replace(/\s*\[\s*\]\s*$/, '')}</span>
                      <span aria-hidden="true">›</span>
                    </button>
                  ))}
                </nav>
              </section>
            </aside>
          </div>
        </main>
      </div>
      <nav className="reader-bottom-nav" aria-label="Reader quick navigation">
        <button type="button" onClick={() => navigateDestination('home')}><Home size={19} aria-hidden="true" /><span>Home</span></button>
        <button type="button" onClick={() => navigateDestination('stations')}><TrainFront size={19} aria-hidden="true" /><span>Stations</span></button>
        <button type="button" onClick={() => document.getElementById('article-global-search-input')?.focus()}><Search size={19} aria-hidden="true" /><span>Search</span></button>
        <button type="button" onClick={focusArticle}><BookOpen size={19} aria-hidden="true" /><span>Reading</span></button>
      </nav>
    </div>
  );
}
