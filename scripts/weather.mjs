// Downloads the day's weather for every photo date from TREC's FAWN station (Florida
// Automated Weather Network, Homestead, station 440) and writes data/weather.json.

import { readFile, writeFile } from 'node:fs/promises';

const STATION = { id: 440, name: 'Homestead' };
const REPORTS = 'https://fawn.ifas.ufl.edu/data/reports/?res';
const OUT = 'data/weather.json';

// photo dates from both datasets (they share dates, but don't assume it)
const dates = new Set();
for (const file of ['data/trials.json', 'data/trials.mock.json']) {
  const data = JSON.parse(await readFile(file, 'utf8').catch(() => '{"cultivars":[]}'));
  for (const c of data.cultivars) for (const img of c.images) dates.add(img.date);
}
const wanted = [...dates].sort();
if (!wanted.length) {
  console.error('No photo dates found in data/trials.json.');
  process.exit(1);
}

// one daily report spanning every photo date; we keep only the dates we need
const [from, to] = [wanted[0], wanted.at(-1)].map((d) => d.split('-').map(Number));
const form = new URLSearchParams({
  [`locs__${STATION.id}`]: 'on',
  reportType: 'daily',
  presetRange: 'dates',
  fromDate_y: from[0], fromDate_m: from[1], fromDate_d: from[2],
  toDate_y: to[0], toDate_m: to[1], toDate_d: to[2],
  vars__AirTemp9: 'on',
  vars__RelHumAvg: 'on',
  vars__Rainfall: 'on',
  vars__TotalRad: 'on',
  format: '.CSV (Excel)',
});
const res = await fetch(REPORTS, { method: 'POST', body: form });
if (!res.ok) {
  console.error(`FAWN returned ${res.status} ${res.statusText}.`);
  process.exit(1);
}
const csv = await res.text();

const parseLine = (line) => [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const [header, ...rows] = csv.trim().split(/\r?\n/).map(parseLine);
const col = (prefix) => {
  const i = header.findIndex((h) => h.startsWith(prefix));
  if (i < 0) throw new Error(`FAWN's CSV has no "${prefix}" column -- has the report format changed?`);
  return i;
};
const C = {
  period: col('Period'),
  tMax: col('2m T max'),
  tMin: col('2m T min'),
  rh: col('RelHum avg'),
  rain: col('2m Rain tot'),
  solar: col('SolRad avg'),
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "13 Jan 2026" -> "2026-01-13"
const isoDate = (s) => {
  const [d, m, y] = s.split(' ');
  return `${y}-${String(MONTHS.indexOf(m) + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
};
const num = (s) => (s === '' || Number.isNaN(Number(s)) ? null : Number(s));
const round = (v, places) => (v === null ? null : Number(v.toFixed(places)));

const days = {};
for (const r of rows) {
  const date = isoDate(r[C.period]);
  if (!dates.has(date)) continue;
  const solar = num(r[C.solar]);
  days[date] = {
    highF: round(num(r[C.tMax]), 1),
    lowF: round(num(r[C.tMin]), 1),
    rainIn: round(num(r[C.rain]), 2),
    humidityPct: round(num(r[C.rh]), 0),
    // daily light integral, the sunlight measure growers use: the day's average solar
    // radiation (W/m²) -> MJ/m²/day (x 0.0864) -> mol/m²/day of PAR (x ~2.04, the usual
    // approximation for sunlight)
    dli: solar === null ? null : round(solar * 0.0864 * 2.04, 0),
  };
}

const missing = wanted.filter((d) => !days[d]);
await writeFile(OUT, JSON.stringify({
  source: `FAWN ${STATION.name} station (${STATION.id})`,
  sourceUrl: 'https://fawn.ifas.ufl.edu/',
  fetchedAt: new Date().toISOString(),
  days,
}, null, 2) + '\n');

console.log(`Wrote ${OUT}: weather for ${Object.keys(days).length} of ${wanted.length} photo dates.`);
if (missing.length) console.warn(`No FAWN data for: ${missing.join(', ')}`);
