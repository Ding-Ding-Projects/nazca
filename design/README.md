# Nazca Railway design references

This folder stores the untouched handoff supplied for the reader redesign and the
small deterministic reference manifest used by the production implementation.
The production site remains authoritative: the `.dc.html` files are design data,
not runtime templates, and are never embedded by the reader.

The selected direction is `Nazca Reader 1b.dc.html`. It defines the article-first
shell, route-colour strip, persistent navigation, responsive phone treatment,
light/dark controls, article summary rail, and readable source tables. Remote
fonts and icon styles present in the handoff are intentionally not loaded by the
production surface; local system fonts and the existing bundled icon package
provide the equivalent treatment.

The original archive is retained at `handoff/Wiki design rewrite.zip` for review.
It is 81,903 bytes with SHA-256
`2fadc260047ae2b83d45e205801d2233331b8ac1fbe217854e0429d3a97efae1`.
