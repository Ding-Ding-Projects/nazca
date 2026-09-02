'use client';

import { ArrowLeft, ExternalLink, History } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SearchWorkbench, type SearchRecord } from '@/components/search-workbench';
import type { CurrentArticleRecordV1 } from '@/lib/contracts';
import { formatBuildTime, type BuildProvenance } from '@/lib/provenance';
import { publicPath } from '@/lib/public-path';

export function ArticleReader({ record, provenance }: { record: CurrentArticleRecordV1; provenance: BuildProvenance }) {
  const [activeSection, setActiveSection] = useState(record.headings[0]?.id ?? 'article-content');
  const [updatedAt, setUpdatedAt] = useState(() => formatBuildTime(provenance.builtAt));
  useEffect(() => { const timer = setTimeout(() => setUpdatedAt(formatBuildTime(provenance.builtAt, true)), 0); return () => clearTimeout(timer); }, [provenance.builtAt]);
  const searchRecords: SearchRecord[] = record.headings.map((heading) => ({ id: heading.id, title: heading.heading, subtitle: `Heading ${heading.level}`, text: `${heading.heading} ${heading.markdown}` }));
  return (
    <main className="article-page" id="main-content">
      <a className="skip-link" href="#article-content">Skip to article content</a>
      <header className="article-topbar">
        <Link href={publicPath('/')} className="article-back"><ArrowLeft size={18} aria-hidden="true" />Atlas home</Link>
        <div className="article-version">v{provenance.version} · updated {updatedAt}</div>
      </header>
      <div className="article-layout">
        <aside className="article-sections" aria-label="Article sections">
          <SearchWorkbench surfaceId="nazca-article-search" label="Search this article" placeholder="Find a section" records={searchRecords} compact onActivate={(section) => { setActiveSection(section.id); document.getElementById(section.id)?.scrollIntoView({ block: 'start' }); }} />
          <nav className="article-section-tabs" aria-label="Article sections">
            {record.headings.map((heading) => <button key={heading.id} type="button" aria-current={heading.id === activeSection ? 'page' : undefined} onClick={() => { setActiveSection(heading.id); document.getElementById(heading.id)?.scrollIntoView({ block: 'start' }); }}>{heading.heading}</button>)}
          </nav>
        </aside>
        <article className="article-body" id="article-content">
          <p className="eyebrow">Nazca Railway · current source snapshot</p>
          <h1>{record.displayTitle}</h1>
          <p className="article-subtitle">Current article body captured from the source at revision {record.currentRevisionId}. This reader is a static, sanitized presentation.</p>
          <nav className="article-meta-tabs" aria-label="Article views"><a href="#read" aria-current="page">Read</a><a href="#source">Source and attribution</a><a href="#history"><History size={15} aria-hidden="true" /> History boundary</a></nav>
          <section id="read" className="article-section"><div className="article-rendered-content" dangerouslySetInnerHTML={{ __html: record.safeHtml }} /></section>
          <section id="source" className="article-source-card">
            <div><h2>Source and attribution</h2><p>Source: <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">Fandom revision {record.currentRevisionId}</a>. Text is presented under the source CC BY-SA terms.</p><p>Revision timestamp: {record.timestamp}. Contributor: {record.contributorState === 'visible' ? record.contributor : 'hidden or unavailable'}.</p><p>Capture window is recorded in the release manifest. Historical revisions, maps, and media bytes remain outside this current snapshot.</p></div><a href={record.sourceUrl} target="_blank" rel="noopener noreferrer external" referrerPolicy="no-referrer">Open exact source revision <ExternalLink size={15} aria-hidden="true" /></a>
          </section>
          <section id="history" className="article-source-card"><div><h2>History boundary</h2><p>This release includes the current revision only. Complete revision history is explicitly deferred.</p>{record.deferredMedia.length ? <p>Media deferred: {record.deferredMedia.join(', ')}.</p> : <p>No source media file titles were referenced in this article.</p>}</div></section>
        </article>
      </div>
    </main>
  );
}
