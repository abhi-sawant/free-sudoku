// How two copies of the same saved key become one, for signing in on a second device. Pure: strings in, strings out,
// no storage and no network, so tests/merge.test.ts can play two devices against each other.
//
// Every rule is commutative and idempotent (merge(a, b) = merge(b, a), merge(a, a) = a), so devices can sync in any
// order, twice, or at the same time and still settle on the same value:
//
//   history   union of both lists, newest first, capped at 500; what falls off the end is folded into the archive
//   archive   the bigger of the two summaries (they fold the same old games, so adding them would count twice)
//   stats     per field: counters and best scores keep the larger, best times and move counts the smaller
//   playtime  the larger total, the earlier first open, the later last play
//   played.*  union of the ids already played
//   badges    union; a badge keeps the earlier unlock time
//   current   the game in progress: whichever device saved it last
//
// Nothing here can add two devices' counters together without risking a double count, so a counter can lag when two
// devices play the same game offline at once; the history, which is what the stats page is built from, never does.

import { type Archive, foldInto } from '../fold.ts';

export const HISTORY_MAX = 500;

export type Kind = 'history' | 'archive' | 'stats' | 'best' | 'playtime' | 'played' | 'badges' | 'current';

/** What kind of value a storage key holds, or null when the key is not synced (themes, update state, ...). */
export function kindOf(key: string): Kind | null {
  if (key === 'games.badges') return 'badges';
  const m = /^[a-z0-9]+\.(.+)$/.exec(key);
  if (!m || key.length > 64) return null;
  const rest = m[1];
  if (rest === 'history' || rest === 'archive' || rest === 'stats' || rest === 'playtime' || rest === 'current') return rest;
  if (/^played\.[A-Za-z0-9_-]+$/.test(rest)) return 'played';
  if (/^best[A-Za-z]*$/.test(rest)) return 'best';
  return null;
}

export const isSyncKey = (key: string) => kindOf(key) !== null;

// ---------- Helpers ----------

type Json = unknown;
type Obj = Record<string, Json>;
const isObj = (v: Json): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** JSON with sorted keys: two values that mean the same thing give the same text. */
export function canon(v: Json): string {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v) ?? 'null';
}

/** Same meaning? Compares two stored strings, ignoring key order. */
export function sameValue(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  try { return canon(JSON.parse(a)) === canon(JSON.parse(b)); } catch { return false; }
}

function parse(s: string | null): { ok: boolean; v: Json } {
  if (s === null) return { ok: false, v: null };
  try { return { ok: true, v: JSON.parse(s) }; } catch { return { ok: false, v: null }; }
}

const num = (v: Json) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isDigits = (v: Json): v is string => typeof v === 'string' && /^\d+$/.test(v);

/** A union of two lists with each distinct entry once, in a fixed order. */
function union(a: Json[], b: Json[]): Json[] {
  const seen = new Map<string, Json>();
  for (const x of [...a, ...b]) seen.set(canon(x), x);
  return [...seen.entries()].sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0)).map(([, x]) => x);
}

// ---------- Per kind ----------

/** Merges two values that follow no fixed shape: numbers keep the larger (the smaller for times and moves). */
function mergeAny(a: Json, b: Json, fieldName: string, smaller: boolean): Json {
  if (a === undefined || a === null) return b ?? a ?? null;
  if (b === undefined || b === null) return a;
  if (typeof a === 'number' && typeof b === 'number') {
    const min = smaller || /time|moves|duration/i.test(fieldName);
    return min ? Math.min(a, b) : Math.max(a, b);
  }
  if (isDigits(a) && isDigits(b)) {
    const x = BigInt(a), y = BigInt(b);
    return (smaller ? x < y : x > y) ? a : b;
  }
  if (Array.isArray(a) && Array.isArray(b)) return union(a, b);
  if (isObj(a) && isObj(b)) {
    const out: Obj = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = mergeAny(a[k], b[k], k, smaller);
    return out;
  }
  // Two different plain values (text, a flag): keep the one that sorts first, so both devices pick the same.
  return canon(a) <= canon(b) ? a : b;
}

