# Reader 1b design handoff

## Decision

The supplied `Nazca Reader 1b.dc.html` is the selected production direction.
The dedicated 1b file is preferred over the three-direction overview because it
specifies the complete reader shell and includes desktop, phone, article, list,
and deferred-source states. The `.dc.html` files and `support.js` are preserved
as original handoff data in `design/` and are not imported by the production
bundle.

## Source record

| Item | Value |
| --- | --- |
| Archive copy | `design/handoff/Wiki design rewrite.zip` |
| Archive size | 81,903 bytes |
| Archive SHA-256 | `2fadc260047ae2b83d45e205801d2233331b8ac1fbe217854e0429d3a97efae1` |
| Selected reference | `design/Nazca Reader 1b.dc.html` |
| Supporting handoff files | `Nazca Reader - Current.dc.html`, `Nazca Reader - Rewrite.dc.html`, `Nazca Wiki - Rewrite.dc.html`, `support.js`, `.thumbnail` |
| Target framework | React with Next-compatible Vinext routing |
| Corpus boundary | 3,422 articles, 3,616 routes, 194 redirects |
| Runtime asset policy | Local production assets only, no remote font or icon stylesheet |

## Screen and state inventory

| ID | Reference state | Production route | Theme and viewport | Implementation |
| --- | --- | --- | --- | --- |
| reader-home | Home overview with route strip, quick destinations, corpus baseline, map placeholder, and provenance | `/` | Light or dark, desktop and phone | `components/nazca-shell.tsx`, `app/globals.css` |
| reader-article | Article-first layout with breadcrumbs, metadata tabs, rendered body, source card, and summary rail | `/wiki/<encoded-title>` | Light or dark, desktop and phone | `components/article-reader.tsx`, `app/globals.css` |
| reader-sections | Article section navigation and local search | Same article route | Light or dark, desktop and phone | `components/article-reader.tsx`, `components/search-workbench.tsx` |
| reader-list | Destination list reached from persistent navigation or a home card | `/?tab=stations`, `/?tab=lines`, `/?tab=places`, `/?tab=infrastructure` | Light or dark, desktop and phone | `components/nazca-shell.tsx` |
| reader-deferred | Maps, media, and timeline boundaries report missing source coverage without inventing content | `/?tab=maps`, `/?tab=media`, `/?tab=timeline` | Light or dark, desktop and phone | `components/nazca-shell.tsx` |

## Functional mapping

- The brand, breadcrumb, and every persistent navigation item are real buttons
  that route to Home or to a destination state using the existing shell.
- The article search uses the shared local search workbench and opens the exact
  matching heading, with its anchored regular-expression builder retained.
- Article section buttons update the active section and scroll to the exact
  rendered heading. Internal article links retain their corpus routes.
- The command button opens the existing command palette, the notification button
  opens the existing notification destination, and the theme button uses the
  existing persisted theme setting.
- The home route now uses a dedicated 1b composition: a route-colour strip,
  atlas hero with a local network illustration, destination cards, a six-item
  useful-record list, five-column corpus evidence, and a stacked map/provenance
  rail. Destination cards, record rows, brand, command, notification, and theme
  controls remain wired to their existing actions.
- The home layout collapses from two columns to a single reading column at
  tablet widths, then reduces destination and baseline grids to two columns on
  phone widths without hiding the evidence or deferred-state copy.
- Tables remain source data, but are placed in bounded scroll containers and
  receive readable borders, headers, spacing, and responsive overflow treatment.
- Phone layouts collapse the destination rail to a bottom icon strip, stack the
  summary rail, keep wide tables inside their own scroller, and preserve keyboard
  focus targets.

## Intentional deviations

- The handoff loads Google Fonts and a remote icon stylesheet. Production does not
  load those URLs. This preserves offline operation and the repository's local
  asset policy while retaining the condensed typographic hierarchy through local
  system fallbacks and the existing bundled icon package.
- The handoff contains illustrative sample records in some states. Production
  renders the generated corpus and explicit deferred states instead of presenting
  those samples as live records.
- Prototype controls that had no action are mapped to existing routes or are
  represented as descriptive content rather than shipped as inert controls.

## Verification boundary

This implementation lane is under the active ultra-speed delivery boundary.
Tests, lint, type checks, accessibility checks, security checks, browser
interactions, and screen captures were intentionally not run here. The next
verification lane must exercise the built output against the inventory above,
including desktop and phone layouts, both themes, all language modes, and exact
article and redirect routes.
