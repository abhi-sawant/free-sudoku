// Reads every game's saved numbers for the stats page. Games keep their own `<game>.stats` and `<game>.history` in
// several shapes (per-level puzzle times, win/draw/loss records, scores and tiles, arcade runs), plus the shared
// `<game>.playtime` and `<game>.archive`; this turns them all into one GameStats per game. Nothing here writes.

import { type Archive, loadArchive } from '../shared/archive';
import { type Playtime, loadPlaytime } from '../shared/playtime';
import { toScore } from '../shared/tilescore';

/** A game as the home page lists it. */
export interface GameInfo {
  slug: string;
  name: string;
  family: string; // the family's ink: blue, orange, lilac…
  familyLabel: string; // "Number puzzles"
  icon: string; // the home card's icon markup
}

export interface LevelStats {
  name: string;
  played: number;
  won?: number;
  drawn?: number;
  lost?: number;
  bestTime?: number; // ms
  best?: number; // arcade best score
}

export interface HistoryLike { endedAt: number; elapsed?: number; activeMs?: number; result?: string; [k: string]: unknown }

export interface GameStats {
  info: GameInfo;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  versus: boolean; // records draws and losses: a game against the computer or a friend
  levels: LevelStats[];
  bestTime?: number; // ms, fastest win on any level
  bestScore?: bigint;
  bestTileExp?: number; // 2248, 2048, Halo
  bestTile?: number; // Threes stores the tile's value
  bestRun?: number; // arcade best score
  bestStreak?: number; // Word Guess
  timeMs: number;
  opens: number;
  first?: number; // epoch ms
  last?: number;
  history: HistoryLike[];
  archive: Archive;
  playtime: Playtime;
}

function readJSON(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function collectGame(info: GameInfo): GameStats {
  const { slug } = info;
  const raw = readJSON(`${slug}.stats`);
  const hist = readJSON(`${slug}.history`);
  const history: HistoryLike[] = Array.isArray(hist)
    ? hist.filter((e): e is HistoryLike => isObj(e) && typeof e.endedAt === 'number')
    : [];
  const archive = loadArchive(`${slug}.history`);
  const playtime = loadPlaytime(slug);
  const g: GameStats = { info, played: 0, won: 0, drawn: 0, lost: 0, versus: false, levels: [], timeMs: 0, opens: playtime.opens, history, archive, playtime };

  if (isObj(raw)) {
    const flat = typeof raw.played === 'number' || typeof raw.runs === 'number';
    if (flat) {
      // One record for the whole game: score games, Word Guess, Qubo.
      g.played = num(raw.played) || num(raw.runs);
      g.won = num(raw.won);
      if (raw.bestScore !== undefined) g.bestScore = toScore(raw.bestScore);
      if (num(raw.bestExp)) g.bestTileExp = num(raw.bestExp);
      if (num(raw.bestTile)) g.bestTile = num(raw.bestTile);
      if (slug === 'wordguess') g.bestStreak = num(raw.best);
      else if (num(raw.best)) g.bestRun = num(raw.best);
    } else {
      // A record per level.
      for (const [name, v] of Object.entries(raw)) {
        if (!isObj(v)) continue;
        const l: LevelStats = { name, played: num(v.played) || num(v.runs) };
        if (typeof v.won === 'number') l.won = v.won;
        if (typeof v.drawn === 'number') l.drawn = v.drawn;
        if (typeof v.lost === 'number') l.lost = v.lost;
        if (typeof v.bestTime === 'number') l.bestTime = v.bestTime;
        if (typeof v.best === 'number') l.best = v.best;
        // Sudoku only counted games played once it had a history, so it can report fewer games than wins.
        l.played = Math.max(l.played, l.won ?? 0);
        g.levels.push(l);
        g.played += l.played;
        g.won += l.won ?? 0;
        g.drawn += l.drawn ?? 0;
        g.lost += l.lost ?? 0;
        if (l.drawn !== undefined || l.lost !== undefined) g.versus = true;
        if (l.bestTime != null) g.bestTime = g.bestTime === undefined ? l.bestTime : Math.min(g.bestTime, l.bestTime);
        if (l.best) g.bestRun = Math.max(g.bestRun ?? 0, l.best);
      }
    }
  } else if (slug === 'qubo') {
    // Before Qubo kept stats it saved only its best score.
    const best = num(readJSON('qubo.best'));
    if (best) g.bestRun = best;
  }
  // A game whose stats undercount (or are missing) still counts every game it logged.
  g.played = Math.max(g.played, history.length + archive.count);

  // Time: the playtime clock, or for games played before it existed, the logged game times, whichever is more.
  const logged = history.reduce((s, e) => s + num(e.elapsed), 0) + (archive.num.elapsed?.sum ?? 0);
  g.timeMs = Math.max(playtime.ms, logged);

  const dates = [history.at(-1)?.endedAt, archive.num.endedAt?.min, playtime.first].filter((d): d is number => !!d);
  if (dates.length) g.first = Math.min(...dates);
  const lasts = [history[0]?.endedAt, archive.num.endedAt?.max, playtime.last].filter((d): d is number => !!d);
  if (lasts.length) g.last = Math.max(...lasts);
  return g;
}

/** The games the home page lists, in its order and families, read from the home page itself so new games join here
 *  without a list of their own. */
export async function loadCatalog(): Promise<GameInfo[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}index.html`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const out: GameInfo[] = [];
  for (const section of doc.querySelectorAll<HTMLElement>('section.family')) {
    const family = section.dataset.family ?? 'blue';
    const familyLabel = section.querySelector('.section-label')?.textContent?.trim() ?? '';
    for (const a of section.querySelectorAll<HTMLAnchorElement>('a.game-card')) {
      const slug = (a.getAttribute('href') ?? '').split('/').filter(Boolean)[0];
      if (!slug) continue;
      out.push({
        slug,
        name: a.querySelector('.game-name')?.textContent?.trim() ?? slug,
        family,
        familyLabel,
        icon: a.querySelector('.game-icon')?.outerHTML ?? '',
      });
    }
  }
  return out;
}

// ---------- Across games ----------

const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const DAY = 86_400_000;

/** Games finished per day (local time), from every game's history. */
export function gamesPerDay(all: GameStats[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of all) for (const e of g.history) m.set(dayKey(e.endedAt), (m.get(dayKey(e.endedAt)) ?? 0) + 1);
  return m;
}

/** The current run of days with a game in it (alive if the last one was today or yesterday) and the longest. */
export function streaks(perDay: Map<string, number>, now = Date.now()): { current: number; longest: number } {
  let current = 0;
  let t = startOfDay(now);
  if (!perDay.has(dayKey(t))) t -= DAY;
  // Step by calendar day rather than 24 hours, so a clock change doesn't skip or repeat a day.
  const back = (x: number) => { const d = new Date(x); d.setDate(d.getDate() - 1); return d.getTime(); };
  while (perDay.has(dayKey(t))) { current++; t = back(t); }
  const days = [...perDay.keys()].map((k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d).getTime(); }).sort((a, b) => a - b);
  let longest = 0, run = 0, prev = -Infinity;
  for (const d of days) {
    const next = new Date(prev); next.setDate(next.getDate() + 1);
    run = d === next.getTime() ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}

/** Games finished in each hour of the day, 0 to 23. */
export function byHour(all: GameStats[]): number[] {
  const h = Array<number>(24).fill(0);
  for (const g of all) for (const e of g.history) h[new Date(e.endedAt).getHours()]++;
  return h;
}

export { dayKey, startOfDay };
