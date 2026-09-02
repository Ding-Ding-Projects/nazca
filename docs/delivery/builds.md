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
line-count report. It intentionally runs no tests, lint, type checks, static
analysis, accessibility checks, security checks, reviews, or screenshots.

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
