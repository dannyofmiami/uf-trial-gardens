// Local admin API for development: run it next to `npm run dev:admin`.
//
//   npm run admin:server        (reads ADMIN_PASSWORD from .env.local)
//

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createAdminApi } from '../server/admin-core.mjs';
import { fileStore } from '../server/stores.mjs';

const PORT = Number(process.env.ADMIN_PORT ?? 3001);
const ORIGIN = process.env.ADMIN_ALLOWED_ORIGIN ?? 'http://localhost:3000';
const BASE = '/api/admin';

let api;
try {
  api = createAdminApi({
    password: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
    store: fileStore(resolve('public/content/banner.json')),
  });
} catch (err) {
  console.error(`${err.message}\nAdd ADMIN_PASSWORD=... to .env.local (see .env.example).`);
  process.exit(1);
}

createServer(async (req, res) => {
  // the dev site runs on another port, so allow exactly that origin
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith(BASE)) { res.writeHead(404).end(); return; }
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) { res.writeHead(413).end(); return; }
  }
  const out = await api.handle({
    method: req.method, path: path.slice(BASE.length), headers: req.headers, body, ip: req.socket.remoteAddress,
  });
  res.writeHead(out.status, out.headers).end(out.body);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`admin API on http://127.0.0.1:${PORT}${BASE} (accepting requests from ${ORIGIN})`);
});
