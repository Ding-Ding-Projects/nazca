# Release-backed media storage

## Behavior

Original media bytes remain outside ordinary Git. Immutable repository release
assets provide the large-file store. Every catalog URL names an exact tag and an
exact returned asset name.

## Volume contract

- Names: `fandom-media-v1-000001` onward
- Maximum objects: 900 per volume
- Maximum stored bytes: 1 GiB per volume
- Stored names: `fmd-<sha256>.<validated-extension>`
- Draft-first upload, fresh download verification, then immutable publication

## Failure modes

Signature mismatch, MIME mismatch, decode failure, dimension mismatch, changed
source SHA-1, wrong returned name, digest mismatch, missing rights record, mutable
URL, or incomplete round trip blocks publication.

## Security and privacy

SVG content is sanitized. PDF files receive validated previews. Display variants
never upscale. Missing media renders a local accessible placeholder with factual
recovery information.

## Verification

No media publication tooling or volume exists yet. The repository currently only
checks that standard Git LFS declarations and pointers are absent.

## Suggested articles

- [Rights and takedowns](rights-and-takedowns.md)
- [Stable cutoff](../import/stable-cutoff.md)
