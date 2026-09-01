# Visitor settings

## Behavior

Visitor settings are versioned under `VisitorStateV1`. Language, separate English
and Cantonese funny levels, dialog emoji preference, theme, density, seed color,
display name, narrator settings, schedules, and five independent attention modes
are stored locally.

The Settings workspace uses browser-style local tabs. Each active tab has its own
search field and anchored RE2/WASM workbench.

## Persistence

Tiny boot theme data uses localStorage. Versioned settings use IndexedDB. A
BroadcastChannel notifies other open tabs of newer revisions. Personal vocabulary
and local credentials use a separate IndexedDB store.

## Personal vocabulary

The visible file control accepts a local JSON document with schema version
`1.0.0` and at most 2,000 bounded string replacements. Files above 256 KiB,
malformed JSON, unknown fields, duplicate source keys, unsafe object keys, or
unsupported versions are rejected as a whole. No network request is made.

## School mode

The mode can be renamed. When enabled, the active interface forces English and
removes Cantonese, bilingual, funny-level, and personal-vocabulary controls. A
PBKDF2-derived local credential controls exit. This is an experience lock, not a
security boundary. Clearing this origin’s browser storage is the recovery route.

## Narrator

The narrator is off by default. Browser voices are enumerated initially and again
after `voiceschanged`. English and Cantonese keep independent stable voice IDs.
Rate and pitch are bounded. The current surface includes a local preview; the
complete serialized event queue and screen-reader coordination remain pending.

## Schedules and attention modes

Local schedules store an every-day time window and optional language or theme
override. Editing exists; automatic rule evaluation and external HTTPS or Home
Assistant sources remain pending.

Focus, Low stimulation, Time awareness, One thing at a time, and Momentum are
independently stored and off by default. Focus and Low stimulation already affect
the shell. The remaining live behaviors are still partial.

## Failure modes and privacy

Corrupt or unsupported state produces an honest browser-storage message. Private
vocabulary data, credentials, and future authenticator secrets are omitted from
ordinary exports, logs, captures, prompts, and public records.

## Verification

Focused tests cover default state, strict unknown-field rejection, value bounds,
schedule validation, vocabulary success, duplicate and unsafe keys, and the hard
file-size limit. Browser IndexedDB, cross-tab, voice, and credential interaction
tests remain pending.

## Suggested articles

- [Search and regex](../reader/search-and-regex.md)
- [Feature status](README.md)
