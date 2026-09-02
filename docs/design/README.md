# Design handoff

This category records the supplied reader redesign and its production mapping.
The handoff files remain in `design/`; this index explains which reference is
authoritative and where the implementation lives.

## Articles

- [Reader 1b handoff](reader-1b-handoff.md) records the selected direction,
  screen and state inventory, asset provenance, and implementation mapping.

## Scope

The reference prototype is a visual source only. The React reader keeps the
existing corpus, routes, redirect handling, source attribution, search workbench,
language settings, theme persistence, and local asset policy. Controls are
wired to those production behaviours rather than to prototype-only state.
