# Sites, GitHub Pages, and offline bundle

## Behavior

The public deployment is GitHub Pages at
https://ding-ding-projects.github.io/nazca/, serving the project-path static
build under `/nazca/`. The build-only workflow runs on every push and manual
dispatch, but publishes only from `main` or an explicit dispatch. The offline
ZIP contains the root-path static build and a loopback-only Node server. The
configured Sites project is unavailable in the current connector workspace, so
no Sites URL is claimed.

The v0.1.1 home-design correction is implemented by
`c0f8aafcae2baf94c879ea746c349a3b92a9a75d` and integrated at
`134ba0c5a127b4e87319199777399b48e2b59a05`. The new home composition includes
an atlas hero, destination navigation, evidence and network panels, provenance
context, and a responsive phone composition. The published v0.1.1 release
targets `f66dc3709941c8795f12121ee4df2a0340e4e8dc` at
https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.1. The next target
is v0.1.2 at https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.2,
pending integration of the Reader 1b state-completion lane. Its planned code
name is `Bamboo Shoot Har Gow · 筍尖蝦餃`, linked from the published catalog asset
without copying the photo into this repository. The raw
`nazca-current-corpus-0.1.0.zip` archive identity remains unchanged.

The current reader release contains 3,422 articles, 194 redirects, 3,616
routes, and 54 shards. Its rendered-capture manifest is
`603528b6695d97da351d49d9e4155ef75ddfc221a90d80421448652ada9c3822`. The raw
archive is 60,662,581 bytes with SHA-256
`3ba23406f379664b36ec53170940f2093f441fe00125ee03e8fb8afd98badf7a`.

The Pages service worker uses the versioned cache namespace
`nazca-static-reader-1b-v2`. During activation it removes older `nazca-static-`
caches only after the new precache pass settles, then claims existing clients.
The registration uses `updateViaCache: 'none'` and requests an immediate update
comparison when the page becomes visible or receives focus. When an existing
client has a newer worker, it receives a non-blocking **Update ready** notice
with an accessible **Reload now** action. That action reloads the current URL,
including its query and `/nazca/` project prefix, and does not clear visitor
state. Reloading is user-controlled, so an active edit is not interrupted by an
automatic loop.

## Configuration

- `npm run build`: Sites candidate
- `npm run build:pages`: project-path static mirror
- `npm run build:offline`: root-path static export
- `npm run package:offline`: offline ZIP
- `.github/workflows/release.yml`: build-only Pages and release workflow

## Failure modes

Missing static routes, wrong asset prefixes, social-preview drift, 250 MiB bundle
warning, or the 1 GiB hard limit stops the relevant delivery path. If a worker
precache request fails, the worker keeps the entries that succeeded and retries
missing entries through the network-first fetch path. If the network is
unavailable, cached URLs are served as-is; a missing navigation falls back to
the cached project root or reports `Offline page unavailable.` with HTTP 503.
Worker registration failures are reported as an **Offline support unavailable**
notification and do not block the reader.

## Security and privacy

The offline server binds only to `127.0.0.1`. The static bundle contains no
source-site runtime, analytics, remote fonts, credentials, or private visitor
state.

## Verification

The Pages URL is configured as shown above. The v0.1.1 workflow run, release
publication, Pages deployment, and installer assets are verified. The v0.1.2
workflow run, release publication, and installer verification remain pending.
The workflow and the v0.1.1 correction lane run no tests, lint, type checks, static analysis,
accessibility checks, security checks, reviews, browser interactions, or
screenshots. The GitHub Wiki is intentionally uninitialized, and the configured
Sites project remains unavailable. The public Pages URL remains
https://ding-ding-projects.github.io/nazca/.

The cache retirement and reload action are source-level changes in the current
deployment lane. Automated tests, browser interaction, and screenshots were
intentionally not run for this rapid-delivery update boundary.

## Suggested articles

- [Builds](builds.md)
- [Verification](../verification/README.md)
