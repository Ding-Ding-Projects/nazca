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

Release mode remains intentionally blocked while required feature and evidence
rows are incomplete.
