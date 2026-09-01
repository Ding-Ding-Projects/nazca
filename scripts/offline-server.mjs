#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function resolveRequest(requestUrl) {
  const url = new URL(requestUrl, `http://127.0.0.1:${PORT}`);
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const candidates = [
    relative || 'index.html',
    `${relative}.html`,
    path.join(relative, 'index.html'),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(ROOT, candidate);
    if (
      !resolved.startsWith(`${ROOT}${path.sep}`) &&
      resolved !== path.join(ROOT, 'index.html')
    ) {
      continue;
    }
    if (existsSync(resolved) && statSync(resolved).isFile()) return resolved;
  }
  return null;
}

const server = createServer((request, response) => {
  const target = resolveRequest(request.url || '/');
  if (!target) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type':
      MIME.get(path.extname(target).toLocaleLowerCase()) ||
      'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(target).pipe(response);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Nazca Railway offline bundle: http://127.0.0.1:${PORT}/`);
});
