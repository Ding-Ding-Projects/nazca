# Atlas shell

## Behavior

The home route presents a persistent transit-atlas navigation dock, global
search, route-family cards, a map preview, source provenance, build version, and
implementation status in the first viewport. Route colors encode transport
data; they do not replace labels or status text.

## Configuration

Build provenance comes from `scripts/run-vinext.mjs`. GitHub Pages builds set a
`/nazca` public path while the Sites candidate remains root-relative.

## Failure modes

- Missing build provenance renders an unavailable state.
- Unknown article routes return not found instead of impersonating another page.
- Narrow layouts collapse the dock into a bottom strip. Complete overflow,
  grouping, pinning, and tab discovery remain pending.

## Security and privacy

The shell includes no analytics, advertising, source-site runtime, or remote
font. Visitor persistence is not implemented yet.

## Verification

The Sites build and the project-path static export pass locally. Runtime capture,
touch, high-scale, and assistive-technology evidence remain pending.

## Suggested articles

- [Search and regex](search-and-regex.md)
- [Article routes](article-routes.md)
- [Deployment](../delivery/deployments.md)
