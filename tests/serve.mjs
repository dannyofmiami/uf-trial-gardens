// Serves the static build in out/ with the security headers from staticwebapp.config.json,
// the way the production host would send them, so tests catch headers that break the site.
// It also mounts the admin API at /api/admin on the same origin -- the setup recommended
// for AWS (CloudFront routing /api/admin/* to the API) -- saving to out/content/banner.json.
//
//   ADMIN_PASSWORD=... node tests/serve.mjs     (PORT, default 3300)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { createAdminApi } from '../server/admin-core.mjs';
import { fileStore } from '../server/stores.mjs';

const ROOT = resolve('out');
const PORT = Number(process.env.PORT ?? 3300);
const API_BASE = '/api/admin';
const { globalHeaders = {} } = JSON.parse(await readFile('staticwebapp.config.json', 'utf8'));
const admin = process.env.ADMIN_PASSWORD
  ? createAdminApi({ password: process.env.ADMIN_PASSWORD, store: fileStore(join(ROOT, 'content/banner.json')) })
  : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.txt': 'text/plain', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (admin && path.startsWith(API_BASE)) {
    let body = '';
    for await (const chunk of req) body += chunk;
    const out = await admin.handle({
      method: req.method, path: path.slice(API_BASE.length), headers: req.headers, body, ip: req.socket.remoteAddress,
    });
    res.writeHead(out.status, { ...globalHeaders, ...out.headers }).end(out.body);
    return;
  }

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
}).listen(PORT, '127.0.0.1', () => console.log(`serving out/ with production headers on http://127.0.0.1:${PORT}`));
