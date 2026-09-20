// Downloads publicly shared trial photos into public/plants/.
//
// This doesn't work with the current spreadsheet, the links are private so
// every request just gets the Dropbox sign-in page. Use import-photos.mjs.
// Keeping it in case the folder is ever shared as "anyone with the link".
//
//   node scripts/mirror-images.mjs [--force]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const DATA = resolve('./data/trials.json');
const OUT_DIR = resolve('./public/plants');
const force = process.argv.includes('--force');
const MAX_BYTES = 25 * 1024 * 1024;

const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

async function download(url, id) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();

  if (!type.startsWith('image/')) {
    // an HTML response is the Dropbox sign-in page, don't save it as a .jpg
    throw new Error(
      type.includes('html')
        ? 'got HTML, not an image - link is permission-gated or expired'
        : `expected an image, got "${type || 'unknown'}"`,
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error(`too big (${(buf.byteLength / 1e6).toFixed(1)}MB)`);

  const ext = EXT[type] ?? '.jpg';
  const file = resolve(OUT_DIR, id + ext);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);

  return { bytes: buf.byteLength, path: `/plants/${id}${ext}` };
}

const data = JSON.parse(await readFile(DATA, 'utf8'));

const jobs = data.cultivars
  .flatMap((c) => c.images.map((img, i) => ({
    img,
    cultivar: c,
    id: c.images.length > 1 ? `${c.id}-${i + 1}` : c.id,
  })))
  .filter(({ img }) => force || !img.mirrored);

if (!jobs.length) {
  console.log('everything is already local, nothing to do');
  process.exit(0);
}

console.log(`fetching ${jobs.length} images into public/plants/\n`);

let ok = 0;
const failed = [];

// one at a time, Dropbox rate limits parallel requests
for (const [n, job] of jobs.entries()) {
  const label = `${n + 1}/${jobs.length} ${job.id}`;
  try {
    const { bytes, path } = await download(job.img.url, job.id);
    job.img.local = path;
    job.img.thumb = path;
    job.img.mirrored = true;
    ok++;
    console.log(`${label} ok (${(bytes / 1024).toFixed(0)}KB)`);
  } catch (err) {
    failed.push({ id: job.id, name: job.cultivar.name, reason: err.message });
    console.log(`${label} FAILED ${err.message}`);
  }
}

data.meta.dataQuality.imagesMirrored = data.cultivars
  .reduce((n, c) => n + c.images.filter((i) => i.mirrored).length, 0);
data.meta.imagesMirroredAt = new Date().toISOString();

await writeFile(DATA, JSON.stringify(data, null, 2));

console.log(`\n${ok} downloaded, ${failed.length} failed`);

if (failed.length) {
  console.log('\nstill hotlinking:');
  failed.forEach((f) => console.log(`  ${f.name} (${f.id}): ${f.reason}`));

  const gated = failed.filter((f) => /HTML/.test(f.reason)).length;
  if (gated) {
    console.log(`\n${gated} of those are permission-gated, which this script can't get past.`);
    console.log('Download the folder from Dropbox and run:');
    console.log('  node scripts/import-photos.mjs <folder>');
  }
}

console.log('\nnext: npm run build');
