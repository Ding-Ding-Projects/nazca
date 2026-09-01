# Desktop packaging

This directory defines the unsigned Windows Squirrel.Windows delivery for the
Nazca Railway desktop runtime. The browser deployment remains the primary
reader, while this package gives users an offline desktop shell around the same
static reader build.

## Required desktop package fields

`desktop/package.json` owns the runtime implementation and must provide:

- `name`: a stable lowercase package name, such as `nazca-railway-desktop`.
- `version`: the version used by the desktop package and its update feed.
- `main`: the runtime entry point that creates the desktop window.
- `build`: a mergeable object containing the settings from
  `desktop/packaging/electron-builder.yml`.
- `scripts.package:squirrel`: `node ../scripts/desktop/package-squirrel.mjs`.

The runtime lane must also provide `desktop/packaging/assets/nazca.ico` as a
real multi-resolution Windows icon. Run
`node scripts/desktop/generate-icon.mjs` to render the committed
`public/favicon.svg` source into lossless PNG frames at 16, 24, 32, 48, 64,
128, and 256 pixels inside one ICO container. The packaging helper refuses to
package when that file is absent or malformed, so a framework default icon
cannot slip into a release.

The static export is an explicit package input. The builder copies the parent
project's `dist/client/` directory to `resources/site/` in the installed
desktop payload. The runtime resolver must use its packaged resources root for
that path, while development may continue to use `dist/client/`. The helper
requires both `dist/client/index.html` before packaging and a matching
`resources/site/index.html` entry inside the resulting full `.nupkg`.

The same operation is available to Windows build automation through
`scripts/desktop/package-squirrel.ps1`. Pass `-Silent` for non-interactive use
and `-Output` to choose a generated output directory.

The runtime must use a frameless window with a custom title bar, load the local
static reader entry, and resolve bundled files from its packaged resources. The
desktop package must include `electron-builder` and
`electron-builder-squirrel-windows` version `26.15.3` in its own manifest or
workspace lockfile. The package must not rely on a globally installed builder.

## Output contract

The packaging helper writes into `dist/desktop/squirrel-windows/` and validates
the real output before reporting success:

- `Setup.exe` is present and reports `NotSigned`.
- `RELEASES` is present and references the full `.nupkg`.
- The full `.nupkg` is present, readable as a ZIP, and contains the package
  manifest and packaged runtime payload.
- Delta packages are retained when the builder emits them.
- `release-manifest.json` records the exact source commit, version, output
  filenames, byte counts, and SHA-256 digests.

Signing inputs are explicitly disabled. The helper never requests a signing
certificate and never publishes or creates a release.
