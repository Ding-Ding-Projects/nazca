# Nazca Railway handoff

## Current baseline

The current source includes a post-integration verification repair: the redirect
registry is decoded as an array, the redirect state is narrowed before it is
rendered, asynchronous search-index loading is explicitly observed, and nested
desktop dependencies are outside lint and Git discovery.
The Pages checker now identifies the rendered Reader 1b home button by its
accessible name; it no longer expects the removed legacy home anchor.

- Repository: `Ding-Ding-Projects/nazca`
- Default branch: `main`
- Last verified pushed commit: `f66dc3709941c8795f12121ee4df2a0340e4e8dc`
- Tracking issue: https://github.com/Ding-Ding-Projects/nazca/issues/1
- Rolling progress: https://github.com/Ding-Ding-Projects/nazca/discussions/2
- Release progress: https://github.com/Ding-Ding-Projects/nazca/discussions/3
- Published v0.1.1 integration commit: `134ba0c5a127b4e87319199777399b48e2b59a05`.
- Published v0.1.1 release commit: `f66dc3709941c8795f12121ee4df2a0340e4e8dc`, verified by run `33701152608` and Pages deployment. Its installer assets are published and verified.
- Candidate A v0.1.2 source tip: `2c397fe0957318186be4911df75da08ddf0cd39a`.
- v0.1.2 release target: https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.2. Candidate A is assembled, but this documentation commit supersedes its source tip. A fresh final build is required before deployment, installer publication, or release publication. The planned code name is `Bamboo Shoot Har Gow · 筍尖蝦餃`, linked from the published catalog asset without copying or attaching the photo.

## Implemented

- Modern transit-atlas shell with responsive light and dark presentation.
- Global search over the generated current title, alias, category, and excerpt index.
- Shared RE2/WASM worker workbench for the global and article search fields,
  including explicit dialect limits, captures, replacement preview, timing,
  zero-width handling, and bounded output.
- Strict browser-local visitor state with IndexedDB persistence, cross-tab
  revision notices, language and funny-level controls, personal vocabulary,
  renamed School mode, narrator voice settings, schedules, and five attention
  controls. These settings are functional first slices, not release-complete
  implementations of every related feature contract.
- Shared Tools workspace with command palette, persistent notifications,
  redacted local history, RFC 6238 authenticator, local QR read and creation,
  bounded converter adapters, consent-based Ollama loopback checks, exports, and
  offline browser-boundary help. Several advanced operations remain explicitly
  unavailable and are still release blockers.
- Local Support Tickets, exact-commit changelog, verified public release code
  name, 10% startup surprise, and a service-worker cache/update first slice.
  These surfaces remain partial until localization, bulk operations, and runtime
  evidence are complete.
- Generated current article and redirect routes with section search, bounded regex
  preview, safe HTML, exact source attribution, and deferred-state disclosure.
- Reader 1b production mapping with eight explicit states: home, generic article,
  specialized station article, year or stub article, full destination list,
  dedicated search, redirect, and not-found. Routes and implementation paths are
  recorded in `docs/design/reader-1b-handoff.md`.
- Typed corpus, page, redirect, revision, map, media, rights, volume, feature,
  search, and visitor-state contracts.
- Metadata-only media release registry and sequential publisher checkpoint with
  source-identity, rights, signature, digest, and fresh-download validation.
- The media registry is intentionally empty. No original media bytes have been
  downloaded or published, and release-volume publication remains future work.
- Bounded source-policy preflight, continuation-cycle protection, namespace
  resolution, bundle hashes, and staged inventory publication.
- Fresh current inventory with 3,616 routes, 3,422 articles, 194 redirects,
  1,996 templates, 18 modules, 3 maps, and 16,557 media records.
- Current raw wikitext for all 3,422 articles and redirect metadata in resumable
  local batches, with source-policy receipts and response hashes.
- Generated reader data in `data/corpus/reader/v0.1.0/`: 54 article shards,
  sorted route and redirect registries, compact search index, and strict manifest.
- Exact-oldid rendered capture in 69 resumable batches for all 3,422 current
  articles. The tracked rendered-capture manifest hash is
  `603528b6695d97da351d49d9e4155ef75ddfc221a90d80421448652ada9c3822`.
- The external raw archive is 60,662,581 bytes with SHA-256
  `3ba23406f379664b36ec53170940f2093f441fe00125ee03e8fb8afd98badf7a`.
- Build-only release and Pages workflow is committed for v0.1.2. It runs no tests, lint,
  type checks, static analysis, accessibility checks, security checks, reviews,
  or screenshots. Candidate A's local reader build passed, but its first v0.1.2
  release run remains pending.
- The v0.1.1 release and Pages deployment are verified. The GitHub Wiki is intentionally uninitialized. The configured Sites project
  is unavailable in the current connector workspace, so no Sites URL is claimed.
- Selected design direction: `Nazca Reader 1b.dc.html`. The committed handoff
  archive is `design/handoff/Wiki design rewrite.zip`, 81,903 bytes, SHA-256
  `2fadc260047ae2b83d45e205801d2233331b8ac1fbe217854e0429d3a97efae1`.
  Production paths are `components/nazca-shell.tsx`,
  `components/article-reader.tsx`, and `app/globals.css`.
