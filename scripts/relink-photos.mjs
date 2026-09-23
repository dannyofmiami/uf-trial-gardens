// Fixes data/trials.json so it matches what's in public/plants/.
//
// import-xlsx.mjs rebuilds trials.json from scratch, which wipes the
// mirrored/local/thumb fields that import-photos.mjs set. The photos are still
// in public/plants/ but the site stops showing them. This looks for files named
// <id>--<date>.webp and <id>--<date>-thumb.webp (one per evaluation date) and puts
// the fields back. It doesn't change any files.
//
//   node scripts/relink-photos.mjs [--dry-run]

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const DATA = resolve('./data/trials.json');
const PLANTS_DIR = resolve('./public/plants');
const dryRun = process.argv.includes('--dry-run');

const data = JSON.parse(await readFile(DATA, 'utf8'));
const files = new Set(await readdir(PLANTS_DIR));

let relinked = 0;
for (const c of data.cultivars) {
  for (const img of c.images) {
    const detail = `${c.id}--${img.date}.webp`;
    const thumb = `${c.id}--${img.date}-thumb.webp`;
    if (!files.has(detail)) continue;

    img.local = `/plants/${detail}`;
    img.thumb = files.has(thumb) ? `/plants/${thumb}` : `/plants/${detail}`;
    img.mirrored = true;
    relinked += 1;
  }
}

data.meta.dataQuality.imagesMirrored = data.cultivars
  .reduce((n, c) => n + c.images.filter((i) => i.mirrored).length, 0);

console.log(`relinked ${relinked} cultivar photo(s) already present in public/plants/`);

const stillMissing = data.cultivars.filter((c) => !c.images.some((i) => i.mirrored));
console.log(`${stillMissing.length} cultivars still have no local photo (placeholder will show):`);
stillMissing.forEach((c) => {
  const reason = c.images.length ? `link on file, no matching download: ${c.images[0].source}` : 'no photo in spreadsheet (N/A)';
  console.log(`  ${c.name} (${c.id}) - ${reason}`);
});

if (dryRun) {
  console.log('\ndry run, nothing written');
} else {
  await writeFile(DATA, JSON.stringify(data, null, 2));
  console.log(`\nwrote ${DATA}`);
}
