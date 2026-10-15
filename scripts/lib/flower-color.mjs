// Flower color, inferred from the cultivar name when the spreadsheet's FLOWER COLOR. Need to assure future spreadsheets include this

export const UNKNOWN_COLOR = 'Unknown';

const WORDS = [
  ['Red', ['red', 'cherry', 'kardinal', 'burgundy']],
  ['Pink', ['pink', 'rose', 'salmon', 'coral', 'flamingo', 'magenta', 'fuchsia', 'strawberry']],
  ['Orange', ['orange', 'peach', 'nectarine']],
  ['Yellow', ['yellow', 'gold', 'lemon', 'sunshine']],
  ['White', ['white', 'pearl']],
  ['Blue', ['blue']],
  ['Purple', ['purple', 'grape', 'lilac', 'lavender', 'lavendar', 'orchid', 'boysenberry']],
];
const MULTI = /\b(bicolou?r|mix(ture)?)/i;

export function inferFlowerColor(name) {
  if (MULTI.test(name)) return 'Multicolor';
  // "White Bronze Leaf" -- a leaf color isn't a flower color
  const text = name.replace(/\b\w+\s+leaf\b/gi, '');
  const found = WORDS
    .filter(([, stems]) => stems.some((s) => new RegExp(`\\b${s}`, 'i').test(text)))
    .map(([color]) => color);
  if (found.length > 1) return 'Multicolor';
  return found[0] ?? UNKNOWN_COLOR;
}
