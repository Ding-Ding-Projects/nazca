# Search and regular expressions

## Behavior

The current home search filters six local fixture records. The article search
filters six structured preview sections. Plain text is the default. Both fields
use the same adjacent anchored workbench and isolated local state.

## Current limits

The shared workbench uses `re2-wasm` 1.0.2 in a local Web Worker. It exposes the
real dialect, supported flags, unsupported backtracking constructs, capture
table, replacement preview, timing, local history, zero-width handling, and a
1,000-match result bound. Guided token construction, saved persistent snippets,
expected-result suites, token annotations, and match navigation remain pending.

## Failure modes

Invalid patterns produce an explicit pattern message rather than a false
zero-result state. Patterns are limited to 256 characters, each sample to 8 KiB,
the aggregate sample set to 2 MiB, and result output to 1,000 matches. When the
worker is unavailable, regex mode stays unavailable and never falls back to a
backtracking engine.

## Security and privacy

Current evaluation is local. Patterns and sample text are not transmitted.

## Verification

The hand-written search inventory and its negative check define the release
boundary. Every new field must have its own state, builder, activation target,
and focus-return target.

## Suggested articles

- [Atlas shell](atlas-shell.md)
- [Feature status](../features/README.md)
