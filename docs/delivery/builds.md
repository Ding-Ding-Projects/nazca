# Build and dependency acquisition

## Behavior

The root Windows scripts acquire a compatible Node.js runtime, verify the pinned
portable archive when it is needed, install the exact lockfile, and invoke the
committed build path.

## Configuration

`dependency-manifest.json` pins Node.js 22.23.2 portable archives for x64 and
Arm64. The runtime is stored under the current user's local application data,
outside the repository.

The current reader build runs `npm run check:current-corpus` before Vinext so
counts, route uniqueness, case-insensitive output collisions, shard and record
hashes, redirect cycles, safe HTML hashes, and forbidden raw fields fail closed.
The normal static bundle remains separate from the unsigned Squirrel.Windows
installer. `build.bat /s` builds the reader; `build-installer.bat /s` builds the
reader and invokes the existing Squirrel packaging helper after installing the
pinned desktop packaging dependencies. Code signing remains disabled.

The build-only release workflow uses the root and desktop lockfiles, builds the
root-path reader, packages unsigned Squirrel.Windows outputs, and prepares the
static ZIP, setup executable, `RELEASES`, the full and any generated delta nupkg
files, desktop and combined manifests, `SHA256SUMS.txt`, and the committed
line-count report. The next release is v0.1.2, with its version recorded in both
package manifests and both lockfiles. It intentionally runs no tests, lint, type
checks, static analysis, accessibility checks, security checks, reviews, or
screenshots.

## Candidate A build evidence

Candidate A is assembled at `2c397fe0957318186be4911df75da08ddf0cd39a`.
`build.bat /s` completed for that exact source tip in `00:06:17.9001998`. The
reader reported 3,616 routes, 3,422 articles, 194 redirects, 54 shards, and
3,422 search records. The Sites bundle contained 36 files and 3,858,585 bytes.
Build provenance reported `dirty=false`. The feature inventory contained 30
rows with verified 0, partial 30, and missing 0. The search inventory contained
16 rows with verified 0 and incomplete 16.

This documentation commit supersedes Candidate A's source tip, so the recorded
build applies only to Candidate A. A fresh final build is required before
v0.1.2 deployment, installer publication, or release publication. The v0.1.2
installer was not built in this documentation lane. The published v0.1.1
installer remains verified.

The v0.1.2 release specification is tracked in
`data/release-v0.1.2.json`. It records the published Bamboo Shoot Har Gow code
name, catalog revision, immutable photo asset digest, and the unchanged raw
v0.1.0 archive identity. The photo is linked in release notes and is not copied
or attached to this consumer release.

When the v0.1.2 workflow creates a new draft, it stages the three immutable
corpus assets from the one published v0.1.1 release: `nazca-current-corpus-0.1.0.zip`,
its `.sha256` checksum, and `archive-manifest.json`. It downloads them through
authenticated `gh` operations into a bounded runner temporary directory,
validates names, sizes, the tracked archive byte count, SHA-256, and manifest
counts, uploads them to the new draft, verifies their presence, and removes the
temporary directory. An existing v0.1.2 draft is not mutated by this staging
step; its assets are checked by the later exact preservation validation.

All three root scripts accept `/s`, `--silent`, or `SILENT=1`.

## Failure modes

Unsupported architecture, failed download, wrong SHA-256, missing archive
content, `npm ci` failure, build failure, or packaging failure exits nonzero and
names the phase.

## Security and privacy

Downloads use the canonical Node.js distribution host. The scripts do not install
credentials, signing material, or machine-wide policy changes.

## Verification

The warm-machine silent path and the offline bundle are tested locally. A fresh
machine cache-miss proof remains pending.

## Suggested articles

- [Deployments](deployments.md)
- [Reader routes](../reader/article-routes.md)
- [Source policy](../import/source-policy.md)
