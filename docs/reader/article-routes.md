# Article routes and attribution

## Behavior

`/wiki/Nazca_Railway_(Los_Sengas_Division)` is the first concrete reader route.
It includes section navigation, article search, a railway line table, and a
direct source link.

## Current status

The body is a hand-written structured preview fixture. It is not the final
canonical import. Every other source article, redirect, anchor, category, link,
and history record remains pending.

## Failure modes

An unknown route returns a 404. A missing source record must never fall back to a
guessed title or another article.

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
