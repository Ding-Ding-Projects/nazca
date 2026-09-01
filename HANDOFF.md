# Nazca Railway handoff

## Current baseline

- Repository: `Ding-Ding-Projects/nazca`
- Default branch: `main`
- Last verified pushed commit: `1053bf92b3bc0dd6595065268281598cc5009404`
- Tracking issue: https://github.com/Ding-Ding-Projects/nazca/issues/1
- Rolling progress: https://github.com/Ding-Ding-Projects/nazca/discussions/2
- Release progress: https://github.com/Ding-Ding-Projects/nazca/discussions/3

## Implemented

- Modern transit-atlas shell with responsive light and dark presentation.
- Global search over the first local fixture records.
- Shared RE2/WASM worker workbench for the global and article search fields,
  including explicit dialect limits, captures, replacement preview, timing,
  zero-width handling, and bounded output.
- Strict browser-local visitor state with IndexedDB persistence, cross-tab
  revision notices, language and funny-level controls, personal vocabulary,
  renamed School mode, narrator voice settings, schedules, and five attention
  controls. These settings are functional first slices, not release-complete
  implementations of every related feature contract.
- Nazca Railway article route with section search, bounded regex preview, line
  table, source link, and noncanonical preview disclosure.
- Typed corpus, page, redirect, revision, map, media, rights, volume, feature,
  search, and visitor-state contracts.
- Bounded source-policy preflight, continuation-cycle protection, namespace
  resolution, bundle hashes, and staged inventory publication.
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

## External blocker

The source `robots.txt` request currently returns HTTP 403 with an HTML challenge.
The importer exits with `ROBOTS_CHALLENGE` before source capture. Do not work
around this boundary. Retry only when a normal policy document is readable.

## Next safe work

1. Finish the hand-written feature and search inventories and their checks.
2. Add categorized feature documentation and the offline documentation index.
3. Implement strict visitor-state storage and the shared search workbench.
4. Add media rights, staging, volume, and round-trip verification tools before
   downloading any source media.
5. Add build-only GitHub Actions release and Pages publication.
6. Register the isolated headless verification route and capture the built UI.

## Honesty boundary

The current article is a structured preview fixture, not the final migrated
source record. No full corpus, revision archive, media volume, public deployment,
release, or runtime capture has been completed yet.
