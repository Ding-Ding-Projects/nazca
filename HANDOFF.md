# Nazca Railway handoff

## Current baseline

- Repository: `Ding-Ding-Projects/nazca`
- Default branch: `main`
- Last verified pushed commit: `f5df08d90be60f1b6014ec6a2258ffec81cbe3d1`
- Tracking issue: https://github.com/Ding-Ding-Projects/nazca/issues/1
- Rolling progress: https://github.com/Ding-Ding-Projects/nazca/discussions/2
- Release progress: https://github.com/Ding-Ding-Projects/nazca/discussions/3

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
- Typed corpus, page, redirect, revision, map, media, rights, volume, feature,
  search, and visitor-state contracts.
- Bounded source-policy preflight, continuation-cycle protection, namespace
  resolution, bundle hashes, and staged inventory publication.
- Fresh current inventory with 3,616 routes, 3,422 articles, 194 redirects,
  1,996 templates, 18 modules, 3 maps, and 16,557 media records.
- Current raw wikitext for all 3,422 articles and redirect metadata in resumable
  local batches, with source-policy receipts and response hashes.
- Generated reader data in `data/corpus/reader/v0.1.0/`: 54 article shards,
  sorted route and redirect registries, compact search index, and strict manifest.
- Windows desktop runtime source with isolated renderer boundaries, loopback
  static serving, stable provenance, and an unsigned Squirrel.Windows packaging
  path. The installer itself remains unbuilt and unverified.
- Generated build provenance, social preview, Open Graph metadata, standard Git
  LFS prohibition, static-bundle bounds, and GitHub Pages project-path checks.

## Verified locally

- `npm run build`
- `npm run build:pages`
- `npm exec tsc -- --noEmit`
- `npm run format -- --check`
- `npm run check:no-lfs`
- Static bundle checks: 20-file Sites candidate and 25-file Pages mirror
- Production dependency audit: zero high or critical advisories

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
4. Add media rights, staging, volume, and round-trip verification tools before
   downloading any source media.
5. Add build-only GitHub Actions release and Pages publication.
6. Register the isolated headless verification route and capture the built UI.

## Honesty boundary

The current reader is generated from the fresh non-reconciled snapshot. The raw
corpus remains outside Git and is packaged as `nazca-current-corpus-0.1.0.zip`.
No public deployment, release publication, installer verification, or runtime
capture is claimed in Candidate A. Historical revisions, media, maps, template
and module closure, and stable reconciliation remain open.
