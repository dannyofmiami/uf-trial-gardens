// Serves the static build in out/ with the security headers from staticwebapp.config.json,
// the way Azure Static Web Apps would send them, so tests catch headers that break the site.
//
//   node tests/serve.mjs            (PORT, default 3300)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const ROOT = resolve('out');
const PORT = Number(process.env.PORT ?? 3300);
const { globalHeaders = {} } = JSON.parse(await readFile('staticwebapp.config.json', 'utf8'));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(400).end(); return; }
  let status = 200;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
  } catch {
    file = join(ROOT, '404.html');
    status = 404;
  }
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...globalHeaders });
  res.end(await readFile(file));
}).listen(PORT, '127.0.0.1', () => console.log(`serving out/ with SWA headers on http://127.0.0.1:${PORT}`));