- The design handoff record intentionally has no tests, browser interactions,
  or screenshots. Sites remains unavailable and the GitHub Wiki remains
  intentionally uninitialized.
- The v0.1.1 home-design correction is implemented by
  `c0f8aafcae2baf94c879ea746c349a3b92a9a75d` and integrated at
  `134ba0c5a127b4e87319199777399b48e2b59a05`. It adds the atlas hero,
  destination navigation, evidence and network composition, provenance
  context, and the responsive phone composition. This correction lane ran no
  tests, browser interactions, or screenshots.
- Windows desktop runtime source with isolated renderer boundaries, loopback
  static serving, stable provenance, and an unsigned Squirrel.Windows packaging
  path. The v0.1.1 installer is published and verified. The Candidate A v0.1.2
  installer was not built in this documentation lane and remains pending.
- Generated build provenance, social preview, Open Graph metadata, standard Git
  LFS prohibition, static-bundle bounds, and GitHub Pages project-path checks.

## Candidate A local build evidence

Candidate A at `2c397fe0957318186be4911df75da08ddf0cd39a` completed `build.bat /s`
in `00:06:17.9001998`. The build reported 3,616 routes, 3,422 articles, 194
redirects, 54 shards, and 3,422 search records. Its Sites bundle contains 36
files and 3,858,585 bytes, with `dirty=false` build provenance. The feature
inventory reported 30 rows: verified 0, partial 30, missing 0. The search
inventory reported 16 rows: verified 0, incomplete 16.

This documentation commit supersedes Candidate A's source tip, so the recorded
build is evidence for Candidate A only. A fresh final build is required before
v0.1.2 deployment, installer publication, or release publication.

The Pages service worker uses the `nazca-static-reader-1b-v2` cache namespace.
It retires older caches only after the new precache settles, uses
`updateViaCache: 'none'`, checks for updates when the page becomes visible or
receives focus, and offers a non-blocking reload action that preserves the
current URL and visitor state.

## Verified locally

- `npm run build`
- `npm run build:pages`
- `npm exec tsc -- --noEmit`
- `npm run format -- --check`
- `npm run check:no-lfs`
- Historical static bundle checks: 20-file Sites candidate and 25-file Pages mirror
- Production dependency audit: zero high or critical advisories

The checks above are historical baseline records. They were not rerun for the
v0.1.1 home-design correction. That correction has an exact no-test,
no-browser-interaction, and no-screenshot boundary.

## Source policy receipt

The project owner explicitly directed the importer to skip the challenged
`robots.txt` endpoint and then to continue reading the wiki after the separate
first-party terms endpoint also returned challenge HTML. The importer records
both owner overrides, hashes the bounded terms response, and never labels either
response as allowed or verified. The MediaWiki API capture is proceeding.

## Next safe work

1. Finish the hand-written feature and search inventories and their checks.
2. Add categorized feature documentation and the offline documentation index.
3. Implement strict visitor-state storage and the shared search workbench.
4. Populate the media registry only after source authorization, then complete
   staging, volume, and round-trip verification using the committed publisher.
5. Run a fresh final build from this documentation commit, then run the v0.1.2 build-only GitHub Actions release and Pages publication workflow.
6. Register the isolated headless verification route and capture the built UI.

## Honesty boundary

The current reader is generated from the fresh non-reconciled snapshot. The raw
corpus remains outside Git and is packaged as `nazca-current-corpus-0.1.0.zip`.
The public Pages URL is `https://ding-ding-projects.github.io/nazca/`. A fresh
v0.1.1 workflow run, release publication, Pages deployment, and installer assets
are verified. The v0.1.2 workflow run, release publication, installer
verification, and runtime capture are not claimed here. The expected v0.1.2
release URL is a target until external proof exists. Sites remains unavailable
and the GitHub Wiki remains uninitialized. Historical revisions, media, maps, template and module closure,
and stable reconciliation remain open.

## Reader-first home reorganization

The current source tip reorganizes the GitHub Pages home away from a portal or
fandom-style dashboard. `components/nazca-shell.tsx` now presents one deliberate
reading order: introduction, working Search and Explore actions, four subject
entries, featured records, and short source notes. `app/globals.css` gives the
home a two-column shell without the duplicate right status rail and includes
explicit tablet and phone collapses. Other destinations retain their existing
navigation and contextual rail. The project wiki mirror and atlas-shell guide
record the new structure. The Pages prerender completed for all routes, but the
postbuild check remains blocked by its missing article-home artifact; runtime
accessibility and visual capture remain separate release evidence.

## Compact shell repair

The phone shell now retains an explicit row for the route stripe instead of
letting CSS create an implicit content row. Home-specific desktop columns are
neutralized at the compact breakpoint, navigation groups flatten into a single
touch-scrollable bottom dock, and safe-area padding plus wrapping guardrails
keep content inside a 320 px viewport. A fresh build, type check, layout capture,
and assistive-technology pass remain required evidence for publication.
