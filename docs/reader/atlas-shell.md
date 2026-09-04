# Atlas shell

## Behavior

The home route is an encyclopedia directory rather than a fandom-style portal.
Its reading order is deliberately shallow: a plain-language introduction and two
working actions, four subject entrances, six useful starting records, then short
source and scope notes. The full corpus search remains in the header and has its
own local field and adjacent regular-expression builder.

The desktop navigation dock remains available for direct access to Reader,
Atlas, and Research areas. The home route removes the duplicate status rail so
the article directory receives the available reading width. Other workspaces
retain the contextual right rail. Route colors supplement icons and labels; they
do not carry meaning alone.

## Responsive layout

At wide widths the welcome copy and corpus summary sit side by side, followed by
a four-column subject directory and a two-column reading area. The directory
collapses to two columns, then one. The reading notes move below featured records
and both calls to action become full-width on narrow phones. Existing dock and
bottom-navigation breakpoints continue to support widths from 320 px.

## Configuration

Build provenance comes from `scripts/run-vinext.mjs`. GitHub Pages builds set a
`/nazca` public path while the Sites candidate remains root-relative.

## Failure modes

- Missing build provenance renders an unavailable state.
- Unknown article routes return not found instead of impersonating another page.
- Narrow layouts collapse the dock into a bottom strip. Complete overflow,
  grouping, pinning, and tab discovery remain pending.
- The corpus totals describe the captured current snapshot, not a reconciled
  canonical cutoff.

## Security and privacy

The shell includes no analytics, advertising, source-site runtime, or remote
font. Search and visitor preferences stay browser-local.

## Verification

The Sites build and project-path static export are checked locally. Runtime
capture, touch, high-scale, and assistive-technology evidence remain release
requirements.

## Suggested articles

- [Search and regex](search-and-regex.md)
- [Article routes](article-routes.md)
- [Deployment](../delivery/deployments.md)

## Compact shell guardrails

At 608 px and below, the header, route stripe, and content use explicit grid
rows; the dock groups flatten into one safe-area-aware horizontal scroller.
Every destination remains reachable, and long record text wraps within the
320 px minimum viewport rather than producing page-level horizontal overflow.
