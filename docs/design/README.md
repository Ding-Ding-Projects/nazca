# Design handoff

This category records the supplied reader redesign and its production mapping.
The handoff files remain in `design/`; this index explains which reference is
authoritative and where the implementation lives.

## Articles

- [Reader 1b handoff](reader-1b-handoff.md) records the selected direction,
  asset provenance, and an exact eight-state implementation inventory covering
  home, generic article, station article, year or stub, full destination list,
  dedicated search, redirect, and not-found routes.

## Scope

The reference prototype is a visual source only. The React reader keeps the
existing corpus, routes, redirect handling, source attribution, search workbench,
language settings, theme persistence, and local asset policy. Controls are
wired to those production behaviours rather than to prototype-only state. The
reader boundary shell also keeps desktop navigation and a four-action phone
bottom navigation available on redirect and not-found states.
