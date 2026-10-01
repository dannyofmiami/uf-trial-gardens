// Writes data/trials.mock.json: the real data (plants, photos, dates) with made-up
// scores and sample sponsors, for building and demoing features before the trial team
// has entered real ratings. The site reads it under `npm run dev:mock` / `build:mock`,
// and the GitHub Pages deploy uses build:mock for now (.github/workflows/pages.yml).
// Rerun after re-importing real data so the sample copy stays in sync.
//
//   npm run mock

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { derive } from './lib/derive.mjs';

const SRC = resolve('./data/trials.json');
const OUT = resolve('./data/trials.mock.json');
const UNSCORED_SHARE = 0.04; // leave a few rounds blank so "not yet scored" still shows up

// FNV-1a hash -> mulberry32, so every (cultivar, date) gets its own stable sequence
const hash = (s) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const halfStep = (v) => Math.min(5, Math.max(1, Math.round(v * 2) / 2));

const data = JSON.parse(readFileSync(SRC, 'utf8'));

// a stable "how good is this plant" per cultivar, so its rounds look like one plant
const quality = new Map(data.cultivars.map((c) => [c.id, 2.6 + rng(hash(c.id))() * 2.2]));

for (const e of data.evaluations) {
  const r = rng(hash(`${e.cultivarId}|${e.date}`));
  if (r() < UNSCORED_SHARE) {
    Object.assign(e, { uniformity: null, flowerPower: null, foliage: null, heatResistance: null, avg: null });
    continue;
  }
  const q = quality.get(e.cultivarId);
  for (const key of ['uniformity', 'flowerPower', 'foliage', 'heatResistance']) {
    e[key] = halfStep(q + (r() - 0.5) * 1.6);
  }
  const s = [e.uniformity, e.flowerPower, e.foliage, e.heatResistance];
  e.avg = Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100;
}

const { awards, dataQuality, facets } = derive(data.cultivars, data.evaluations, {
  duplicateImageLinks: data.meta.dataQuality.duplicateImageLinks,
});

const payload = {
  ...data,
  meta: {
    ...data.meta,
    generatedAt: new Date().toISOString(),
    mock: true,
    dataQuality: {
      ...dataQuality,
      note: 'SAMPLE DATA: scores and sponsors in this file are made up, not trial results.',
    },
    sponsors: [
      { credit: 'Grown in soil from', name: 'Example Soil Co.', url: 'https://example.com/' },
    ],
  },
  facets,
  awards,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2));
const scored = data.evaluations.filter((e) => e.avg !== null).length;
console.log(`${scored}/${data.evaluations.length} evaluations scored (sample) -> ${OUT}`);
