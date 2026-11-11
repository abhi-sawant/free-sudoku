// Badges: earned from what the games already record, worked out on the device and never sent anywhere. Each badge is
// a rule over every game's numbers (see gamestats.ts); unlocking one stores when, in `games.badges`, and shows a small
// popup with confetti (celebrate.ts). Badges are only ever added, never taken back, so a badge earned from a game
// later dropped from the history stays earned.
//
// Secret badges show as "???" on the badges page until they're earned.

import { type GameInfo, type GameStats, byHour, collectGame, gamesPerDay, loadCatalog, streaks } from './gamestats';

export interface Ctx {
  games: GameStats[];
  bySlug: Map<string, GameStats>;
  played: number;
  tried: number;
  timeMs: number;
  longestStreak: number;
  bestDay: number; // most games finished in one day
  hours: number[];
  found: Set<string>; // hidden pages opened: 'stats', 'badges'
}

export interface Badge {
  id: string;
  name: string;
  desc: string; // how it's earned, shown once earned and as the hint while locked
  mark: string; // 1 to 3 characters in the medallion
  ink?: string; // a family ink; general badges use the page's
  secret?: boolean;
  earned: (c: Ctx) => boolean;
}

const HOUR = 3_600_000;
const g = (c: Ctx, slug: string) => c.bySlug.get(slug);
const levelWon = (c: Ctx, slug: string, level: string) => (g(c, slug)?.levels.find((l) => l.name === level)?.won ?? 0) > 0;

/** "Play every game in a family" badges, one per home page section. */
const FAMILY_NAMES: Record<string, [name: string, mark: string, desc: string]> = {
  blue: ['Number cruncher', '#', 'Play every number puzzle'],
  orange: ['Logician', '∴', 'Play every logic puzzle'],
  lilac: ['Tile wrangler', '2ⁿ', 'Play every number-tile game'],
  sky: ['Strategist', '♞', 'Play every game against the computer'],
  olive: ['Card shark', '♠', 'Play every card game'],
  berry: ['Wordsmith', 'Aa', 'Play every word game'],
  plum: ['High roller', '⚄', 'Play every dice game'],
  cocoa: ['Arcade ace', '▶', 'Play every arcade game'],
};

const BASE: Badge[] = [
  // Getting going
  { id: 'first-game', name: 'First move', desc: 'Finish your first game', mark: '1', earned: (c) => c.played >= 1 },
  { id: 'games-10', name: 'Warming up', desc: 'Play 10 games', mark: '10', earned: (c) => c.played >= 10 },
  { id: 'games-100', name: 'Hooked', desc: 'Play 100 games', mark: '100', earned: (c) => c.played >= 100 },
  { id: 'games-500', name: 'Devoted', desc: 'Play 500 games', mark: '500', earned: (c) => c.played >= 500 },
  { id: 'games-1000', name: 'Legend', desc: 'Play 1,000 games', mark: '1K', earned: (c) => c.played >= 1000 },
  // Variety
  { id: 'tried-5', name: 'Sampler', desc: 'Play 5 different games', mark: '5', earned: (c) => c.tried >= 5 },
  { id: 'tried-20', name: 'Explorer', desc: 'Play 20 different games', mark: '20', earned: (c) => c.tried >= 20 },
  { id: 'tried-all', name: 'Completionist', desc: 'Play every game at least once', mark: '∀', earned: (c) => c.tried >= c.games.length && c.games.length > 0 },
  // Time
  { id: 'time-1h', name: 'An hour in', desc: 'Play for an hour in total', mark: '1h', earned: (c) => c.timeMs >= HOUR },
  { id: 'time-10h', name: 'Ten hours', desc: 'Play for 10 hours in total', mark: '10h', earned: (c) => c.timeMs >= 10 * HOUR },
  { id: 'time-100h', name: 'A hundred hours', desc: 'Play for 100 hours in total', mark: '100h', earned: (c) => c.timeMs >= 100 * HOUR },
  // Habits
  { id: 'streak-3', name: 'Three in a row', desc: 'Play on 3 days in a row', mark: '3d', earned: (c) => c.longestStreak >= 3 },
  { id: 'streak-7', name: 'A week straight', desc: 'Play on 7 days in a row', mark: '7d', earned: (c) => c.longestStreak >= 7 },
  { id: 'streak-30', name: 'A month straight', desc: 'Play on 30 days in a row', mark: '30d', earned: (c) => c.longestStreak >= 30 },
  { id: 'marathon', name: 'Marathon', desc: 'Finish 20 games in one day', mark: '20×', earned: (c) => c.bestDay >= 20 },
  { id: 'night-owl', name: 'Night owl', desc: 'Finish a game between midnight and 4am', mark: '☾', earned: (c) => c.hours.slice(0, 4).some(Boolean) },
  { id: 'early-bird', name: 'Early bird', desc: 'Finish a game between 5am and 7am', mark: '☀', earned: (c) => c.hours.slice(5, 7).some(Boolean) },
  // Skill, across games
  { id: 'quick', name: 'Quick thinker', desc: 'Solve a timed puzzle in under a minute', mark: '⏱', earned: (c) => c.games.some((x) => x.bestTime !== undefined && x.bestTime < 60_000) },
  { id: 'giant-slayer', name: 'Giant slayer', desc: 'Beat the computer on Hard in any game', mark: '⚔', ink: 'sky', earned: (c) => c.games.some((x) => x.versus && x.levels.some((l) => l.name === 'hard' && (l.won ?? 0) > 0)) },
  // Game by game
  { id: 'sudoku-expert', name: 'Sudoku master', desc: 'Solve an Expert Sudoku', mark: '9', ink: 'blue', earned: (c) => levelWon(c, 'sudoku', 'expert') },
  { id: 'mines-expert', name: 'Bomb squad', desc: 'Clear an Expert Minesweeper board', mark: '✸', ink: 'orange', earned: (c) => levelWon(c, 'minesweeper', 'expert') },
  { id: '2048', name: '2048!', desc: 'Make the 2048 tile in 2048', mark: '2K', ink: 'lilac', earned: (c) => (g(c, '2048')?.won ?? 0) > 0 },
  { id: '2248-million', name: 'A million', desc: 'Make a 1M tile in 2248', mark: '1M', ink: 'lilac', earned: (c) => (g(c, '2248')?.bestTileExp ?? 0) >= 20 },
  { id: 'halo-2048', name: 'Full circle', desc: 'Make a 2K tile in Halo', mark: '○', ink: 'lilac', earned: (c) => (g(c, 'halo')?.bestTileExp ?? 0) >= 11 },
  { id: 'checkmate', name: 'Checkmate', desc: 'Beat the computer at chess on Hard', mark: '♚', ink: 'sky', earned: (c) => levelWon(c, 'chess', 'hard') },
  { id: 'solitaire', name: 'Patience', desc: 'Win a game of Klondike', mark: '♥', ink: 'olive', earned: (c) => (g(c, 'klondike')?.won ?? 0) > 0 },
  { id: 'freecell', name: 'Free hand', desc: 'Win a game of FreeCell', mark: '♣', ink: 'olive', earned: (c) => (g(c, 'freecell')?.won ?? 0) > 0 },
  { id: 'word-streak', name: 'On a roll', desc: 'Guess the word 7 days running', mark: 'W', ink: 'berry', earned: (c) => (g(c, 'wordguess')?.bestStreak ?? 0) >= 7 },
  { id: 'qubo-10', name: 'Tower hopper', desc: 'Cross 10 towers in Qubo', mark: '▲', ink: 'cocoa', earned: (c) => (g(c, 'qubo')?.bestRun ?? 0) >= 10 },
  // Secrets
  { id: 'found-stats', name: 'Snoop', desc: 'Find the hidden stats page', mark: '?', secret: true, earned: (c) => c.found.has('stats') },
  { id: 'found-badges', name: 'Badge hunter', desc: 'Find the hidden badges page', mark: '!', secret: true, earned: (c) => c.found.has('badges') },
];

