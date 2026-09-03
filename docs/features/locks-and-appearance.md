# Element context menus, appearance, and local locks

## Context menus

The global context host assigns deterministic page-order identifiers to rendered
elements that do not already carry a source identifier. Right-click, Shift+F10,
and a 650 ms touch hold open a target-specific menu. Menu actions are searchable
through their own anchored RE2/WASM workbench.

Imported content will replace generated identifiers with stable page, section,
paragraph, link, image, table-cell, and state IDs during the final corpus import.

Target labels prefer an explicit `aria-label` or `title`. When neither exists,
the host reads only text nodes owned directly by the selected element, then
falls back to its semantic role or tag plus its generated element identifier.
This prevents a broad container from presenting the concatenated text of its
descendant navigation as one misleading label. The fix is implemented in
`components/context-menu-host.tsx` at commit
`a5cb9d7aba63cf3347ade74539ff730717793292`. TypeScript validation in the clean
lane remains unavailable until the declared type packages are installed; the
reported missing packages were `@cloudflare/workers-types`, `node`, and
`vinext/types`.

## Appearance

The current non-destructive editor changes text color, background, font size, and
corner radius for one exact element. Overrides apply live and persist locally in
IndexedDB. Property search and focus return are present.

Full layered editing, state inheritance, typography depth, image tools, infinite
color translation, rainbow mode, presets, copy and paste, undo, diagnostics, and
portable theme export remain pending.

## Local locks

Each element lock independently selects one of six policies:

- PIN
- password
- PIN plus password
- password plus TOTP
- PIN plus TOTP
- password plus PIN plus TOTP

PIN and password answers are PBKDF2-derived with independent random salts. Lock
records, including TOTP material, are encrypted with AES-GCM under a
non-extractable Web Crypto key in IndexedDB.

The host intercepts pointer clicks, Enter, Space, and programmatic click events in
the capture phase. A locked target opens its own local unlock panel and does not
run the protected action. PIN entry provides both manual input and a large keypad.
Unlock duration can cover one activation, five minutes, thirty minutes, or the
current page session. Relock and remove actions are available.

## Safety and recovery

The UI says plainly that this is an experience lock for fun, not encryption or
protection from another person using the browser. Five wrong attempts produce a
thirty-second local delay. Clearing this origin’s browser storage resets all
local locks. Support Tickets provide the same recovery explanation.

## Verification

Focused tests exercise factor detection, all six policies, correct and incorrect
answers, and missing or malformed factors. Browser interception, touch, focus,
alternate activation, persistence, and capture evidence remain pending.

## Suggested articles

- [Local browser tools](local-tools.md)
- [Visitor settings](visitor-settings.md)
- [Verification](../verification/README.md)
