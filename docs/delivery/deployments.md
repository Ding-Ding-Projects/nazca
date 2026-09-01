# Sites, GitHub Pages, and offline bundle

## Behavior

The primary deployment uses Sites. GitHub Pages serves an identical static build
under `/nazca/`. The offline ZIP contains the root-path static build and a
loopback-only Node server.

## Configuration

- `npm run build`: Sites candidate
- `npm run build:pages`: project-path static mirror
- `npm run build:offline`: root-path static export
- `npm run package:offline`: offline ZIP

## Failure modes

Missing static routes, wrong asset prefixes, social-preview drift, 250 MiB bundle
warning, or the 1 GiB hard limit stops the relevant delivery path.

## Security and privacy

The offline server binds only to `127.0.0.1`. The static bundle contains no
source-site runtime, analytics, remote fonts, credentials, or private visitor
state.

## Verification

Local Sites and Pages builds pass. Neither public deployment is configured or
verified yet, and no release has been published.

## Suggested articles

- [Builds](builds.md)
- [Verification](../verification/README.md)
