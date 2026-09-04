# Verification and evidence

## Local checks

- Sites and GitHub Pages builds
- TypeScript and formatting
- importer and parser tests
- feature and search inventories
- accessibility, privacy, and layout checks
- media and rights validation
- offline bundle and update behavior

The redirect route check includes the registry's array shape, null-safe state
narrowing, and the semantic status exposed while the shared search index loads.
The static artifact check also locates the Reader 1b home button by its
accessible label, matching the production interaction contract.

GitHub Actions builds, packages, deploys, and publishes. It does not run tests,
lint, type checks, accessibility checks, or capture checks.

## Runtime evidence

Real interface evidence must come from the built output on an isolated headless
desktop. Required tuples include normal and minimum widths, English, Cantonese,
bilingual, light, dark, reduced motion, and 100%, 125%, 150%, and 200% scales.

No runtime screenshots or recording exist yet. Design JSON and generated social
artwork do not count as built-interface evidence.

## Negative checks

Inventory checks include a self-test that removes an exact required row in
memory, proves validation fails, then restores the full inventory and proves it
passes. Release checks also require every evidence path to exist and match the
current source and build hashes.

## Suggested articles

- [Feature status](../features/README.md)
- [Deployments](../delivery/deployments.md)
