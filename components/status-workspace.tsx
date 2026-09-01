'use client';

import featureInventory from '@/data/inventories/feature-coverage.json';
import searchInventory from '@/data/inventories/search-surfaces.json';
import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';
import type { BuildProvenance } from '@/lib/provenance';

const statusRecords: SearchRecord[] = [
  {
    id: 'status-source',
    title: 'Source import',
    subtitle: 'Blocked before capture',
    text: 'source import robots challenge HTTP 403 blocked before capture',
  },
  {
    id: 'status-sites',
    title: 'Sites deployment',
    subtitle: 'Local candidate only',
    text: 'Sites primary deployment local candidate pending public URL',
  },
  {
    id: 'status-pages',
    title: 'GitHub Pages mirror',
    subtitle: 'Static export verified locally',
    text: 'GitHub Pages mirror static export three routes project path pending deployment',
  },
  {
    id: 'status-media',
    title: 'Media volumes',
    subtitle: 'Not published',
    text: 'media rights volumes release assets not published',
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
          <strong>🧱 Source import blocked</strong>
          <p>
            `robots.txt` returns HTTP 403 HTML. No corpus capture is treated as
            canonical.
          </p>
        </article>
        <article id="status-sites" tabIndex={-1}>
          <strong>🏗️ Sites candidate local</strong>
          <p>Primary public deployment has not been created or verified.</p>
        </article>
        <article id="status-pages" tabIndex={-1}>
          <strong>✅ Pages export local</strong>
          <p>
            Three routes prerender, project assets normalize correctly, and the
            mirror is not deployed yet.
          </p>
        </article>
        <article id="status-media" tabIndex={-1}>
          <strong>⏳ Media pending</strong>
          <p>
            No source originals, rights catalog, or immutable media volume is
            published.
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
            <dd>{searchInventory.rows.length}, all incomplete for release</dd>
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