/** Every badge: the fixed ones, plus one per family on the home page. */
export function allBadges(catalog: GameInfo[]): Badge[] {
  const families = [...new Map(catalog.map((x) => [x.family, x.familyLabel])).entries()];
  const fam = families.map(([ink, label]): Badge => {
    // A family added later without a name here still gets a badge, named after its section.
    const [name, mark, desc] = FAMILY_NAMES[ink] ?? [label, label.charAt(0), `Play every game in ${label}`];
    return {
      id: `family-${ink}`,
      name,
      desc,
      mark,
      ink,
      earned: (c) => c.games.filter((x) => x.info.family === ink).every((x) => x.played > 0),
    };
  });
  // Family badges sit after the variety ones.
  const at = BASE.findIndex((b) => b.id === 'time-1h');
  return [...BASE.slice(0, at), ...fam, ...BASE.slice(at)];
}

// ---------- Storage ----------

const KEY = 'games.badges';

/** When each earned badge was unlocked, epoch ms, by id. */
export function loadEarned(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function saveEarned(e: Record<string, number>) {
  try { localStorage.setItem(KEY, JSON.stringify(e)); } catch { /* storage full or unavailable */ }
}

export function buildCtx(games: GameStats[]): Ctx {
  const perDay = gamesPerDay(games);
  const found = new Set<string>();
  for (const page of ['stats', 'badges']) {
    try { if (localStorage.getItem(`${page}.found`)) found.add(page); } catch { /* ignore */ }
  }
  return {
    games,
    bySlug: new Map(games.map((x) => [x.info.slug, x])),
    played: games.reduce((s, x) => s + x.played, 0),
    tried: games.filter((x) => x.played > 0).length,
    timeMs: games.reduce((s, x) => s + x.timeMs, 0),
    longestStreak: streaks(perDay).longest,
    bestDay: Math.max(0, ...perDay.values()),
    hours: byHour(games),
    found,
  };
}

let catalogCache: Promise<GameInfo[]> | null = null;
export const catalog = () => (catalogCache ??= loadCatalog());

/** Checks every badge and stores any newly earned ones. Returns the new ones, in list order. */
export async function checkBadges(): Promise<Badge[]> {
  const cat = await catalog();
  const badges = allBadges(cat);
  const ctx = buildCtx(cat.map(collectGame));
  const earned = loadEarned();
  const fresh = badges.filter((b) => !earned[b.id] && safe(() => b.earned(ctx)));
  if (fresh.length) {
    const now = Date.now();
    for (const b of fresh) earned[b.id] = now;
    saveEarned(earned);
  }
  return fresh;
}

function safe(fn: () => boolean): boolean {
  try { return fn(); } catch { return false; }
}
