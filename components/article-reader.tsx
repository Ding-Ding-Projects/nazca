'use client';

import { ArrowLeft, ExternalLink, History } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import { formatBuildTime, type BuildProvenance } from '@/lib/provenance';
import { publicPath } from '@/lib/public-path';

type ArticleSection = {
  id: string;
  title: string;
  body: string[];
};

const sections: ArticleSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: [
      'Nazca Railway Los Sengas Division was established on March 15, 2015. Development began five days earlier, and the division became the largest rail transport operator in Los Sengas.',
      'Its networks span Los Sengas and connect major infrastructure including container terminals and Mayler Airport.',
    ],
  },
  {
    id: 'businesses',
    title: 'Businesses',
    body: [
      'The division operates regional, medium-capacity, heavy, commuter, airport, and personal rapid transit services.',
    ],
  },
  {
    id: 'standard-railway',
    title: 'Standard railway',
    body: [
      'The standard railway family includes core, circular, auxiliary, district, strategic, branch, and express services. Route numbers follow planning order rather than construction order.',
    ],
  },
  {
    id: 'veloduct',
    title: 'Veloduct',
    body: [
      'Ten commuter lines are presented as Veloduct services and are integrated into the standard railway map.',
    ],
  },
  {
    id: 'streetcar-light-rail',
    title: 'Streetcars and light rail',
    body: [
      'Street-running and light-rail records are indexed as a first-class atlas family, with dedicated stops, lines, maps, and operator relationships.',
    ],
  },
  {
    id: 'history-attribution',
    title: 'History and attribution',
    body: [
      'This article is adapted from The Encyclopedia of Los Sengas on Fandom. The final importer will preserve every accessible source revision, contributor, timestamp, and change notice at the pinned cutoff.',
    ],
  },
];

const lines = [
  ['1', 'West Ring Line', 'Core, circular', '37', '57.895 km'],
  ['2', 'East Ring Line', 'Core, circular', '62', '97.285 km'],
  ['3', 'Urban Line', 'Core', '15', '41.04 km'],
  ['4', 'New Edward Line', 'Core', '29', '51.06 km'],
  ['5', 'Stadium Line', 'Core', '39', '53.235 km'],
  ['6', 'Arcgo Line', 'Core', '31', '49.635 km'],
];

const searchRecords: SearchRecord[] = sections.map((section) => ({
  id: section.id,
  title: section.title,
  subtitle: `${section.body.length} paragraph${section.body.length === 1 ? '' : 's'}`,
  text: `${section.title} ${section.body.join(' ')}`,
}));

export function ArticleReader({ provenance }: { provenance: BuildProvenance }) {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [updatedAt, setUpdatedAt] = useState(() =>
    formatBuildTime(provenance.builtAt),
  );

  useEffect(() => {
    setUpdatedAt(formatBuildTime(provenance.builtAt, true));
  }, [provenance.builtAt]);

  const section =
    sections.find((candidate) => candidate.id === activeSection) ?? sections[0];

  return (
    <main className="article-page" id="main-content">
      <a className="skip-link" href="#article-content">
        Skip to article content
      </a>
      <header className="article-topbar">
        <Link href={publicPath('/')} className="article-back">
          <ArrowLeft size={18} aria-hidden="true" />
          Atlas home
        </Link>
        <div className="article-version">
          v{provenance.version} · updated {updatedAt}
        </div>
      </header>

      <div className="article-layout">
        <aside className="article-sections" aria-label="Article sections">
          <SearchWorkbench
            surfaceId="nazca-article-search"
            label="Search this article"
            placeholder="Find a section"
            records={searchRecords}
            compact
            onActivate={(record) => {
              setActiveSection(record.id);
              requestAnimationFrame(() =>
                document.getElementById('article-content')?.focus(),
              );
            }}
          />
          <nav className="article-section-tabs" aria-label="Article sections">
            {sections.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-current={
                  candidate.id === activeSection ? 'page' : undefined
                }
                onClick={() => setActiveSection(candidate.id)}
              >
                {candidate.title}
              </button>
            ))}
          </nav>
        </aside>

        <article className="article-body" id="article-content" tabIndex={-1}>
          <p className="eyebrow">Nazca Railway · Los Sengas Division</p>
          <h1>Nazca Railway</h1>
          <p className="article-subtitle">
            A structured first reader for the source article while the complete
            stable import is blocked by the source robots challenge.
          </p>

          <nav className="article-meta-tabs" aria-label="Article views">
            <a href="#read" aria-current="page">
              Read
            </a>
            <a href="#line-table">Line table</a>
            <a href="#source">
              <History size={15} aria-hidden="true" /> History and source
            </a>
          </nav>

          <section id="read" className="article-section">
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>

          <section id="line-table" className="article-section">
            <h2>Selected standard railway lines</h2>
            <p>
              The complete importer will replace this verified source sample
              with the pinned table.
            </p>
            <div
              className="table-scroll"
              role="region"
              aria-label="Selected railway lines"
              tabIndex={0}
            >
              <table>
                <caption>Core line sample from the source article</caption>
                <thead>
                  <tr>
                    <th scope="col">No.</th>
                    <th scope="col">Line</th>
                    <th scope="col">Class</th>
                    <th scope="col">Stations</th>
                    <th scope="col">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line[0]}>
                      {line.map((cell, index) =>
                        index === 1 ? (
                          <th scope="row" key={cell}>
                            {cell}
                          </th>
                        ) : (
                          <td key={cell}>{cell}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="source" className="article-source-card">
            <div>
              <h2>Source and attribution</h2>
              <p>
                Source text is credited under Fandom’s CC BY-SA notice. This
                local record is a temporary structured sample, not the final
                canonical import.
              </p>
            </div>
            <a
              href="https://enlossengas.fandom.com/wiki/Nazca_Railway_(Los_Sengas_Division)"
              target="_blank"
              rel="noopener noreferrer external"
              referrerPolicy="no-referrer"
            >
              Open source article <ExternalLink size={15} aria-hidden="true" />
            </a>
          </section>
        </article>
      </div>
    </main>
  );
}
