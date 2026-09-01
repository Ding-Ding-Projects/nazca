# Build and dependency acquisition

## Behavior

The root Windows scripts acquire a compatible Node.js runtime, verify the pinned
portable archive when it is needed, install the exact lockfile, and invoke the
committed build path.

## Configuration

`dependency-manifest.json` pins Node.js 22.23.2 portable archives for x64 and
Arm64. The runtime is stored under the current user's local application data,
outside the repository.

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
