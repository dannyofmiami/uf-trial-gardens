// One-time setup: trades a Dropbox authorization code for a long-lived refresh
// token and saves it to .env.local (gitignored), so dropbox-photos.mjs can sign
// itself in on every future run without anyone regenerating a token.
//
// Put DROPBOX_APP_KEY and DROPBOX_APP_SECRET in .env.local first, then:
//   npm run dropbox:auth

import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';

const ENV_FILE = resolve('./.env.local');
const key = process.env.DROPBOX_APP_KEY;
const secret = process.env.DROPBOX_APP_SECRET;

if (!key || !secret) {
  console.error('Add these two lines to .env.local first (from the app\'s Settings tab):');
  console.error('  DROPBOX_APP_KEY=...');
  console.error('  DROPBOX_APP_SECRET=...');
  process.exit(1);
}

const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
authUrl.searchParams.set('client_id', key);
authUrl.searchParams.set('response_type', 'code');
// offline = hand back a refresh token, not just a 4-hour access token
authUrl.searchParams.set('token_access_type', 'offline');

console.log('1. Open this link, sign in, and click Allow:\n');
console.log(`   ${authUrl}\n`);
console.log('2. Dropbox will show you a code. Paste it here.\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question('Code: ')).trim();
rl.close();

const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
  method: 'POST',
  body: new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: key,
    client_secret: secret,
  }),
});
const body = await res.json();

if (!res.ok || !body.refresh_token) {
  console.error('\nDropbox rejected the code:', body.error_description ?? body.error ?? res.status);
  console.error('Codes are single-use and expire quickly, so run this again for a fresh one.');
  process.exit(1);
}

let env = '';
try { env = await readFile(ENV_FILE, 'utf8'); } catch {}
env = env.replace(/^DROPBOX_REFRESH_TOKEN=.*\n?/m, '');
if (env && !env.endsWith('\n')) env += '\n';
await writeFile(ENV_FILE, `${env}DROPBOX_REFRESH_TOKEN=${body.refresh_token}\n`);

console.log(`\nSaved refresh token to ${ENV_FILE}. Next: npm run dropbox:photos`);
