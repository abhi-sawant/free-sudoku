// The pure half of archive.ts: the summary shape and the fold that builds it. No storage, so tests and the sync merge
// (sync/merge.ts) can use it directly.

export interface NumFold { n: number; sum: number; min: number; max: number }
export interface BigFold { n: number; sum: string; min: string; max: string }
export interface Archive {
  count: number;
  num: Record<string, NumFold>;
  big: Record<string, BigFold>;
  tally: Record<string, Record<string, number>>;
}

/** A field with more distinct values than this (words, deal numbers) stops tallying new ones under their own name. */
const MAX_VALUES = 40;
const OTHER = '(other)';

function foldValue(a: Archive, key: string, v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const f = (a.num[key] ??= { n: 0, sum: 0, min: v, max: v });
    f.n++; f.sum += v; f.min = Math.min(f.min, v); f.max = Math.max(f.max, v);
  } else if (typeof v === 'string' && /^\d+$/.test(v)) {
    // Whole numbers kept as text are exact scores that may be too big for a plain number to add up.
    const b = BigInt(v);
    const f = (a.big[key] ??= { n: 0, sum: '0', min: v, max: v });
    f.n++;
    f.sum = (BigInt(f.sum) + b).toString();
    if (b < BigInt(f.min)) f.min = v;
    if (b > BigInt(f.max)) f.max = v;
  } else if (typeof v === 'string' || typeof v === 'boolean' || v === null) {
    const t = (a.tally[key] ??= {});
    let name = String(v);
    if (!(name in t) && Object.keys(t).length >= MAX_VALUES) name = OTHER;
    t[name] = (t[name] ?? 0) + 1;
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => foldValue(a, `${key}.${i}`, x));
  }
}

/** Folds entries into a summary. Exported for the stats page's tests and for merging. */
export function foldInto(a: Archive, entries: unknown[]) {
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    a.count++;
    for (const [k, v] of Object.entries(e)) foldValue(a, k, v);
  }
}

