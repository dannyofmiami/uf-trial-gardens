// Banner input rules, shared by the admin API (server/admin-core.mjs) and the browser-only
// demo admin (lib/admin-demo.ts). No Node or browser APIs, so it runs in both.

const LIMITS = { title: 120, message: 500, linkLabel: 40, linkUrl: 300 };

// strip control characters except newlines in the message
const clean = (v, keepNewlines = false) =>
  String(v ?? '').replace(keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').trim();
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));

export function validateBanner(input) {
  const b = {
    enabled: input.enabled === true,
    title: clean(input.title),
    message: clean(input.message, true),
    linkLabel: clean(input.linkLabel),
    linkUrl: clean(input.linkUrl),
    showFrom: clean(input.showFrom),
    showUntil: clean(input.showUntil),
  };
  const errors = {};
  for (const [k, max] of Object.entries(LIMITS)) {
    if (b[k].length > max) errors[k] = `Keep this under ${max} characters.`;
  }
  if (b.enabled && !b.title) errors.title = 'A title is required when the banner is on.';
  if (b.linkLabel && !b.linkUrl) errors.linkUrl = 'Add a link, or clear the button text.';
  if (b.linkUrl && !/^\/(?!\/)\S*$/.test(b.linkUrl) && !/^https:\/\/\S+$/i.test(b.linkUrl)) {
    errors.linkUrl = 'Use a site path like /visit/ or a full https:// address.';
  }
  for (const k of ['showFrom', 'showUntil']) {
    if (b[k] && !isDate(b[k])) errors[k] = 'Use a date like 2027-01-01.';
  }
  if (b.showFrom && b.showUntil && !errors.showFrom && !errors.showUntil && b.showUntil < b.showFrom) {
    errors.showUntil = 'The end date is before the start date.';
  }
  return Object.keys(errors).length ? { errors } : { banner: b };
}
