'use client';

import featureInventory from '@/data/inventories/feature-coverage.json';
import searchInventory from '@/data/inventories/search-surfaces.json';
import captureSummary from '@/data/corpus/current-capture-summary.json';
import mediaRegistry from '@/data/media/release-volumes.json';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import type { BuildProvenance } from '@/lib/provenance';

const statusRecords: SearchRecord[] = [
  {
    id: 'status-source',
    title: 'Source import',
    subtitle: 'Current reader captured',
    text: 'source current reader captured articles redirects routes stable reconciliation pending',
  },
  {
    id: 'status-sites',
    title: 'Sites deployment',
    subtitle: 'Project registered',
    text: 'Sites primary project registered production deployment evidence external',
  },
  {
    id: 'status-pages',
    title: 'GitHub Pages mirror',
    subtitle: 'Current build aware',
    text: 'GitHub Pages mirror deployment derives from running build provenance',
  },
  {
    id: 'status-media',
    title: 'Media volumes',
    subtitle:
      mediaRegistry.registryState === 'empty'
        ? 'Not published'
        : 'Registry available',
    text: 'media rights volumes immutable release assets registry state',
  },
  {
    id: 'status-features',
    title: 'Feature coverage',
    subtitle: 'All rows incomplete for release',
    text: 'feature coverage partial missing release blocked',
  },
  {
    id: 'status-evidence',
    title: 'Runtime evidence',
    subtitle: 'Headless capture pending',
    text: 'runtime evidence screenshots recording accessibility layout pending',
  },
];

export function StatusWorkspace({
  provenance,
}: {
  provenance: BuildProvenance;
}) {
  const partial = featureInventory.rows.filter(
    (row) => row.state === 'partial',
  ).length;
  const missing = featureInventory.rows.filter(
    (row) => row.state === 'missing',
  ).length;
  const verified = featureInventory.rows.filter(
    (row) => row.state === 'verified',
  ).length;
  const searchPartial = searchInventory.rows.filter(
    (row) => row.state === 'partial',
  ).length;
  const searchMissing = searchInventory.rows.filter(
    (row) => row.state === 'missing',
  ).length;
  const pagesDeployment = provenance.deployment === 'github-pages-mirror';
  return (
    <section className="status-workspace" aria-labelledby="status-heading">
      <p className="eyebrow">Current build status</p>
      <h1 id="status-heading" className="workspace-title">
        Evidence first. Intent second.
      </h1>
      <p className="lede">
        This view reports the running build and public project records. It does
        not turn pending work green.
      </p>
      <SearchWorkbench
        surfaceId="status-search"
        label="Search status"
        placeholder="Find a lane, blocker, or deployment"
        records={statusRecords}
        onActivate={(record) => document.getElementById(record.id)?.focus()}
      />
      <div className="status-card-grid">
        <article id="status-source" tabIndex={-1}>
          <strong>✅ Current reader captured</strong>
          <p>
            {captureSummary.currentPages.captured.toLocaleString()} current
            articles, {captureSummary.inventory.redirects.toLocaleString()}{' '}
            redirects, and {captureSummary.inventory.routes.toLocaleString()}{' '}
            routes are compiled. Historical revisions, maps, media bytes, and
            stable reconciliation remain open.
          </p>
        </article>
        <article id="status-sites" tabIndex={-1}>
          <strong>🏗️ Sites project registered</strong>
          <p>
            The primary production URL is external deployment evidence. This
            running build does not invent a successful Sites state.
          </p>
        </article>
        <article id="status-pages" tabIndex={-1}>
          <strong>
            {pagesDeployment ? '✅ Pages mirror build' : '🟡 Pages build state'}
          </strong>
          <p>
            {captureSummary.inventory.routes.toLocaleString()} reader routes are
            in the static corpus. This build identifies itself as{' '}
            <code>{provenance.deployment}</code>.
          </p>
        </article>
        <article id="status-media" tabIndex={-1}>
          <strong>
            {mediaRegistry.registryState === 'empty'
              ? '⏳ Media pending'
              : '🟡 Media registry available'}
          </strong>
          <p>
            {mediaRegistry.releases.length} immutable media releases are in the
            tracked registry. Empty remains pending, never silently complete.
          </p>
        </article>
        <article id="status-features" tabIndex={-1}>
          <strong>🟡 Feature coverage</strong>
          <p>
            {verified} verified · {partial} partial · {missing} missing. Release
            mode requires every row verified.
          </p>
        </article>
        <article id="status-evidence" tabIndex={-1}>
          <strong>⏳ Runtime evidence pending</strong>
          <p>
            The required isolated headless capture, touch, accessibility, and
            layout matrix is not complete.
          </p>
        </article>
      </div>
      <div className="status-details">
        <dl>
          <div>
            <dt>Version</dt>
            <dd>{provenance.version}</dd>
          </div>
          <div>
            <dt>Commit</dt>
            <dd>{provenance.commitSha ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt>Built</dt>
            <dd>{provenance.builtAt ?? 'Unavailable'} UTC</dd>
          </div>
          <div>
            <dt>Deployment label</dt>
            <dd>{provenance.deployment}</dd>
          </div>
          <div>
            <dt>Search rows</dt>
            <dd>
              {searchInventory.rows.length} total, {searchPartial} partial,{' '}
              {searchMissing} missing
            </dd>
          </div>
        </dl>
        <div className="tool-actions">
          <a
            href="https://github.com/Ding-Ding-Projects/nazca/issues/1"
            target="_blank"
            rel="noopener noreferrer"
          >
            Migration issue
          </a>
          <a
            href="https://github.com/Ding-Ding-Projects/nazca/discussions/2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Rolling progress
          </a>
          <a
            href="https://github.com/orgs/Ding-Ding-Projects/projects/29"
            target="_blank"
            rel="noopener noreferrer"
          >
            Private project
          </a>
        </div>
      </div>
    </section>
  );
}