/** Entries are told apart by their whole content, so the same game on two devices counts once. */
export function mergeHistory(a: Json[], b: Json[]): { list: Json[]; overflow: Json[] } {
  const all = union(a, b).filter((e) => isObj(e));
  const at = (e: Json) => num((e as Obj).endedAt);
  all.sort((x, y) => at(y) - at(x) || (canon(x) < canon(y) ? -1 : 1));
  return { list: all.slice(0, HISTORY_MAX), overflow: all.slice(HISTORY_MAX) };
}

function mergePlaytime(a: Obj, b: Obj, local: Obj): Obj {
  const first = [num(a.first), num(b.first)].filter(Boolean);
  return {
    ms: Math.max(num(a.ms), num(b.ms)),
    opens: Math.max(num(a.opens), num(b.opens)),
    first: first.length ? Math.min(...first) : 0,
    last: Math.max(num(a.last), num(b.last)),
    // Time not yet credited to a game belongs to the device that counted it.
    pending: num(local.pending),
  };
}

function mergeBadges(a: Obj, b: Obj): Obj {
  const out: Obj = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const t = [a[k], b[k]].filter((x): x is number => typeof x === 'number' && x > 0);
    out[k] = t.length ? Math.min(...t) : Date.now();
  }
  return out;
}

export interface MergeResult {
  /** The merged value as text, or null when the key should not exist. */
  value: string | null;
  /** History entries that no longer fit in the cap; the caller folds them into the game's archive. */
  overflow?: Json[];
}

/**
 * Merges this device's copy of a key with the server's. `localNewer` says whether this device saved the key after the
 * server's copy was written; only the game in progress cares.
 */
export function mergeItem(key: string, local: string | null, remote: string | null, localNewer: boolean): MergeResult {
  const kind = kindOf(key);
  if (!kind) return { value: local };

  if (kind === 'current') return { value: localNewer ? local : remote };
  if (remote === null) return { value: local };
  if (local === null) return { value: remote };

  const L = parse(local), R = parse(remote);
  if (!L.ok && !R.ok) return { value: local };
  if (!L.ok) return { value: remote };
  if (!R.ok) return { value: local };
  const a = L.v, b = R.v;
  const out = (v: Json, extra?: Partial<MergeResult>): MergeResult => ({ value: sameValue(JSON.stringify(v), local) ? local : canon(v), ...extra });
  // canon() output is valid JSON, so it can be stored as it is.

  switch (kind) {
    case 'history': {
      if (!Array.isArray(a) || !Array.isArray(b)) return { value: Array.isArray(a) ? local : remote };
      const { list, overflow } = mergeHistory(a, b);
      return out(list, { overflow });
    }
    case 'archive': {
      if (!isObj(a) || !isObj(b)) return { value: isObj(a) ? local : remote };
      const pick = num(a.count) >= num(b.count) ? a : b;
      return out(pick);
    }
    case 'playtime':
      return isObj(a) && isObj(b) ? out(mergePlaytime(a, b, a)) : { value: isObj(a) ? local : remote };
    case 'played':
      return Array.isArray(a) && Array.isArray(b) ? out(union(a, b)) : { value: Array.isArray(a) ? local : remote };
    case 'badges':
      return isObj(a) && isObj(b) ? out(mergeBadges(a, b)) : { value: isObj(a) ? local : remote };
    case 'stats':
    case 'best':
      return out(mergeAny(a, b, '', /moves/i.test(key)));
  }
}

/**
 * Folds history entries that fell off the cap into an archive, skipping any older than what the archive already
 * covers: those were folded once already, on the device that pushed the archive.
 */
export function foldOverflow(archive: Archive, overflow: Json[]): Archive {
  const covered = archive.num?.endedAt?.max ?? 0;
  const fresh = overflow.filter((e) => isObj(e) && num(e.endedAt) > covered);
  const a: Archive = { count: archive.count || 0, num: archive.num ?? {}, big: archive.big ?? {}, tally: archive.tally ?? {} };
  foldInto(a, fresh);
  return a;
}
