// Downloads every PLANT IMAGE 1 photo straight from its Dropbox shared link, for
// every sheet (evaluation date) in the workbook, then hands each date's folder to
// import-photos.mjs to resize and wire into trials.json.
//
// Fetching by the exact link beats matching a folder download by filename: every
// shoot renumbers from 1, so a filename alone can't tell one date's photo from
// another's, but the link points at one specific file.
//
// Run `npm run dropbox:auth` once first, then:
//   npm run dropbox:photos -- "../../data/InitiationData 2.xlsx"
//
// Flags: --force (re-download files already staged), --no-import (download only)

import XLSX from 'xlsx';
import { mkdir, writeFile, access, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const force = args.includes('--force');
const noImport = args.includes('--no-import');
const SRC = args.find((a) => !a.startsWith('--')) ?? '../../data/InitiationData 2.xlsx';
// outside the repo -- raw camera originals are large and don't belong in git
const STAGE = resolve('../../data/dropbox-photos');
const CONCURRENCY = 4;

const { DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN } = process.env;
if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
  console.error('Missing Dropbox credentials in .env.local -- run `npm run dropbox:auth` first.');
  process.exit(1);
}

const sheetToDate = (name) => {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(name.trim());
  if (!m) throw new Error(`Unexpected sheet name: ${name}`);
  return `${m[3]}-${m[1]}-${m[2]}`;
};
const filenameOf = (url) => {
  const m = /\/scl\/fi\/[^/]+\/([^?]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
};

// ---- collect every link, per date --------------------------------------------

const wb = XLSX.readFile(SRC);
const jobs = [];
const collisions = [];

for (const sheetName of wb.SheetNames) {
  const date = sheetToDate(sheetName);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  const seen = new Map(); // lowercased filename -> url, within this date

  for (const row of rows) {
    const url = typeof row['PLANT IMAGE 1'] === 'string' ? row['PLANT IMAGE 1'].trim() : '';
    if (!/^https?:\/\//i.test(url)) continue;
    const filename = filenameOf(url);
    if (!filename) continue;

    const key = filename.toLowerCase();
    const base = url.split('?')[0];
    if (seen.has(key)) {
      // import-photos matches by filename, so two *different* files sharing a name
      // on one date can't both be staged -- surface it rather than overwrite silently
      if (seen.get(key) !== base) collisions.push({ date, filename });
      continue;
    }
    seen.set(key, base);
    jobs.push({ date, url, filename, dest: join(STAGE, date, filename) });
  }
}

const dates = [...new Set(jobs.map((j) => j.date))].sort();
console.log(`${jobs.length} unique photo links across ${dates.length} date(s) in ${SRC}\n`);

// ---- auth --------------------------------------------------------------------

let accessToken = null;
async function refreshToken() {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: DROPBOX_REFRESH_TOKEN,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token refresh failed: ${body.error_description ?? res.status}`);
  accessToken = body.access_token;
}
await refreshToken();

// ---- download ----------------------------------------------------------------

const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(job, attempt = 1) {
  const res = await fetch('https://content.dropboxapi.com/2/sharing/get_shared_link_file', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ url: job.url }),
    },
  });

  if (res.status === 401 && attempt === 1) {
    await refreshToken(); // access tokens only last ~4h; long runs can outlive one
    return download(job, attempt + 1);
  }
  if (res.status === 429 && attempt <= 5) {
    const wait = Number(res.headers.get('retry-after') ?? 2 ** attempt) * 1000;
    await sleep(wait);
    return download(job, attempt + 1);
  }
  if (!res.ok) {
    let reason = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      // error_summary is often just "other/..." -- user_message carries the real cause
      reason = body.user_message?.text ?? body.error_summary ?? reason;
    } catch {}
    throw new Error(reason);
  }

  await mkdir(join(STAGE, job.date), { recursive: true });
  await writeFile(job.dest, Buffer.from(await res.arrayBuffer()));
}

let done = 0;
let skipped = 0;
const failed = [];
const queue = [...jobs];

async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    if (!force && await exists(job.dest)) { skipped++; continue; }
    try {
      await download(job);
      done++;
      if (done % 25 === 0) console.log(`  ${done} downloaded...`);
    } catch (err) {
      failed.push({ ...job, reason: err.message });
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\ndownloaded ${done}, already staged ${skipped}, failed ${failed.length}`);
if (failed.length) {
  console.log('\nfailed:');
  failed.forEach((f) => console.log(`  ${f.date}  ${f.filename}  -- ${f.reason}`));
  console.log('  shared_link_not_found / shared_link_access_denied usually means the account');
  console.log('  you authorized with can\'t open that link -- check it in a browser.');
}
if (collisions.length) {
  console.log('\nsame filename, different file, same date -- only the first was staged:');
  collisions.forEach((c) => console.log(`  ${c.date}  ${c.filename}`));
}

// ---- hand off to import-photos, one date at a time ---------------------------

if (noImport) {
  console.log(`\nstaged in ${STAGE}, skipping import (--no-import)`);
  process.exit(0);
}

for (const date of dates) {
  const dir = join(STAGE, date);
  if (!(await exists(dir)) || !(await readdir(dir)).length) continue;
  console.log(`\n=== importing ${date} ===`);
  // one run per date so same-numbered files from different shoots never meet
  const r = spawnSync(process.execPath, ['scripts/import-photos.mjs', dir, `--date=${date}`], {
    stdio: 'inherit',
  });
  if (r.status !== 0) console.log(`  import for ${date} exited with ${r.status}`);
}

console.log('\nnext: npm run build');
