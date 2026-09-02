# Article routes and attribution

## Behavior

The `v0.1.0` current snapshot contains one deterministic static route for each
of the 3,422 current namespace-0 articles and one source route for each of 194
redirects. Generated records live under `data/corpus/reader/v0.1.0/` in 54
fixed-size shards of at most 64 articles. `lib/current-corpus.ts` is the only
route loader and returns an article, redirect, or missing result.

## Current status

Article bodies are compiled at import time from exact-revision rendered HTML
responses into safe semantic HTML. Source
anchors are page-prefixed, links resolve locally only for captured titles, and
unknown links remain explicit external source links. Scripts, forms, styles,
embeds, and remote media are removed. Referenced media file titles remain in an
accessible deferred list. Each record carries its current revision ID, exact
source URL, contributor state, timestamp, attribution, transforms, and body
hash.

Redirects are emitted as no-index static pages. Resolved redirects provide an
immediate meta redirect and a keyboard-accessible manual link. An outside-
corpus or invalid redirect remains an honest status page with its source URL.

The source capture is a current, non-reconciled snapshot. Historical revisions,
media bytes, maps, template and module closure, and a stable cutoff remain
deferred and are stated in the generated manifest.

## Failure modes

An unknown route returns a 404. A missing source record must never fall back to a
guessed title or another article.

## Suggested articles

- [Search and regex](search-and-regex.md)
- [Source policy](../import/source-policy.md)
- [Release delivery](../delivery/builds.md)

## Security and attribution

The source link uses `noopener`, `noreferrer`, and a no-referrer policy. Final
records must include page and revision IDs, contributors, timestamps, license,
cutoff, import transforms, and an exact changed-state notice.

## Verification

The GitHub Pages build prerenders the concrete route and checks its title,
transport-family section, project path, and Open Graph image.

## Suggested articles

- [Stable cutoff](../import/stable-cutoff.md)
- [Source policy](../import/source-policy.md)
