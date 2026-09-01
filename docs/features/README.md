# Universal feature status

The release feature list is hand-written in
`data/inventories/feature-coverage.json`. It includes the corpus reader, search,
tabs, localization, visitor settings, accessibility, offline documentation,
appearance, locks, authenticator, history, converter, local model manager,
notifications, command palette, exports, bulk actions, status, changelog,
delivery, and evidence.

The current build implements only the first reader and delivery foundations.
Rows marked `missing` or `partial` are release blockers, not future ideas that can
quietly disappear.

## Configuration

Run:

```sh
node scripts/check-feature-coverage.mjs
node scripts/check-feature-coverage.mjs --self-test
node scripts/check-feature-coverage.mjs --release
```

The release form fails until every row is verified and carries implementation,
localization, persistence, documentation, focused test, built interaction,
capture, and negative-regression evidence.

## Failure and security

Feature registration never authorizes browser capabilities that do not exist.
Native-only contracts must ship the closest testable browser behavior and state
the exact boundary.

## Suggested articles

- [Search and regex](../reader/search-and-regex.md)
- [Verification](../verification/README.md)
