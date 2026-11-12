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
import { type Archive, type BigFold, type NumFold, foldInto } from './fold';

export type { Archive, NumFold, BigFold };
export { foldInto };

export const archiveKey = (historyKey: string) => historyKey.replace(/\.history$/, '') + '.archive';
const slugOf = (historyKey: string) => historyKey.replace(/\.history$/, '');

export function loadArchive(historyKey: string): Archive {
  const a = loadJSON<Partial<Archive>>(archiveKey(historyKey), {});
  return { count: Number(a.count) || 0, num: a.num ?? {}, big: a.big ?? {}, tally: a.tally ?? {} };
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
