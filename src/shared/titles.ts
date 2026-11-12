// Personality titles for the profile: "The [how you play] [what you play]", worked out from what this device already
// records (gamestats.ts, badges, the theme). Pure, so tests/titles.test.ts can check every rule. The thresholds are the
// ones in docs/superpowers/specs/2026-11-12-profile-page-design.md.
//
// Every word unlocks from a rule; the profile picks the best fit (autoTitle), and the player can pick any unlocked pair
// instead (titleWords lists them). A word they picked stays on offer even if they stop qualifying for it.

import type { GameStats } from './gamestats';

export interface TitleInput {
  games: GameStats[]; // every game in the catalog, played or not
  longestStreak: number;
  bestDay: number; // most games finished in one day
  earned: Record<string, number>; // badge id -> when
  badgeTotal: number;
  theme: string;
}
export interface Title { adj: string; noun: string }
export const formatTitle = (t: Title) => `The ${t.adj} ${t.noun}`;

/** What `games.title` holds: the player's pick, or automatic, with when it was chosen (the later choice syncs). */
export type StoredTitle = ({ auto: true } | { adj: string; noun: string }) & { at: number };

export function parseTitle(raw: string | null): StoredTitle | null {
  if (raw === null) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'number' || !Number.isFinite(o.at)) return null;
  if (o.auto === true) return { auto: true, at: o.at };
  const ok = (s: unknown): s is string => typeof s === 'string' && s.trim() !== '' && s.length <= 40;
  return ok(o.adj) && ok(o.noun) ? { adj: o.adj, noun: o.noun, at: o.at } : null;
}

// ---------- Words ----------

const FAMILY_NOUNS: Record<string, [string, string, string]> = {
  blue: ['Number Cruncher', 'Numerist', 'Grid Sage'],
  orange: ['Puzzler', 'Logician', 'Mastermind'],
  lilac: ['Tile Pusher', 'Merger', 'Tile Tycoon'],
  sky: ['Challenger', 'Tactician', 'Strategist'],
  olive: ['Card Player', 'Card Shark', 'Dealer'],
  berry: ['Word Nerd', 'Wordsmith', 'Lexicographer'],
  plum: ['Dice Roller', 'High Roller', 'Dice Whisperer'],
  cocoa: ['Button Masher', 'Arcade Ace', 'Speedrunner'],
};
const TIERS = [10, 100, 500];
const ONE_GAME = ['Fan', 'Devotee', 'Legend'];
const EVERYTHING = ['Wanderer', 'All-Rounder', 'Polymath'];

const THEME_WORDS: Record<string, string> = {
  mist: 'Breezy', linen: 'Cosy', sage: 'Zen', graph: 'Doodling', block: 'Bold', pocket: 'Retro', midnight: 'Nocturnal',
  brutal: 'Brutal', terminal: 'Hacker', blueprint: 'Blueprinted', clay: 'Squishy', felt: 'Parlour', news: 'Headline',
};

/** The automatic pick takes the first qualifying adjective in this order; the picker lists them in it too. */
const ADJ_ORDER = [
  'Legendary', 'Relentless', 'Gilded', 'Giant-Slaying', 'Ruthless', 'Lightning', 'Big-Number', 'Well-Rounded', 'Veteran',
  'Hardcore', 'Night-Owl', 'Early-Bird', 'Marathon', 'Decorated', 'Swift', 'Stubborn', 'Bite-Sized', 'Patient', 'Daily',
  'Loyal', 'Curious', 'Weekend', 'Lunch-Break', 'Sneaky', 'Seasoned', 'Midnight', 'Moonlit', 'Sunrise', 'Binge',
  'Deep-Focus', 'Never-Say-Die',
];

