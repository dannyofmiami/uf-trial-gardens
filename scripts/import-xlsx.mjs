// Reads the spreadsheet and writes data/trials.json.
// Each worksheet is one evaluation date (named MMDDYYYY) with a row per cultivar.
//
//   node scripts/import-xlsx.mjs "./DATA Trial Garden Website V.1.xlsx"

import XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SRC = process.argv[2] ?? './DATA Trial Garden Website V.1.xlsx';
const OUT = resolve('./data/trials.json');

const slug = (s) =>
  String(s).toLowerCase().trim()
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Sheet name MMDDYYYY -> ISO date
const sheetToDate = (name) => {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(name.trim());
  if (!m) throw new Error(`Unexpected sheet name: ${name}`);
  return `${m[3]}-${m[1]}-${m[2]}`;
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const clean = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

// keep only the part of the Dropbox link up to the filename. the ?rlkey=... part is a
// share key and shouldn't end up in the (public) repo. import-photos only needs the filename.
const dropboxRaw = (u) => (isUrl(u) ? u.split('?')[0] : null);

const wb = XLSX.readFile(SRC);

const cultivars = new Map();   // slug -> cultivar
const evaluations = [];        // flat fact table

for (const sheetName of wb.SheetNames) {
  const date = sheetToDate(sheetName);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

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

    // Sheet 1 has real URLs here; sheets 2-3 have filename placeholders.
    const img = clean(row['PLANT IMAGE 1']);
    const raw = dropboxRaw(img);
    const c = cultivars.get(id);
    if (raw && !c.images.some((i) => i.url === raw)) {
      c.images.push({
        url: raw,
        source: raw,                 // import-photos matches on the filename in this link
        local: `/plants/${id}.jpg`,
        mirrored: false,
      });
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
}

// latest scores per cultivar
const byCultivar = new Map();
for (const e of evaluations) {
  if (!byCultivar.has(e.cultivarId)) byCultivar.set(e.cultivarId, []);
  byCultivar.get(e.cultivarId).push(e);
}
for (const [id, evals] of byCultivar) {
  evals.sort((a, b) => a.date.localeCompare(b.date));
  const latest = evals[evals.length - 1];
  Object.assign(cultivars.get(id), {
    currentAvg: latest.avg,
    latestEvaluation: latest.date,
    evaluationCount: evals.length,
    latestScores: {
      heatResistance: latest.heatResistance,
      uniformity: latest.uniformity,
      flowerPower: latest.flowerPower,
      foliage: latest.foliage,
    },
  });
}

// awards
const list = [...cultivars.values()];
// returns everyone tied for the top score instead of picking one
const topBy = (key) => {
  const vals = list
    .map((c) => [c, key === 'avg' ? c.currentAvg : c.latestScores?.[key]])
    .filter(([, v]) => v !== null && v !== undefined);
  if (!vals.length) return { winners: [], top: null };
  const top = Math.max(...vals.map(([, v]) => v));
  return { winners: vals.filter(([, v]) => v === top).map(([c]) => c), top };
};

const awards = [
  { id: 'florida-favorite',    name: 'Florida Favorite Award',      basis: 'avg',            premier: true  },
  { id: 'heat-champion',       name: 'Heat Champion Award',         basis: 'heatResistance', premier: false },
  { id: 'flower-power',        name: 'Flower Power Award',          basis: 'flowerPower',    premier: false },
  { id: 'perfect-foliage',     name: 'Perfect Foliage Award',       basis: 'foliage',        premier: false },
  { id: 'uniformity',          name: 'Uniformity Excellence Award', basis: 'uniformity',     premier: false },
].map((a) => {
  const { winners, top } = topBy(a.basis);
  return {
    ...a,
    winnerScore: top,
    tied: winners.length,
    winnerIds: winners.map((c) => c.id),
    winnerId: winners.length === 1 ? winners[0].id : null,
  };
});

for (const a of awards) {
  if (a.winnerId) (cultivars.get(a.winnerId).awards ??= []).push(a.id);
}

// data quality flags
const scored = evaluations.filter((e) => e.avg !== null);
const latestDate = evaluations.reduce((m, e) => (e.date > m ? e.date : m), '');
const latestRows = scored.filter((e) => e.date === latestDate);
const dataQuality = {
  missingFlowerColor: list.filter((c) => !c.flowerColor).length,
  missingImage: list.filter((c) => !c.images.length).length,
  imagesHotlinked: list.reduce((n, c) => n + c.images.length, 0),
  imagesMirrored: list.reduce((n, c) => n + c.images.filter((i) => i.mirrored).length, 0),
  perfectScoreShare: Math.round((scored.filter((e) => e.avg === 5).length / scored.length) * 1000) / 1000,
  latestSnapshotAllPerfect: latestRows.every((e) => e.avg === 5),
  awardsUndecidedByTie: awards.some((a) => a.tied > 1),
  note:
    'Latest evaluation rates every entry 5.0 across all four categories, so no award ' +
    'can be decided yet. Needs differentiated scoring before launch.',
};

// filter facets
const uniq = (xs) => [...new Set(xs.filter(Boolean))].sort();
const facets = {
  genera:    uniq(list.map((c) => c.genus)),
  suppliers: uniq(list.map((c) => c.supplier)),
  colors:    uniq(list.map((c) => c.flowerColor)),
  dates:     uniq(evaluations.map((e) => e.date)),
};

const payload = {
  meta: {
    source: SRC.split('/').pop(),
    generatedAt: new Date().toISOString(),
    site: 'Homestead, FL',
    hardinessZone: '11b',
    cultivarCount: list.length,
    evaluationCount: evaluations.length,
    dataQuality,
  },
  facets,
  awards,
  cultivars: list.sort((a, b) => a.name.localeCompare(b.name)),
  evaluations,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log(`${list.length} cultivars, ${evaluations.length} evaluations, ${facets.dates.length} dates -> ${OUT}`);
