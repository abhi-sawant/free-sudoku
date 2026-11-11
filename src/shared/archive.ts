// History past the cap. Each game keeps its last 500 games in full; an older entry isn't thrown away but folded into
// a summary, `<game>.archive`, so the stats page can still show counts and averages for everything before. The fold
// is generic, so it works for every game's entry shape:
//
//   count  entries folded in
//   num    for each number field: how many had it, their sum, min and max (endedAt's min and max give the dates)
//   big    the same for whole numbers stored as digit strings (2248's and Halo's exact scores), as digit strings
//   tally  for each text, true/false or null field: how many times each value came up (results, levels, modes)
//
// Arrays fold per position: Farkle's `score: [12, 8]` becomes score.0 and score.1.

import { loadJSON, saveJSON } from './store';
import { takeActive } from './playtime';

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

export const archiveKey = (historyKey: string) => historyKey.replace(/\.history$/, '') + '.archive';
const slugOf = (historyKey: string) => historyKey.replace(/\.history$/, '');

export function loadArchive(historyKey: string): Archive {
  const a = loadJSON<Partial<Archive>>(archiveKey(historyKey), {});
  return { count: Number(a.count) || 0, num: a.num ?? {}, big: a.big ?? {}, tally: a.tally ?? {} };
}

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

/**
 * Caps a newest-first history at `max`, folding whatever falls off the end into the game's archive. Returns the list
 * to save. Pass entries in the form they are stored in (digit strings, not BigInts).
 */
export function capHistory<T>(historyKey: string, list: T[], max = 500): T[] {
  if (list.length <= max) return list;
  const a = loadArchive(historyKey);
  foldInto(a, list.slice(max));
  saveJSON(archiveKey(historyKey), a);
  return list.slice(0, max);
}

/** Stamps a new history entry with the active play time since the game's previous entry, as `activeMs`. */
export function stampActive<T extends object>(historyKey: string, entry: T): T {
  const e = entry as T & { activeMs?: number };
  if (e.activeMs === undefined) e.activeMs = takeActive(slugOf(historyKey));
  // A game was just logged: badges check once the writer (and the game's stats) have finished saving.
  if (typeof window !== 'undefined') setTimeout(() => dispatchEvent(new Event('games:progress')), 0);
  return entry;
}
