# Build and verification

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