// ---------- Facts ----------

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function adjectives(inp: TitleInput): Set<string> {
  const { games, earned } = inp;
  const out = new Set<string>();
  const add = (cond: boolean, ...words: string[]) => { if (cond) for (const w of words) out.add(w); };

  const total = games.reduce((s, g) => s + g.played, 0);
  const tried = games.filter((g) => g.played > 0).length;
  const history = games.flatMap((g) => g.history);
  const finished = history.length;

  // Time of day and week, local time, from finished games.
  const hours = history.map((e) => new Date(e.endedAt).getHours());
  const share = (test: (h: number) => boolean) => ratio(hours.filter(test).length, finished);
  const enough = finished >= 10;
  add(enough && share((h) => h >= 22 || h < 4) >= 0.4, 'Night-Owl', 'Midnight', 'Moonlit');
  add(enough && share((h) => h >= 5 && h < 9) >= 0.3, 'Early-Bird', 'Sunrise');
  add(enough && share((h) => h >= 12 && h < 14) >= 0.3, 'Lunch-Break');
  const weekend = history.filter((e) => { const d = new Date(e.endedAt).getDay(); return d === 0 || d === 6; }).length;
  add(enough && ratio(weekend, finished) >= 0.6, 'Weekend');

  // Habits.
  add(inp.longestStreak >= 7, 'Daily');
  add(inp.longestStreak >= 30, 'Relentless');
  add(inp.bestDay >= 20, 'Marathon', 'Binge');
  const lengths = history.map((e) => num(e.activeMs) || num(e.elapsed)).filter((x) => x > 0);
  add(lengths.length >= 50 && median(lengths) < 180_000, 'Bite-Sized');
  add(lengths.length >= 20 && median(lengths) > 900_000, 'Patient', 'Deep-Focus');

  // Skill.
  add(!!earned.quick, 'Lightning');
  const wins = games.filter((g) => g.bestTime !== undefined).flatMap((g) => g.history)
    .filter((e) => e.result === 'won' && num(e.elapsed) > 0).map((e) => num(e.elapsed));
  add(wins.length >= 20 && median(wins) < 180_000, 'Swift');
  add(!!earned['giant-slayer'], 'Giant-Slaying');
  add(!!(earned['2048'] || earned['2248-million'] || earned['halo-2048']), 'Big-Number');
  const vs = games.filter((g) => g.versus);
  const vsGames = vs.reduce((s, g) => s + g.won + g.drawn + g.lost, 0);
  add(vsGames >= 20 && ratio(vs.reduce((s, g) => s + g.won, 0), vsGames) >= 0.7, 'Ruthless');
  let top = 0, levelPlays = 0;
  for (const g of games) {
    if (g.versus) continue;
    const names = new Set(g.levels.map((l) => l.name.toLowerCase()));
    const hardest = names.has('expert') ? 'expert' : 'hard';
    for (const l of g.levels) { levelPlays += l.played; if (l.name.toLowerCase() === hardest) top += l.played; }
  }
  add(levelPlays >= 20 && ratio(top, levelPlays) >= 0.3, 'Hardcore');
  const scored = games.filter((g) => g.versus || g.bestTime !== undefined);
  const scoredPlayed = scored.reduce((s, g) => s + g.played, 0);
  add(scoredPlayed >= 50 && ratio(scored.reduce((s, g) => s + g.won, 0), scoredPlayed) < 0.4, 'Stubborn', 'Never-Say-Die');

  // Variety.
  add(tried >= 20, 'Curious');
  add(games.length > 0 && tried === games.length, 'Well-Rounded');
  add(total >= 20 && games.some((g) => ratio(g.played, total) >= 0.4), 'Loyal');

  // Badges.
  const got = Object.keys(earned).length;
  add(inp.badgeTotal > 0 && got >= inp.badgeTotal / 2, 'Decorated');
  add(inp.badgeTotal > 0 && got >= inp.badgeTotal * 0.9, 'Gilded');
  add(!!(earned['found-stats'] && earned['found-badges']), 'Sneaky');

  // Volume.
  add(games.reduce((s, g) => s + g.timeMs, 0) >= 36_000_000, 'Seasoned');
  add(total >= 500, 'Veteran');
  add(total >= 1000, 'Legendary');
  return out;
}

interface Nouns { list: string[]; auto: string }

function nouns(inp: TitleInput): Nouns {
  const { games } = inp;
  const total = games.reduce((s, g) => s + g.played, 0);
  const tried = games.filter((g) => g.played > 0).length;
  const tier = (n: number) => TIERS.filter((t) => n >= t).length; // 0 to 3

  // One game: the most played, if it's 40%+ of all games.
  const list: string[] = [];
  let oneGame = '';
  const fav = [...games].sort((a, b) => b.played - a.played)[0];
  if (fav && ratio(fav.played, total) >= 0.4 && tier(fav.played)) {
    const t = tier(fav.played);
    for (let i = t - 1; i >= 0; i--) list.push(`${fav.info.name} ${ONE_GAME[i]}`);
    oneGame = list[0];
  }

  // Categories, most played first.
  const byFamily = new Map<string, number>();
  for (const g of games) byFamily.set(g.info.family, (byFamily.get(g.info.family) ?? 0) + g.played);
  const families = [...byFamily].filter(([f]) => FAMILY_NOUNS[f]).sort((a, b) => b[1] - a[1]);
  let topFamily = '';
  for (const [f, n] of families) {
    const t = tier(n);
    if (!t || ratio(n, total) < 0.15) continue;
    const words = FAMILY_NOUNS[f].slice(0, t).reverse();
    if (!topFamily && f === families[0][0]) topFamily = words[0];
    list.push(...words);
  }

  // A bit of everything.
  let everything = '';
  if (tried >= 10 && families.every(([, n]) => ratio(n, total) <= 0.35)) {
    const t = games.length > 0 && tried === games.length ? 3 : tried >= 20 ? 2 : 1;
    const words = EVERYTHING.slice(0, t).reverse();
    everything = words[0];
    list.push(...words);
  }

  list.push('Newcomer');
  return { list, auto: oneGame || topFamily || everything || 'Newcomer' };
}

// ---------- Choosing ----------

/** Every word the player can pick, in order, each once. The current pick's words are always included. */
export function titleWords(inp: TitleInput, current?: Title | null): { adjectives: string[]; nouns: string[] } {
  const have = adjectives(inp);
  const adjs = ADJ_ORDER.filter((a) => have.has(a));
  adjs.push(THEME_WORDS[inp.theme] ?? THEME_WORDS.mist, 'Fresh');
  const n = nouns(inp).list;
  if (current) {
    if (!adjs.includes(current.adj)) adjs.unshift(current.adj);
    if (!n.includes(current.noun)) n.unshift(current.noun);
  }
  return { adjectives: [...new Set(adjs)], nouns: [...new Set(n)] };
}

/** The best fit: the rarest adjective the player has earned, and what they play most. */
export function autoTitle(inp: TitleInput): Title {
  // Before the first game everyone is "The Fresh Newcomer"; the theme word only leads once there's play behind it.
  const played = inp.games.some((g) => g.played > 0);
  return { adj: played ? titleWords(inp).adjectives[0] : 'Fresh', noun: nouns(inp).auto };
}
