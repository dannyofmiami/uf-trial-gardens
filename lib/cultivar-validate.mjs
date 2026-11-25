// Cultivar edit rules, shared by the admin API (server/admin-core.mjs) and the browser-only
// demo admin (lib/admin-demo.ts). No Node or browser APIs, so it runs in both.
//
// An edit holds only what differs from the spreadsheet data:
//   { fields: {name?, genus?, supplier?, flowerColor?, year?, status?, lightExposure?},
//     rounds: { 'YYYY-MM-DD': {heatResistance?, uniformity?, flowerPower?, foliage?, notes?} },
//     removedRounds?: ['YYYY-MM-DD', ...],   spreadsheet rounds taken out
//     added?: true }                         a trial created in /admin, not in the spreadsheet
// A round date the spreadsheet doesn't have is a round added in /admin, saved in full.
// An added trial's fields are complete (no spreadsheet behind them) and its id is a UUID.

export const SCORE_KEYS = ['heatResistance', 'uniformity', 'flowerPower', 'foliage'];
export const PLANTING_TYPES = ['In Ground', 'In Basket'];
export const LIGHT_EXPOSURES = ['Full sun', 'Partial Shade'];

const TEXT_LIMITS = { name: 120, genus: 80, supplier: 80, flowerColor: 40 };
const NOTES_LIMIT = 500;
const MAX_ROUNDS = 60;

const clean = (v, keepNewlines = false) =>
  String(v ?? '').replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').trim();
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export const isCultivarId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(id);

// Trials created in /admin get a random id, so it never changes when their details are
// corrected. (Spreadsheet trials keep the id they were imported with.)
export const newTrialId = () => `t-${crypto.randomUUID()}`;

// Two trials can't share all of these: the same cultivar in the same year, light and planting.
export const trialKey = (f) =>
  [f.name, f.genus, f.year ?? '', f.lightExposure ?? '', f.status].map((v) => String(v).trim().toLowerCase()).join('|');

// Scores run 1 to 5 in half steps; null means not scored.
export const isScore = (v) => v === null || (typeof v === 'number' && v >= 1 && v <= 5 && Number.isInteger(v * 2));

export function validateCultivarEdit(input) {
  /** @type {Record<string, string>} */
  const errors = {};
  /** @type {Record<string, any>} */
  const fields = {};
  /** @type {Record<string, Record<string, any>>} */
  const rounds = {};
  const inFields = input?.fields && typeof input.fields === 'object' ? input.fields : {};
  const inRounds = input?.rounds && typeof input.rounds === 'object' ? input.rounds : {};
  const added = input?.added === true;

  for (const [k, max] of Object.entries(TEXT_LIMITS)) {
    if (!has(inFields, k)) continue;
    const v = clean(inFields[k]);
    if (v.length > max) errors[k] = `Keep this under ${max} characters.`;
    else if (!v && k !== 'supplier') errors[k] = 'This can’t be empty.';
    fields[k] = k === 'supplier' && !v ? null : v;
  }
  if (has(inFields, 'year')) {
    const y = inFields.year;
    if (y === null || y === '') fields.year = null;
    else if (Number.isInteger(Number(y)) && Number(y) >= 1990 && Number(y) <= 2100) fields.year = Number(y);
    else errors.year = 'Use a year like 2026.';
  }
  if (has(inFields, 'status')) {
    if (PLANTING_TYPES.includes(inFields.status)) fields.status = inFields.status;
    else errors.status = 'Choose in-ground or in-basket.';
  }
  if (has(inFields, 'lightExposure')) {
    const v = inFields.lightExposure ?? '';
    if (v === '' || LIGHT_EXPOSURES.includes(v)) fields.lightExposure = v;
    else errors.lightExposure = 'Choose full sun, partial shade, or not recorded.';
  }
  if (added) {
    for (const k of ['name', 'genus']) if (!fields[k] && !errors[k]) errors[k] = 'This can’t be empty.';
    if (fields.year == null && !errors.year) errors.year = 'Enter the trial year.';
    if (!fields.status && !errors.status) errors.status = 'Choose in-ground or in-basket.';
  }

  const dates = Object.keys(inRounds);
  if (dates.length > MAX_ROUNDS) errors.rounds = 'Too many rounds in one save.';
  for (const date of dates.slice(0, MAX_ROUNDS)) {
    const r = inRounds[date];
    if (!isDate(date) || !r || typeof r !== 'object') { errors.rounds = 'A round has an invalid date.'; continue; }
    /** @type {Record<string, any>} */
    const out = {};
    for (const k of SCORE_KEYS) {
      if (!has(r, k)) continue;
      if (isScore(r[k])) out[k] = r[k];
      else errors[`${date}.${k}`] = 'Scores run from 1 to 5 in half steps.';
    }
    if (has(r, 'notes')) {
      const n = clean(r.notes, true);
      if (n.length > NOTES_LIMIT) errors[`${date}.notes`] = `Keep notes under ${NOTES_LIMIT} characters.`;
      out.notes = n || null;
    }
    if (Object.keys(out).length) rounds[date] = out;
  }

  const removedRounds = [];
  const inRemoved = Array.isArray(input?.removedRounds) ? input.removedRounds : [];
  if (inRemoved.length > MAX_ROUNDS) errors.rounds = 'Too many rounds in one save.';
  for (const date of inRemoved.slice(0, MAX_ROUNDS)) {
    if (!isDate(date)) errors.rounds = 'A round has an invalid date.';
    else if (!removedRounds.includes(date) && !has(rounds, date)) removedRounds.push(date);
  }

  if (Object.keys(errors).length) return { errors };
  /** @type {{fields: Record<string, any>, rounds: Record<string, Record<string, any>>, removedRounds?: string[], added?: boolean}} */
  const edit = { fields, rounds };
  if (removedRounds.length) edit.removedRounds = removedRounds.sort();
  if (added) edit.added = true;
  return { edit };
}

// Saving an empty edit restores a spreadsheet trial, or deletes a trial added in /admin.
export const isEmptyEdit = (e) =>
  !Object.keys(e.fields).length && !Object.keys(e.rounds).length && !e.removedRounds?.length;
