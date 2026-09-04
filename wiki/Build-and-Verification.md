# Build and verification

## v0.1.1 home-design correction

The home-design correction is implemented by
`c0f8aafcae2baf94c879ea746c349a3b92a9a75d` and integrated at
`134ba0c5a127b4e87319199777399b48e2b59a05`. It introduces the atlas hero,
destination navigation, evidence and network panels, provenance context, and a
responsive phone composition. The expected v0.1.1 release URL is
https://github.com/Ding-Ding-Projects/nazca/releases/tag/v0.1.1, which remains a
release target until external publication and asset verification are complete.
The raw `nazca-current-corpus-0.1.0.zip` archive identity is retained. The
public Pages URL remains https://ding-ding-projects.github.io/nazca/.

The correction lane intentionally ran no tests, browser interactions, or
screenshots. The configured Sites project is unavailable, and the GitHub Wiki
is intentionally uninitialized.

## Windows build

```bat
download-dependencies.bat /s
build.bat /s
build-installer.bat /s
```

The last command creates an offline static website ZIP. It is not a native
installer.

## Local checks

```sh
npm run build
npm run build:pages
npm exec tsc -- --noEmit
npm run format -- --check
npm run check:no-lfs
npm run check:coverage
npm run check:coverage:self-test
```

TypeScript must cover the generated redirect registry and the Reader 1b
redirect/not-found boundary. Lint discovery excludes dependency trees,
including the desktop package's nested `node_modules` directory.
Static Pages verification requires the Reader 1b article header's accessible
home control rather than an anchor from the superseded shell.

Release mode remains intentionally blocked while required feature and evidence
rows are incomplete.

## Reader-first home reorganization

The GitHub Pages home is now a linear encyclopedia directory with working Search
and Explore actions, subject navigation, featured records, and concise source
notes. The redundant home status rail has been removed; other destinations keep
their contextual rail. The project-path Pages build is the minimum programmatic
check for this revision. Browser interaction, accessibility, and capture remain
required release evidence and must not be inferred from the static build alone.

## Compact-layout regression boundary

The mobile shell uses three explicit tracks for the header, route stripe, and
content. Verification should cover 320 px and 608 px widths, horizontal dock
scrolling, safe-area padding, long featured-record names, search popovers, and
the absence of page-level horizontal overflow. A successful static build alone
does not substitute for that runtime capture.
