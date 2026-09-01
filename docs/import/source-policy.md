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
and source errors stop the current phase. Every failed request emits a bounded
receipt with its exact request URL, purpose, phase, attempt, HTTP status, content
type, retry hint, and SHA-256 of the bounded response when available. Response
bodies are never included.

The current source returns HTTP 403 HTML for `robots.txt`. The importer exits
with `ROBOTS_CHALLENGE` and writes no corpus capture.

If the terms page itself returns a challenge, the importer exits with the distinct
`TERMS_CHALLENGE` code and writes no corpus capture. A normal HTML terms page is
accepted and its bounded response hash is recorded in the policy receipt.

For the current migration, the project owner explicitly requested an import that
skips this challenge-blocked endpoint. That path is opt-in through
`--skip-robots`, records `skipped-user-override`, and never records a false
`allowed` verdict. Terms validation, pacing, `maxlag`, limits, retries, and source
hashes remain active.

The project owner then directed the importer to read the entire wiki after the
separate first-party terms endpoint also returned challenge HTML. The explicitly
named `--continue-on-terms-challenge` path is valid only with the recorded
`--skip-robots` owner override. It records the status, content type, bounded
response hash, `challenge-user-override` state, and owner direction. It never
records the challenged terms response as verified or allowed.

## Security and privacy

Responses are streamed through byte limits. Redirects are rejected. Capture
files are staged as a set before one pointer is published.

## Verification

The current negative preflight is exercised locally. Full parser, retry, journal,
policy-change, and stability tests remain pending.

## Suggested articles

- [Stable cutoff](stable-cutoff.md)
- [Article routes](../reader/article-routes.md)
