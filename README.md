# Nazca Railway

**The Encyclopedia of Los Sengas**

![Nazca Railway transit-atlas social preview](social-preview.png)

Nazca Railway is a clarity-first static reader for the reader-facing content of
The Encyclopedia of Los Sengas. It is designed as a modern transit atlas with
searchable routes, readable railway tables, permanent attribution, and no
advertising rails or source-site runtime code.

Published website: https://ding-ding-projects.github.io/nazca/

The v0.1.1 release is published and verified at
https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.1, targeting
`f66dc3709941c8795f12121ee4df2a0340e4e8dc`. It corrects the reader home design
without replacing the `nazca-current-corpus-0.1.0.zip` corpus archive identity.

The next release target is v0.1.2:
https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.2. Its planned
code name is `Bamboo Shoot Har Gow · 筍尖蝦餃`, using the published
`hk-dish-0003-bamboo-shoot-har-gow.png` asset from the public catalog. The
workflow creates or reuses exactly one numeric v0.1.2 draft, then publishes it
only after the Pages deployment and generated asset checks complete.

The current reader contains 3,422 exact-revision rendered article records, 194
redirects, 3,616 routes, and 54 shards. The rendered-capture manifest is
`603528b6695d97da351d49d9e4155ef75ddfc221a90d80421448652ada9c3822`, and the
external raw archive is 60,662,581 bytes with SHA-256
`3ba23406f379664b36ec53170940f2093f441fe00125ee03e8fb8afd98badf7a`.

The build-only release workflow deliberately runs no tests, lint, type checks,
static analysis, accessibility checks, security checks, reviews, or screenshots.
The configured Sites project is unavailable in the current connector workspace,
so no Sites URL is claimed. The GitHub Wiki is intentionally uninitialized.

## Current design direction

The selected direction is `Nazca Reader 1b.dc.html`. Its committed handoff
archive is `design/handoff/Wiki design rewrite.zip`, 81,903 bytes, with SHA-256
`2fadc260047ae2b83d45e205801d2233331b8ac1fbe217854e0429d3a97efae1`. The real
production paths are `components/nazca-shell.tsx`,
`components/article-reader.tsx`, and `app/globals.css`. This design handoff
update intentionally ran no tests, browser interactions, or screenshots. Sites
remains unavailable and the GitHub Wiki remains intentionally uninitialized.

The v0.1.1 home-design correction is implemented by
`c0f8aafcae2baf94c879ea746c349a3b92a9a75d` and integrated at
`134ba0c5a127b4e87319199777399b48e2b59a05`. It materially changes the reader
home composition with an atlas hero, destination navigation, evidence and
network panels, provenance context, and a phone layout. The correction lane
intentionally ran no tests, browser interactions, or screenshots. The public
Pages URL remains https://ding-ding-projects.github.io/nazca/.

> [!IMPORTANT]
> Candidate A now contains a fresh current snapshot: 3,422 article bodies and
> 194 redirects captured in resumable 50-page batches, with 3,422 sanitized
> static reader records and 3,616 generated routes. Historical revisions, media
> bytes, maps, and stable-cutoff reconciliation remain explicitly deferred. The
> owner-authorized importer records the challenged `robots.txt` and terms
> responses as policy receipts without calling them verified.

## Quick links

- [Migration issue](https://github.com/Ding-Ding-Projects/nazca/issues/1)
- [Rolling progress](https://github.com/Ding-Ding-Projects/nazca/discussions/2)
- [v0.1.0 release progress](https://github.com/Ding-Ding-Projects/nazca/discussions/3)
- [v0.1.1 release](https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.1)
- [v0.1.2 release target](https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.2)
- [Source article](https://enlossengas.fandom.com/wiki/Nazca_Railway_%28Los_Sengas_Division%29)
- [Documentation index](docs/README.md)

## Build now

On Windows, double-click `build.bat`, or use its silent mode:

```bat
build.bat /s
```

The root scripts acquire a compatible Node.js runtime when needed, verify its
official SHA-256, run `npm ci`, and build through the same committed path used by
automation.

```bat
download-dependencies.bat /s
build.bat /s
build-installer.bat /s
```

`build-installer.bat` builds the unsigned Squirrel.Windows installer through the
existing desktop packaging helper. The offline static website ZIP remains a
separate `npm run build:offline` and `npm run package:offline` path.

<details>
<summary><strong>Current verified baseline</strong></summary>

- Public `main` commit: `a847c731c289cd510c2e6c9c204f84e0e38e082b`
- Sites build: passed locally
- GitHub Pages static export: three routes prerendered, zero skipped
- Static mirror: 25 files and 2,587,822 bytes at the verified build
- TypeScript: passed
- Formatting: passed
- Standard Git LFS scan: no pointer or filter declaration
- Production dependency audit: zero high or critical advisories, one low
  development-tool advisory
- Source inventory: 3,616 routes, 3,422 articles, and 194 redirects captured
- Current snapshot: 3,422 articles, 194 redirects, 3,616 routes, 54 reader shards
- Raw archive: `nazca-current-corpus-0.1.0.zip` is retained outside ordinary Git

</details>

<details>
<summary><strong>Repository map</strong></summary>

- `app/`: routes, metadata, and the reader shell
- `components/`: reader and interface components
- `data/corpus/`: planning-only source baseline and future canonical records
- `data/inventories/`: hand-written feature and search coverage
- `design/`: deterministic design references and capability notes
- `docs/`: categorized behavior, security, failure, and verification notes
- `lib/`: strict record contracts and build provenance
- `scripts/`: importer, build, bundle, and release checks

</details>

<details>
<summary><strong>Source, licensing, and media</strong></summary>

Fandom remains the credited legacy source. Imported text retains source links,
CC BY-SA attribution, contributor history, timestamps, comments, revision IDs,
and transformation notices at the future pinned cutoff.

Current media will be published only after byte, MIME, dimension, hash, rights,
and attribution validation. Large media belongs in immutable release assets from
this repository. Standard Git LFS pointers and mutable latest-release URLs are
forbidden.

</details>

<details>
<summary><strong>Feature and evidence status</strong></summary>

The first shell, article route, source-policy receipts, typed contracts,
project-path static export, build provenance, social metadata, complete title
inventory, and every current raw article body are real. Revision history, media
volumes, full feature evidence, and final verification remain in progress. The
rendered reader records are generated from exact source revisions and their
external capture manifest is recorded above.

See [feature coverage](data/inventories/feature-coverage.json),
[search coverage](data/inventories/search-surfaces.json), and
[the roadmap](ROADMAP.md). A release build must refuse any row that is not fully
implemented, documented, tested, interacted with, and captured.

</details>

<details>
<summary><strong>Interface captures and recording</strong></summary>

Real built-interface captures and the short interaction recording are pending
the required isolated headless verification run. This section deliberately does
not substitute design references or generated artwork for runtime evidence.

</details>

## Human implementation estimate

The published v0.1.1 release measured 25,774 project lines excluding
documentation, generated corpus, and generated scaffold, with 24,872 nonblank
lines. Its human implementation estimate is 830 to 1,659 hours, calculated as
24,872 non-generated project lines at 30 to 15 reviewed lines per hour. This is
an estimate, not a recorded duration. The v0.1.2 release will refresh the
convenience copy from its own committed counter report.

## Project rules mirror

This public repository follows the sanitized project rules in [AGENTS.md](AGENTS.md).
The mirror covers source policy, privacy, accessibility, local verification,
static deployment, release-backed media, documentation, and release evidence.
