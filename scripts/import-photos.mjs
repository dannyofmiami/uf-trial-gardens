// Copies trial photos from a Dropbox download into public/plants/.
//
// The links in the spreadsheet are private so they can't be fetched or hotlinked.
// Download the folder from Dropbox by hand and point this script at it.
//
//   node scripts/import-photos.mjs ~/Downloads/TrialPhotos
//
// Photos are matched by original filename (the end of each Dropbox link,
// like BAL_0001.JPG). All 86 are unique.
//
// Flags: --dry-run, --keep-original

import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { resolve, basename, extname, join } from 'node:path';

const DATA = resolve('./data/trials.json');
const OUT_DIR = resolve('./public/plants');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepOriginal = args.includes('--keep-original');
const srcArg = args.find((a) => !a.startsWith('--'));

if (!srcArg) {
  console.error('usage: node scripts/import-photos.mjs <photo-folder> [--dry-run] [--keep-original]');
  process.exit(1);
}

// resize the photos
let sharp = null;
if (!keepOriginal) {
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn('sharp not installed, copying originals at full size.');
    console.warn('run `npm i -D sharp` first unless you know the files are small.\n');
  }
}

const DETAIL_W = 1400;
const THUMB_W = 480;

async function indexFiles(dir) {
  const found = new Map();

  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch (err) {
      throw new Error(`can't read ${d}: ${err.message}`);
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === '__MACOSX') continue;
      const full = join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else found.set(e.name.toLowerCase(), full);
    }
  }

  await walk(dir);
  return found;
}

function originalName(url) {
  const m = /\/scl\/fi\/[^/]+\/([^?]+)/.exec(url ?? '');
  return m ? decodeURIComponent(m[1]) : null;
}

const data = JSON.parse(await readFile(DATA, 'utf8'));
const available = await indexFiles(resolve(srcArg));
console.log(`${available.size} files in ${srcArg}\n`);

const jobs = [];
for (const c of data.cultivars) {
  c.images.forEach((img, i) => {
    const wanted = originalName(img.source) ?? originalName(img.url);
    jobs.push({
      cultivar: c,
      img,
      id: c.images.length > 1 ? `${c.id}-${i + 1}` : c.id,
      wanted,
      src: wanted ? available.get(wanted.toLowerCase()) : undefined,
    });
  });
}

const matched = jobs.filter((j) => j.src);
const unmatched = jobs.filter((j) => !j.src);
const used = new Set(matched.map((j) => j.src));
const extras = [...available.values()].filter((f) => !used.has(f));

console.log(`matched ${matched.length}/${jobs.length} spreadsheet photos`);

if (!matched.length) {
  console.error('\nNothing matched. Wrong folder, or the files were renamed?');
  console.error('Expected names like BAL_0001.JPG.');
  process.exit(1);
}

if (dryRun) {
  matched.slice(0, 8).forEach((j) => console.log(`  ${j.wanted} -> plants/${j.id}`));
  if (matched.length > 8) console.log(`  ...and ${matched.length - 8} more`);
} else {
  await mkdir(OUT_DIR, { recursive: true });
}

let bytes = 0;
const failed = [];

for (const [n, job] of matched.entries()) {
  const label = `${n + 1}/${matched.length} ${job.id}`;

  if (dryRun) continue;

  try {
    if (sharp) {
      const detail = join(OUT_DIR, `${job.id}.webp`);
      const thumb = join(OUT_DIR, `${job.id}-thumb.webp`);

      // rotate() fixes the portrait photos that come out sideways,
      // withoutEnlargement so small photos don't get stretched
      await sharp(job.src).rotate()
        .resize({ width: DETAIL_W, withoutEnlargement: true })
        .webp({ quality: 82 }).toFile(detail);
      await sharp(job.src).rotate()
        .resize({ width: THUMB_W, withoutEnlargement: true })
        .webp({ quality: 78 }).toFile(thumb);

      job.img.local = `/plants/${job.id}.webp`;
      job.img.thumb = `/plants/${job.id}-thumb.webp`;
      bytes += (await stat(detail)).size + (await stat(thumb)).size;
    } else {
      const ext = extname(job.src) || '.jpg';
      const dest = join(OUT_DIR, `${job.id}${ext}`);
      await copyFile(job.src, dest);
      job.img.local = `/plants/${job.id}${ext}`;
      job.img.thumb = job.img.local;
      bytes += (await stat(dest)).size;
    }

    job.img.mirrored = true;
    console.log(`${label} ok`);
  } catch (err) {
    failed.push({ id: job.id, name: job.cultivar.name, reason: err.message });
    console.log(`${label} FAILED ${err.message}`);
  }
}

if (!dryRun) {
  data.meta.dataQuality.imagesMirrored = data.cultivars
    .reduce((n, c) => n + c.images.filter((i) => i.mirrored).length, 0);
  data.meta.photosImportedAt = new Date().toISOString();
  await writeFile(DATA, JSON.stringify(data, null, 2));

  console.log(`\nimported ${matched.length - failed.length} into public/plants/`);
  console.log(`total ${(bytes / 1e6).toFixed(1)}MB${sharp ? ' (webp)' : ' (originals)'}`);
  if (bytes > 200e6) {
    console.log('WARNING: over 200MB. Static Web Apps free tier stops at 250MB.');
  }
}

if (unmatched.length) {
  console.log(`\n${unmatched.length} spreadsheet photos had no file:`);
  unmatched.slice(0, 15).forEach((u) => {
    console.log(`  ${u.cultivar.name} (wanted ${u.wanted ?? 'no filename in URL'})`);
  });
  if (unmatched.length > 15) console.log(`  ...and ${unmatched.length - 15} more`);
  console.log('  These keep their placeholder. Files may have been renamed.');
}

if (extras.length) {
  console.log(`\n${extras.length} downloaded files matched nothing in the sheet:`);
  extras.slice(0, 10).forEach((f) => console.log(`  ${basename(f)}`));
  if (extras.length > 10) console.log(`  ...and ${extras.length - 10} more`);
  console.log('  Maybe not in the sheet yet, or extra angles.');
}

if (failed.length) {
  console.log('\nfailed to process:');
  failed.forEach((f) => console.log(`  ${f.name} (${f.id}): ${f.reason}`));
}

const noPhoto = data.cultivars.filter((c) => !c.images.length).length;
if (noPhoto) console.log(`\n${noPhoto} cultivars have no photo in the sheet at all (N/A).`);

console.log(dryRun ? '\ndry run, nothing written' : '\nnext: npm run build');
