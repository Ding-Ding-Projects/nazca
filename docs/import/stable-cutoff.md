# Stable cutoff and revision history

## Required behavior

The final import starts with a T0 inventory, captures all eligible reader content,
reconciles overlapping recent changes, and repeats the inventory until the title,
redirect, category, template, module, map, revision, and current-media manifests
are stable. That timestamp and aggregate digest become the permanent cutoff.

## Current status

Only a planning snapshot and an inventory-phase importer exist. Revision bodies,
contributors, edit comments, rendered content, category edges, redirect targets,
and reconciliation are not captured.

## Failure modes

Any changing source identity, missing phase, count mismatch, duplicate page,
unresolved continuation, or policy digest change keeps the snapshot unstable.

## Security and attribution

Untouched XML and revision bundles belong in immutable release assets. Public
page records link to those bundles without placing large histories in ordinary
Git.

## Verification

The release check must prove every admitted page has a current record and every
revision bundle has an ordered, hashed, attributable history.

## Suggested articles

- [Source policy](source-policy.md)
- [Release-backed media](../media/release-backed-storage.md)
