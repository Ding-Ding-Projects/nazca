import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DESKTOP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const PROJECT_ROOT = path.resolve(DESKTOP_ROOT, '..');
const DEV_URL = process.env.NAZCA_DESKTOP_DEV_URL?.trim() || '';
const DEV_ORIGIN = isAllowedDevUrl(DEV_URL) ? new URL(DEV_URL).origin : '';
const PRODUCT_NAME = 'Nazca Railway';
const USER_AGENT = 'NazcaRailwayDesktop/0.1.0 (offline static reader)';
const RELEASE_MEDIA_PATH =
  '/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/';
const LOOPBACK_API_ORIGINS = new Set([
  'http://127.0.0.1:11434',
  'http://localhost:11434',
]);

let mainWindow;
let staticServer;
let staticOrigin;

function getStaticRoot() {
  return app.isPackaged
    ? path.resolve(process.resourcesPath, 'site')
    : path.join(PROJECT_ROOT, 'dist', 'client');
}

async function getSafeStaticRoot() {
  const logicalRoot = getStaticRoot();
  let current = logicalRoot;
  while (true) {
    const details = await lstat(current);
    if (details.isSymbolicLink())
      throw new Error(
        'The static reader path contains a symbolic link or reparse point.',
      );
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return realpath(logicalRoot);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function readProvenance() {
  try {
    const value = JSON.parse(
      await readFile(
        path.join(await getSafeStaticRoot(), 'provenance.json'),
        'utf8',
      ),
    );
    const valid =
      value &&
      value.schemaVersion === '1.0.0' &&
      typeof value.version === 'string' &&
      typeof value.builtAt === 'string' &&
      typeof value.timezone === 'string';
    return valid
      ? value
      : {
          status: 'unavailable',
          reason: 'The static build provenance is incomplete.',
        };
  } catch {
    return {
      status: 'unavailable',
      reason:
        'No valid static build provenance was found. Build the reader before launching it.',
    };
  }
}

function failureMarkup(title, reason, provenance) {
  const provenanceLine =
    provenance.status === 'unavailable'
      ? provenance.reason
      : `Reader build ${provenance.version}, built ${provenance.builtAt} ${provenance.timezone}.`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · ${PRODUCT_NAME}</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f7f8fa;color:#17212b}
@media(prefers-color-scheme:dark){:root{background:#111518;color:#eef1f3}}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
main{width:min(680px,100%);padding:32px;border:1px solid #c9d1d8;border-radius:24px;background:#fff;box-shadow:0 12px 36px #17212b22}
@media(prefers-color-scheme:dark){main{background:#1b2227;border-color:#45515b;box-shadow:0 12px 36px #0008}}
h1{margin:0 0 12px;font-size:clamp(1.6rem,4vw,2.3rem)}p{line-height:1.55}code{overflow-wrap:anywhere}
.status{border-left:4px solid #ad2f31;padding:12px 16px;background:#fff1f1;border-radius:8px}
@media(prefers-color-scheme:dark){.status{background:#3a2022}}
</style></head><body><main role="alert"><h1>${escapeHtml(title)}</h1>
<p class="status">${escapeHtml(reason)}</p><p>${escapeHtml(provenanceLine)}</p>
<p>This desktop shell is offline-first. It does not fetch reader content from the source service.</p>
</main></body></html>`;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.wasm': 'application/wasm',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain; charset=utf-8',
    }[extension] || 'application/octet-stream'
  );
}

async function resolveStaticFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/') || decoded.includes('\0')) return null;
  const relative = decoded.replace(/^\/+/, '');
  const staticRoot = await getSafeStaticRoot();
  const candidate = path.resolve(staticRoot, relative || 'index.html');
  const rootPrefix = `${staticRoot}${path.sep}`;
  if (candidate !== staticRoot && !candidate.startsWith(rootPrefix))
    return null;
  const possible = [candidate];
  if (!path.extname(candidate)) {
    possible.push(`${candidate}.html`, path.join(candidate, 'index.html'));
  }
  for (const filePath of possible) {
    try {
      const canonicalPath = await realpath(filePath);
      if (canonicalPath !== staticRoot && !canonicalPath.startsWith(rootPrefix))
        throw new Error(
          'The requested static asset resolves outside the packaged reader.',
        );
      const details = await stat(canonicalPath);
      if (details.isFile()) return canonicalPath;
    } catch {
      // Continue to the next safe candidate. Unsafe paths are not served.
    }
  }
  return null;
}

async function startStaticServer() {
  const staticRoot = await getSafeStaticRoot();
  if (!existsSync(path.join(staticRoot, 'index.html'))) {
    throw new Error(
      app.isPackaged
        ? 'The packaged reader is missing resources/site/index.html. Rebuild the desktop package with the static reader resource.'
        : 'The static build is missing dist/client/index.html. Run the static export first.',
    );
  }
  staticServer = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; connect-src 'self' http://127.0.0.1:11434 http://localhost:11434; img-src 'self' data: https://github.com https://release-assets.githubusercontent.com; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const filePath = await resolveStaticFile(requestUrl.pathname);
    if (!filePath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'no-cache',
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  });
  await new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      staticServer.off('error', reject);
      resolve();
    });
  });
  const address = staticServer.address();
  if (!address || typeof address === 'string')
    throw new Error('The local static server did not expose a port.');
  staticOrigin = `http://127.0.0.1:${address.port}`;
  return staticOrigin;
}

function isAllowedDevUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

function isAllowedLocalUrl(value) {
  try {
    const url = new URL(value);
    return (
      Boolean(staticOrigin && url.origin === staticOrigin) ||
      Boolean(DEV_ORIGIN && url.origin === DEV_ORIGIN)
    );
  } catch {
    return false;
  }
}

function isAllowedReleaseMedia(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.origin === 'https://github.com')
      return url.pathname.startsWith(RELEASE_MEDIA_PATH);
    return (
      url.origin === 'https://release-assets.githubusercontent.com' &&
      /\.(?:png|jpe?g|webp|gif)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function isAllowedDevOriginUrl(value) {
  try {
    return Boolean(DEV_ORIGIN && new URL(value).origin === DEV_ORIGIN);
  } catch {
    return false;
  }
}

function isAllowedLoopbackApiUrl(value) {
  try {
    return LOOPBACK_API_ORIGINS.has(new URL(value).origin);
  } catch {
    return false;
  }
}

function openExplicitExternal(urlValue) {
  try {
    const url = new URL(urlValue);
    if (url.protocol === 'https:') {
      void shell.openExternal(url.href);
      return true;
    }
  } catch {
    // Invalid or non-HTTPS URLs are intentionally refused.
  }
  return false;
}

function configureNavigationPolicy(window) {
  const contents = window.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    openExplicitExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (isAllowedLocalUrl(url)) return;
    event.preventDefault();
    openExplicitExternal(url);
  });
  contents.on('will-redirect', (event, url) => {
    if (isAllowedLocalUrl(url)) return;
    event.preventDefault();
    openExplicitExternal(url);
  });
  contents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || validatedUrl.startsWith('data:text/html')) return;
      void showFailure(
        window,
        `Reader load failed (${errorCode})`,
        errorDescription || 'The built reader could not be loaded.',
      );
    },
  );
  contents.on('render-process-gone', (_event, details) => {
    void showFailure(
      window,
      'Reader process stopped',
      `The reader process stopped with status ${details.reason}. Relaunch the desktop shell after checking the static build.`,
    );
  });
}

async function showFailure(window, title, reason) {
  const provenance = await readProvenance();
  await window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(failureMarkup(title, reason, provenance))}`,
  );
}

async function createMainWindow() {
  const provenance = await readProvenance();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 320,
    minHeight: 480,
    show: false,
    frame: false,
    title: PRODUCT_NAME,
    backgroundColor: '#f7f8fa',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(DESKTOP_ROOT, 'src', 'preload.mjs'),
      spellcheck: false,
    },
  });
  configureNavigationPolicy(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });

  if (DEV_URL) {
    if (!isAllowedDevUrl(DEV_URL)) {
      await showFailure(
        mainWindow,
        'Development URL refused',
        'NAZCA_DESKTOP_DEV_URL must be an explicit localhost or 127.0.0.1 HTTP URL.',
      );
      return;
    }
    await mainWindow.loadURL(DEV_URL, {
      extraHeaders: `User-Agent: ${USER_AGENT}\n`,
    });
    return;
  }

  try {
    const origin = await startStaticServer();
    await mainWindow.loadURL(origin, {
      extraHeaders: `User-Agent: ${USER_AGENT}\n`,
    });
  } catch (error) {
    await showFailure(
      mainWindow,
      'Static reader unavailable',
      error instanceof Error ? error.message : String(error),
    );
  }
  if (provenance.status !== 'unavailable') {
    mainWindow.setTitle(`${PRODUCT_NAME} · ${provenance.version}`);
  }
}

void app.whenReady().then(async () => {
  app.setAppUserModelId('com.dingdingprojects.nazca');
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      const allowed =
        isAllowedLocalUrl(details.url) ||
        isAllowedDevOriginUrl(details.url) ||
        ((details.resourceType === 'xhr' ||
          details.resourceType === 'fetch' ||
          details.resourceType === 'websocket') &&
          isAllowedLoopbackApiUrl(details.url)) ||
        (details.resourceType === 'image' &&
          isAllowedReleaseMedia(details.url));
      callback({ cancel: !allowed });
    },
  );
  ipcMain.handle('desktop:runtime-info', async () => {
    const provenance = await readProvenance();
    return {
      product: PRODUCT_NAME,
      desktopVersion: app.getVersion(),
      provenance,
      mode: DEV_URL ? 'development-override' : 'built-static',
      digest: createHash('sha256')
        .update(`${PRODUCT_NAME}:${app.getVersion()}`)
        .digest('hex'),
    };
  });
  ipcMain.handle('desktop:open-external', (_event, url) =>
    openExplicitExternal(url),
  );
  await createMainWindow();
  app.on('activate', () => {
    if (!mainWindow) void createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  staticServer?.close();
  staticServer = undefined;
});
