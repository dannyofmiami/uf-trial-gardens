import raw from '@/data/trials.json';

export type Scores = {
  heatResistance: number | null;
  uniformity: number | null;
  flowerPower: number | null;
  foliage: number | null;
};

export type TrialImage = {
  date: string;      // ISO date of the evaluation this photo was taken for
  url: string;       // dropbox link, rewritten with raw=1
  source: string;    // original link from the sheet; import-photos matches on its filename
  local: string;     // /plants/<id>--<date>.webp once imported
  thumb?: string;    // small variant, same as local if nothing was resized
  mirrored: boolean;
};

export type Cultivar = {
  id: string;
  name: string;
  genus: string;
  supplier: string | null;
  flowerColor: string | null;
  year: number | null;
  images: TrialImage[];
  status: string;
  currentAvg: number | null;
  latestEvaluation: string;
  evaluationCount: number;
  latestScores: Scores;
  awards?: string[];
};

export type Evaluation = Scores & {
  cultivarId: string;
  date: string;
  avg: number | null;
  notes: string | null;
  weather: null | { highF: number; lowF: number; precipIn: number; uvIndex: number };
};

export type Award = {
  id: string;
  name: string;
  basis: 'avg' | keyof Scores;
  premier: boolean;
  winnerScore: number | null;
  tied: number;
  winnerIds: string[];
  winnerId: string | null;
};

export type TrialData = {
  meta: {
    source: string;
    generatedAt: string;
    site: string;
    hardinessZone: string;
    cultivarCount: number;
    evaluationCount: number;
    dataQuality: {
      missingFlowerColor: number;
      missingImage: number;
      imagesHotlinked: number;
      imagesMirrored: number;
      perfectScoreShare: number;
      latestSnapshotAllPerfect: boolean;
      awardsUndecidedByTie: boolean;
      note: string;
    };
  };
  facets: { genera: string[]; suppliers: string[]; colors: string[]; dates: string[] };
  awards: Award[];
  cultivars: Cultivar[];
  evaluations: Evaluation[];
};

// prefix for files in /public, needed when the site isn't at the domain root (GitHub Pages)
export const withBase = (path: string) => (process.env.NEXT_PUBLIC_BASE_PATH || '') + path;

const data = raw as unknown as TrialData;

export const meta = data.meta;
export const facets = data.facets;
export const awards = data.awards;
export const cultivars = data.cultivars;
export const evaluations = data.evaluations;

export const getCultivar = (id: string) => cultivars.find((c) => c.id === id);

// most recent mirrored photo, for the hero/card image -- images are stored oldest-first
export const latestMirroredImage = (c: Cultivar): TrialImage | undefined =>
  [...c.images].reverse().find((i) => i.mirrored);

export const imageForDate = (c: Cultivar, date: string): TrialImage | undefined =>
  c.images.find((i) => i.date === date);

export const getEvaluations = (id: string) =>
  evaluations.filter((e) => e.cultivarId === id).sort((a, b) => b.date.localeCompare(a.date));

export const CATEGORIES = [
  { key: 'heatResistance', code: 'RES', label: 'Heat Resistance',
    blurb: 'Resistance to heat, humidity, rainfall, and environmental stress.' },
  { key: 'uniformity', code: 'UNF', label: 'Uniformity',
    blurb: 'Consistent growth habit, size, flowering, and appearance across the planting.' },
  { key: 'flowerPower', code: 'FLW', label: 'Flower Power',
    blurb: 'Flowering strength, abundance of blooms, and visual impact.' },
  { key: 'foliage', code: 'FOL', label: 'Foliage',
    blurb: 'Foliage color, cleanliness, durability, and overall leaf quality.' },
] as const;

export const SCALE = [
  { v: 5, label: 'Excellent', note: 'Outstanding' },
  { v: 4, label: 'Good', note: 'Nice display' },
  { v: 3, label: 'Fair', note: 'Average / moderate' },
  { v: 2, label: 'Poor', note: 'Below average' },
  { v: 1, label: 'Unacceptable', note: '' },
];

export const fmtDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
