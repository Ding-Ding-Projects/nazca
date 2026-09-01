'use client';

import { ArrowLeft, ExternalLink, History, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

const MAX_REGEX_LENGTH = 256;

export function ArticleReader({ provenance }: { provenance: BuildProvenance }) {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [query, setQuery] = useState('');
  const [regexMode, setRegexMode] = useState(false);
  const updatedAt = formatBuildTime(provenance.builtAt);

  const searchState = useMemo(() => {
    if (!query.trim())
      return { matches: sections, error: null as string | null };
    if (regexMode) {
      if (query.length > MAX_REGEX_LENGTH) {
        return {
          matches: [] as ArticleSection[],
          error: `The pattern exceeds the ${MAX_REGEX_LENGTH}-character preview limit.`,
        };
      }
      try {
        const expression = new RegExp(query, 'iu');
        return {
          matches: sections.filter((section) =>
            expression.test(`${section.title} ${section.body.join(' ')}`),
          ),
          error: null,
        };
      } catch (error) {
        return {
          matches: [] as ArticleSection[],
          error:
            error instanceof Error ? error.message : 'The pattern is invalid.',
        };
      }
    }
    const needle = query.toLocaleLowerCase();
    return {
      matches: sections.filter((section) =>
        `${section.title} ${section.body.join(' ')}`
          .toLocaleLowerCase()
          .includes(needle),
      ),
      error: null,
    };
  }, [query, regexMode]);

  const filteredSections = searchState.matches;

  useEffect(() => {
    if (
      filteredSections.length > 0 &&
      !filteredSections.some((candidate) => candidate.id === activeSection)
    ) {
      setActiveSection(filteredSections[0].id);
    }
  }, [activeSection, filteredSections]);

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
        <div className="article-version" suppressHydrationWarning>
          v{provenance.version} · updated {updatedAt}
        </div>
      </header>

      <div className="article-layout">
        <aside className="article-sections" aria-label="Article sections">
          <div className="article-search" role="search">
            <label htmlFor="article-search">Search this article</label>
            <div>
              <Search size={17} aria-hidden="true" />
              <input
                id="article-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  regexMode ? 'Enter a regex pattern' : 'Find a section'
                }
                maxLength={regexMode ? MAX_REGEX_LENGTH : undefined}
              />
              <button
                type="button"
                aria-pressed={regexMode}
                onClick={() => setRegexMode((value) => !value)}
              >
                Regex
              </button>
            </div>
          </div>
          <p className="article-search-scope">
            {regexMode
              ? 'JavaScript Unicode regex preview, bounded to 256 characters and six sections.'
              : 'Plain-text section search.'}
          </p>
          <nav className="article-section-tabs" aria-label="Article sections">
            {filteredSections.map((candidate) => (
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
          {searchState.error ? (
            <p className="article-search-error" role="alert">
              Pattern error: {searchState.error}
            </p>
          ) : null}
          {!filteredSections.length && !searchState.error ? (
            <p className="article-no-match">
              No section matches the current search.
            </p>
          ) : null}
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
