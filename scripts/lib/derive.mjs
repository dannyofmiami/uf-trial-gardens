// Everything computed *from* the scores: each cultivar's latest average and scores,
// the awards, the data-quality flags and the filter facets. Shared by import-xlsx.mjs
// (real data) and mock-data.mjs (sample data) so both come out consistent.
//
// Mutates each cultivar in `list` (latest* fields, awards).

export function derive(list, evaluations, { duplicateImageLinks = 0 } = {}) {
  const byId = new Map(list.map((c) => [c.id, c]));

  // latest scores per cultivar
  const byCultivar = new Map();
  for (const e of evaluations) {
    if (!byCultivar.has(e.cultivarId)) byCultivar.set(e.cultivarId, []);
    byCultivar.get(e.cultivarId).push(e);
  }
  for (const [id, evals] of byCultivar) {
    evals.sort((a, b) => a.date.localeCompare(b.date));
    const latest = evals[evals.length - 1];
    Object.assign(byId.get(id), {
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

  // awards -- returns everyone tied for the top score instead of picking one
  const topBy = (key) => {
    const vals = list
      .map((c) => [c, key === 'avg' ? c.currentAvg : c.latestScores?.[key]])
      .filter(([, v]) => v !== null && v !== undefined);
    if (!vals.length) return { winners: [], top: null };
    const top = Math.max(...vals.map(([, v]) => v));
    return { winners: vals.filter(([, v]) => v === top).map(([c]) => c), top };
  };

  const awards = [
    { id: 'florida-favorite', name: 'Florida Favorite Award',      basis: 'avg',            premier: true  },
    { id: 'heat-champion',    name: 'Heat Champion Award',         basis: 'heatResistance', premier: false },
    { id: 'flower-power',     name: 'Flower Power Award',          basis: 'flowerPower',    premier: false },
    { id: 'perfect-foliage',  name: 'Perfect Foliage Award',       basis: 'foliage',        premier: false },
    { id: 'uniformity',       name: 'Uniformity Excellence Award', basis: 'uniformity',     premier: false },
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

  for (const c of list) delete c.awards;
  for (const a of awards) {
    if (a.winnerId) (byId.get(a.winnerId).awards ??= []).push(a.id);
  }

  // data quality flags
  const scored = evaluations.filter((e) => e.avg !== null);
  const latestDate = evaluations.reduce((m, e) => (e.date > m ? e.date : m), '');
  const latestRows = scored.filter((e) => e.date === latestDate);
  const dateCount = new Set(evaluations.map((e) => e.date)).size;
  // scored.length === 0 would make this NaN, which JSON.stringify silently turns into
  // null -- make the "no scores at all" case an explicit null instead of an accident.
  const perfectScoreShare = scored.length
    ? Math.round((scored.filter((e) => e.avg === 5).length / scored.length) * 1000) / 1000
    : null;

  let note;
  if (evaluations.length === 0) {
    note = 'No evaluations in this import.';
  } else if (scored.length === 0) {
    note =
      `None of the ${evaluations.length} evaluations across ${dateCount} ` +
      'date(s) have a score yet -- every Uniformity/Flower Power/Foliage/Heat Resistance/' +
      'Overall Rating cell in the source sheet is "na". This source file has the plant, ' +
      'supplier and photo data but no ratings at all yet -- needs the trial team to fill in ' +
      'scores before the site shows anything but dashes.';
  } else if (latestRows.length > 0 && latestRows.every((e) => e.avg === 5)) {
    note =
      'Latest evaluation rates every entry 5.0 across all four categories, so no award ' +
      'can be decided yet. Needs differentiated scoring before launch.';
  } else {
    note = null;
  }

  const dataQuality = {
    missingFlowerColor: list.filter((c) => !c.flowerColor).length,
    missingImage: list.filter((c) => !c.images.length).length,
    imagesHotlinked: list.reduce((n, c) => n + c.images.length, 0),
    imagesMirrored: list.reduce((n, c) => n + c.images.filter((i) => i.mirrored).length, 0),
    perfectScoreShare,
    // .every() on an empty array is vacuously true -- guard against a latest
    // date with no scored rows yet (e.g. a season that's still all 'na').
    latestSnapshotAllPerfect: latestRows.length > 0 && latestRows.every((e) => e.avg === 5),
    awardsUndecidedByTie: awards.some((a) => a.tied > 1),
    duplicateImageLinks,
    unscoredEvaluations: evaluations.length - scored.length,
    note,
  };

  // filter facets
  const uniq = (xs) => [...new Set(xs.filter(Boolean))].sort();
  const facets = {
    genera:    uniq(list.map((c) => c.genus)),
    suppliers: uniq(list.map((c) => c.supplier)),
    colors:    uniq(list.map((c) => c.flowerColor)),
    dates:     uniq(evaluations.map((e) => e.date)),
  };

  return { awards, dataQuality, facets };
}
