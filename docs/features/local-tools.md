# Local browser tools

## Command palette and notifications

`Ctrl+Shift+F` opens a bounded command palette with its own RE2/WASM search.
Current commands navigate to Home, Settings, Tools, notifications, the Nazca
article, or toggle the theme. Exact-element teleport and full-window size remain
partial.

Notifications are stored in IndexedDB, appear as non-blocking corner cards, and
remain reviewable after dismissal. The Tools view supports search, dismiss, and
clear. Bulk export and destructive super confirmation remain pending.

## Authenticator

The local authenticator implements RFC 6238 with SHA-1, SHA-256, SHA-512, six to
eight digits, and configurable periods. It accepts `otpauth://totp/` URIs, manual
Base32 data, and QR image files. Pairing QR codes are generated locally and shown
only after an explicit reveal.

Authenticator entries are encrypted with AES-GCM under a non-extractable Web
Crypto key stored in IndexedDB. Ordinary exports and history omit secrets.
Current and next codes and a numeric countdown are visible. Grouping, reorder,
clock-skew detection, bulk actions, and a separate sensitive export remain
pending.

## File converter

Enabled browser adapters include bounded JSON formatting, simple unquoted CSV to
JSON, Base64 text, and PNG or JPEG to WebP. Image signatures and pixel bounds are
checked. The source remains unchanged and output downloads atomically as a Blob.

PDF, audio, video, ZIP, and 7z remain visible but unavailable because verified
bundled adapters are not present. Persistent queues, pause, resume, cancellation,
crash recovery, and complete PDF tools remain pending.

## Local model manager

The local model tool contacts `http://127.0.0.1:11434` only after the user presses
the check button. It reads the documented version and installed-tag endpoints.
Stopped, absent, HTTP, timeout, and CORS states remain explicit.

No cloud fallback, curated model list, arbitrary shell field, or executable
launcher exists. Official catalog pagination, hardware fit, batch pulls, chat,
attachments, snapshots, and restore remain pending.

## History and exports

Settings changes create append-only redacted local events with sequence, action,
target, timestamp, and summary. Search is available. Hash chaining, diff, restore,
date filtering, labels, and retention controls remain pending.

JSON and Markdown exports identify omitted private vocabulary, local credentials,
and authenticator secrets. Other formats stay visibly unavailable until they can
preserve every field. Visual Studio Code handoff is unavailable from this static
browser and is not represented by a fake action.

## Verification

RFC 6238 published vectors cover all three algorithms and six timestamps.
Malformed secret, algorithm, digit, and period cases are tested. Visitor-state
and regex focused tests cover their respective local contracts. Browser
interaction and capture evidence remain pending.

## Suggested articles

- [Visitor settings](visitor-settings.md)
- [Search and regex](../reader/search-and-regex.md)
- [Verification](../verification/README.md)
