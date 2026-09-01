# Source policy and capture

## Behavior

The importer reads `robots.txt` before any corpus query, requires HTTP 200,
parses the exact importer user-agent or wildcard group, applies the longest
matching allow or disallow rule to `/api.php`, and records the policy digest.
It also records a terms-page digest before capture.

## Configuration

- Source: `https://enlossengas.fandom.com`
- API: `https://enlossengas.fandom.com/api.php`
- User agent: `NazcaRailwayCorpusImporter/1.0`
- `maxlag`: 5 seconds
- Maximum attempts: 5

## Failure modes

Challenge HTML, non-200 policy responses, unparseable rules, disallowed paths,
oversized bodies, repeated throttling, continuation cycles, missing namespaces,
and source errors stop the current phase.

The current source returns HTTP 403 HTML for `robots.txt`. The importer exits
with `ROBOTS_CHALLENGE` and writes no corpus capture.

## Security and privacy

Responses are streamed through byte limits. Redirects are rejected. Capture
files are staged as a set before one pointer is published.

## Verification

The current negative preflight is exercised locally. Full parser, retry, journal,
policy-change, and stability tests remain pending.

## Suggested articles

- [Stable cutoff](stable-cutoff.md)
- [Article routes](../reader/article-routes.md)
