// Reads the spreadsheet and writes data/trials.json.
// Each worksheet is one evaluation date (named MMDDYYYY) with a row per cultivar.
//
//   node scripts/import-xlsx.mjs "./DATA Trial Garden Website V.1.xlsx"

import XLSX from 'xlsx';
import * as fs from 'node:fs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { derive } from './lib/derive.mjs';

// SheetJS's ES module build only reads files from disk once given Node's fs
XLSX.set_fs(fs);

const SRC = process.argv[2] ?? './DATA Trial Garden Website V.1.xlsx';
const OUT = resolve('./data/trials.json');
const SPONSORS = resolve('./data/sponsors.json');
// outside the repo, next to the source spreadsheets -- same place as missing-photos.txt
const IMAGE_WARNINGS_OUT = resolve('../../data/image-link-warnings.txt');

const slug = (s) =>
  String(s).toLowerCase().trim()
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Sheet name MMDDYYYY -> ISO date
const sheetToDate = (name) => {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(name.trim());
  if (!m) throw new Error(`Unexpected sheet name: ${name}`);
  return `${m[3]}-${m[1]}-${m[2]}`;
};

// 'na' / 'n/a' means "not yet rated" (e.g. the 2026 season before scoring starts),
// not zero -- it must fall out as null, same as a blank cell, not as NaN.
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && /^n\/?a$/i.test(v.trim())) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const clean = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

// keep only the part of the Dropbox link up to the filename. the ?rlkey=... part is a
// share key and shouldn't end up in the (public) repo. import-photos only needs the filename.
const dropboxRaw = (u) => (isUrl(u) ? u.split('?')[0] : null);

const wb = XLSX.readFile(SRC);

const cultivars = new Map();   // slug -> cultivar
const evaluations = [];        // flat fact table
// each date's sheet can point the same Dropbox filename at more than one plant row --
// that's a spreadsheet authoring error (confirmed before: same file, wrong plant's
// photo), not something the importer can fix, so it's collected and reported instead.
const imageLinkWarnings = [];  // { date, filename, plants: [{ id, name }] }

for (const sheetName of wb.SheetNames) {
  const date = sheetToDate(sheetName);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  const filenamesThisSheet = new Map(); // lowercased dropbox filename -> [{ id, name }]

  for (const row of rows) {
    const name = clean(row['Plant Name']);
    const genus = clean(row['GENUS']);
    if (!name || !genus) continue;

    const id = slug(`${genus}-${name}`);

    if (!cultivars.has(id)) {
      cultivars.set(id, {
        id,
        name,
        genus,
        supplier: clean(row['SUPPLIER']),
        flowerColor: clean(row['FLOWER COLOR']),   // blank in v1
        year: num(row['YEAR']),
        images: [],
        status: 'In Ground',
      });
    }
    const c = cultivars.get(id);

    // A plant's supplier (or color/year) can be corrected on a later tab -- e.g. the
    // mentor's Sep 2026 sheet renamed "BallFloral" -> "Ball FloraPlants" and
    // "PanAmerican" -> "PanAmerican Seed" across the board. Sheets are processed in
    // workbook order, so the latest non-blank value seen wins over the first one.
    if (clean(row['SUPPLIER'])) c.supplier = clean(row['SUPPLIER']);
    if (clean(row['FLOWER COLOR'])) c.flowerColor = clean(row['FLOWER COLOR']);
    if (num(row['YEAR']) !== null) c.year = num(row['YEAR']);

    // One photo column per sheet, and each sheet is one evaluation date, so a photo
    // is naturally scoped to the date it was taken -- record that instead of losing it.
    const img = clean(row['PLANT IMAGE 1']);
    const raw = dropboxRaw(img);
    if (raw && !c.images.some((i) => i.date === date)) {
      c.images.push({
        date,
        url: raw,
        source: raw,                 // import-photos matches on the filename in this link
        local: `/plants/${id}--${date}.jpg`,
        mirrored: false,
      });
    }

    if (raw) {
      const filenameMatch = /\/scl\/fi\/[^/]+\/([^?]+)/.exec(raw);
      const filename = (filenameMatch ? filenameMatch[1] : raw).toLowerCase();
      if (!filenamesThisSheet.has(filename)) filenamesThisSheet.set(filename, []);
      filenamesThisSheet.get(filename).push({ id, name: `${genus} / ${name}` });
    }

    const scores = {
      uniformity:     num(row['Uniformity']),
      flowerPower:    num(row['Flower Power']),
      foliage:        num(row['Foliage']),
      heatResistance: num(row['Heat Resistance']),
    };

    // Use the sheet's Overall Rating if it's there, else average the four.
    const present = Object.values(scores).filter((v) => v !== null);
    const derived = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;

    evaluations.push({
      cultivarId: id,
      date,
      ...scores,
      avg: num(row['Overall Rating']) ?? (derived === null ? null : Math.round(derived * 100) / 100),
      notes: null,     // not in v1 source
      weather: null,   // not in v1 source
    });
  }

  for (const [filename, plants] of filenamesThisSheet) {
    if (plants.length > 1) imageLinkWarnings.push({ date, filename, plants });
  }
}

// insertion order already follows sheet order, but sort explicitly so a cultivar's
// images are guaranteed chronological even if the workbook's tabs aren't
for (const c of cultivars.values()) c.images.sort((a, b) => a.date.localeCompare(b.date));

const list = [...cultivars.values()];
const { awards, dataQuality, facets } = derive(list, evaluations, {
  duplicateImageLinks: imageLinkWarnings.length,
});

// program sponsors (soil, containers, ...) are hand-maintained, not in the spreadsheet
let sponsors = [];
try {
  sponsors = JSON.parse(readFileSync(SPONSORS, 'utf8'));
} catch (err) {
  if (err.code !== 'ENOENT') throw new Error(`can't read ${SPONSORS}: ${err.message}`);
}

const payload = {
  meta: {
    source: SRC.split('/').pop(),
    generatedAt: new Date().toISOString(),
    site: 'Homestead, FL',
    hardinessZone: '11b',
    cultivarCount: list.length,
    evaluationCount: evaluations.length,
    dataQuality,
    sponsors,
  },
  facets,
  awards,
  cultivars: list.sort((a, b) => a.name.localeCompare(b.name)),
  evaluations,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(`${list.length} cultivars, ${evaluations.length} evaluations, ${facets.dates.length} dates -> ${OUT}`);

if (imageLinkWarnings.length) {
  const lines = [
    'Trial Garden site -- same Dropbox photo linked to more than one plant',
    `Generated ${new Date().toISOString().slice(0, 10)} from ${SRC.split('/').pop()}`,
    '',
    'Each row below is one PLANT IMAGE 1 file that appears on more than one plant\'s',
    'row within the same evaluation date. At most one of them can be correct -- the',
    'sheet needs to be checked against the actual photos (confirmed pattern before:',
    'the filename is right, but it shows a different cultivar than the row it\'s on).',
    '',
    ...imageLinkWarnings.map(({ date, filename, plants }) =>
      `${date}  ${filename}\n${plants.map((p) => `  - ${p.name}  (${p.id})`).join('\n')}`),
  ];
  mkdirSync(dirname(IMAGE_WARNINGS_OUT), { recursive: true });
  writeFileSync(IMAGE_WARNINGS_OUT, lines.join('\n') + '\n');
  console.log(
    `\n${imageLinkWarnings.length} duplicate photo link(s) across cultivars -- see ${IMAGE_WARNINGS_OUT}`,
  );
} else {
  console.log('\nno duplicate photo links found across cultivars.');
}
