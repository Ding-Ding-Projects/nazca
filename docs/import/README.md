# Import documentation

- [Source policy and capture](source-policy.md)
- [Stable cutoff and revision history](stable-cutoff.md)

The current importer is an inventory phase. It is not a complete or canonical
corpus migration while the source policy remains unreadable.

The current snapshot is captured through the owner-authorized source route in
bounded 50-page batches. `scripts/import-current-pages.mjs` captures articles
and `scripts/import-current-redirects.mjs` captures redirects. Both preserve
ordered page IDs, request hashes, retry receipts, unique temporary names,
atomic rename retries, and resumable journals. The capture is intentionally
not a stable reconciliation.

Run the current pipeline with `npm run import:inventory:owner-override`, then
`npm run import:current-pages`, `npm run import:current-redirects`, and
`npm run compile:current-corpus`. The ignored capture stays outside ordinary
Git. The compiler emits `data/corpus/reader/v0.1.0/` and an external
`nazca-current-corpus-0.1.0.zip` raw archive with per-file bytes and SHA-256
records.

## Suggested articles

- [Source policy](source-policy.md)
- [Stable cutoff](stable-cutoff.md)
- [Reader routes](../reader/article-routes.md)
