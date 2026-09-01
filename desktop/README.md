# Nazca Railway desktop shell

This folder contains the optional Windows desktop shell for the Nazca Railway static reader. It
opens the built reader from `../dist/client` through a loopback-only static server, so the reader
keeps its normal offline asset paths while the shell remains isolated from arbitrary local files.
When packaged, the desktop builder copies that same directory to `resources/site`; the runtime
uses that exact packaged location and never falls back to a source checkout from an installed app.

## Run

From this folder, fetch the pinned Electron package and launch:

```text
npm install
npm start
```

The parent project must have produced `dist/client/index.html` first. If that file or its
provenance is missing, the shell shows a visible recovery screen instead of claiming the reader
loaded.

For an explicitly requested local development server only, set `NAZCA_DESKTOP_DEV_URL` to a
localhost or `127.0.0.1` HTTP URL before starting. Other URLs are refused.

## Security boundary

The BrowserWindow uses context isolation, Chromium sandboxing, and disabled Node integration. The
preload exposes only read-only runtime provenance and an HTTPS-only external-link action. New
windows and navigations stay inside the loopback reader origin; explicit HTTPS links are handed to
the operating system, while other external destinations are refused. Renderer network requests to
non-local origins are cancelled.

## Provenance

The shell reports the static reader's `dist/client/provenance.json` values through
`window.nazcaDesktop.runtimeInfo()`. A missing or malformed record is displayed as unavailable,
never replaced with a launch timestamp or a guessed version.

The only remote image exception is the immutable public dim-sum release path used by the reader.
The runtime permits the catalog release URL and its release-asset redirect host for image requests
only. The Ollama manager's explicitly initiated local API calls are also allowed only for
`127.0.0.1:11434` or `localhost:11434`, with all other renderer network requests cancelled.
Missing media remains an honest broken image state owned by the reader.
