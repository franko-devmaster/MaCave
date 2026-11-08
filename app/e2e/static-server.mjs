// Sert dist/app/browser sous /MaCave/, comme GitHub Pages (404.html = index.html pour les routes profondes).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist/app/browser/', import.meta.url));
const BASE = '/MaCave/';
const PORT = Number(process.env.PORT ?? 4310);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (!path.startsWith(BASE)) {
    res.writeHead(302, { Location: BASE }).end();
    return;
  }
  const relative = normalize(path.slice(BASE.length)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, relative);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(ROOT, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Ma Cave sur http://localhost:${PORT}${BASE}`));
