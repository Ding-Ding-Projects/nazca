# Release-backed media storage

## Behavior

Original media bytes remain outside ordinary Git. Immutable repository release
assets provide the large-file store. Every catalog URL names an exact tag and an
exact returned asset name. The tracked `data/media/release-volumes.json` file is
metadata only. It is intentionally empty until an approved source batch has
passed the publisher's checks.

## Volume contract

- Names: `nazca-media-v1-000001` onward
- Maximum objects: 1,000 per volume
- Maximum stored bytes: 1 GiB per volume
- Asset names: bounded safe release names, validated before any upload
- Draft-first upload, fresh download verification, then immutable publication
- The publisher processes assets sequentially and requires source identity,
  rights evidence, byte count, signature-derived MIME, SHA-256, remote digest,
  and a fresh download round trip for every asset

## Failure modes

Signature mismatch, MIME mismatch, decode failure, dimension mismatch, changed
source SHA-1, wrong returned name, digest mismatch, missing rights record, mutable
URL, or incomplete round trip blocks publication.

## Security and privacy

SVG content is sanitized. PDF files receive validated previews. Display variants
never upscale. Missing media renders a local accessible placeholder with factual
recovery information.

## Verification

The current registry is an honest empty registry: no original media bytes have
been downloaded or published. The metadata contract and publisher checkpoint
are present in `data/media/release-volumes.json`, `lib/media-volumes.ts`, and
`scripts/publish-media-volumes.ps1`.

Run the no-upload validation path from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/publish-media-volumes.ps1 -ManifestPath data/media/release-volumes.json -SourceDirectory .
```

The `-Publish` switch is required before an asset upload is even attempted.
The script never creates a release or tag. The empty registry currently exits
without network transfer, and `npm run check:no-lfs` separately verifies that
standard Git LFS declarations and pointers are absent.

## Suggested articles

- [Rights and takedowns](rights-and-takedowns.md)
- [Stable cutoff](../import/stable-cutoff.md)
