# Search and regular expressions

## Behavior

The current home search filters six local fixture records. The article search
filters six structured preview sections. Plain text is the default. The home
route has an adjacent anchored regex preview, and the article route has a bounded
regex mode.

## Current limits

The complete shared workbench is not implemented. Guided construction, dialect
capabilities, token annotations, capture tables, replacement preview, saved
cases, profiling, match navigation, and a worker-isolated engine remain pending.

## Failure modes

Invalid article patterns produce an explicit pattern message rather than a false
zero-result state. Article patterns are limited to 256 characters and six local
sections. The home preview is still JavaScript-engine based and must move behind
the shared bounded engine before release.

## Security and privacy

Current evaluation is local. Patterns and sample text are not transmitted.

## Verification

The hand-written search inventory and its negative check define the release
boundary. Every new field must have its own state, builder, activation target,
and focus-return target.

## Suggested articles

- [Atlas shell](atlas-shell.md)
- [Feature status](../features/README.md)
