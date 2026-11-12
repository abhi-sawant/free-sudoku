// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameStats, HistoryLike, LevelStats } from '../src/shared/gamestats.ts';
import { type TitleInput, autoTitle, formatTitle, parseTitle, titleWords } from '../src/shared/titles.ts';

const FAMILIES = ['blue', 'orange', 'lilac', 'sky', 'olive', 'berry', 'plum', 'cocoa'];
const NAMES: Record<string, string> = { sudoku: 'Sudoku' };

interface Opts { played?: number; won?: number; drawn?: number; lost?: number; versus?: boolean; bestTime?: number; levels?: LevelStats[]; history?: HistoryLike[]; timeMs?: number }
function game(slug: string, family: string, o: Opts = {}): GameStats {
  return {
    info: { slug, name: NAMES[slug] ?? slug, family, familyLabel: family, icon: '' },
    played: o.played ?? 0, won: o.won ?? 0, drawn: o.drawn ?? 0, lost: o.lost ?? 0, versus: !!o.versus,
    levels: o.levels ?? [], bestTime: o.bestTime, timeMs: o.timeMs ?? 0, opens: 0,
    history: o.history ?? [], archive: { count: 0, num: {}, big: {}, tally: {} }, playtime: { ms: 0, opens: 0, first: 0, last: 0, pending: 0 },
  } as GameStats;
}
/** 24 unplayed games, three per family, plus whatever the test adds (replacing by slug). */
function catalog(...played: GameStats[]): GameStats[] {
  const base = FAMILIES.flatMap((f) => [0, 1, 2].map((i) => game(`${f}${i}`, f)));
  for (const g of played) {
    const i = base.findIndex((b) => b.info.slug === g.info.slug);
    if (i >= 0) base[i] = g; else base.push(g);
  }
  return base;
}
const input = (games: GameStats[], o: Partial<TitleInput> = {}): TitleInput =>
  ({ games, longestStreak: 0, bestDay: 0, earned: {}, badgeTotal: 39, theme: 'mist', ...o });
const at = (hour: number, day = 3) => new Date(2026, 10, day, hour, 30).getTime(); // 2026-11-03 is a Tuesday

test('brand-new player', () => {
  const inp = input(catalog());
  assert.deepEqual(autoTitle(inp), { adj: 'Fresh', noun: 'Newcomer' });
  assert.equal(formatTitle(autoTitle(inp)), 'The Fresh Newcomer');
  const w = titleWords(inp);
  assert.deepEqual(w.adjectives.slice(-2), ['Breezy', 'Fresh']);
  assert.deepEqual(w.nouns, ['Newcomer']);
  for (const word of [...w.adjectives, ...w.nouns]) assert.ok(typeof word === 'string' && !/NaN|undefined/.test(word));
});

test('family tiers', () => {
  const inp = input(catalog(game('sky0', 'sky', { played: 60 }), game('sky1', 'sky', { played: 60 }), game('blue0', 'blue', { played: 40 }), game('orange0', 'orange', { played: 40 })));
  const { nouns } = titleWords(inp);
  assert.ok(nouns.includes('Challenger') && nouns.includes('Tactician'));
  assert.ok(!nouns.includes('Strategist'));
  assert.equal(autoTitle(inp).noun, 'Tactician');
});

test('one game wins the noun', () => {
  const inp = input(catalog(game('sudoku', 'blue', { played: 90 }), game('sky0', 'sky', { played: 60 }), game('olive0', 'olive', { played: 50 })));
  assert.equal(autoTitle(inp).noun, 'Sudoku Fan');
  assert.ok(titleWords(inp).nouns.includes('Number Cruncher'));
});

test('bit of everything', () => {
  // 25 games tried with 1 game each, spread over all eight families: no family reaches 10 games.
  const tried = FAMILIES.flatMap((f) => [0, 1, 2, 3].map((i) => game(`${f}${i}`, f, { played: 1 }))).slice(0, 25);
  const inp = input(catalog(...tried));
  assert.equal(autoTitle(inp).noun, 'All-Rounder');
  assert.ok(titleWords(inp).nouns.includes('Wanderer'));
});

test('night owl', () => {
  const history = [...Array(15)].map(() => ({ endedAt: at(23) })).concat([...Array(15)].map(() => ({ endedAt: at(15) })));
  const inp = input(catalog(game('olive0', 'olive', { played: 30, history })));
  const { adjectives } = titleWords(inp);
  for (const a of ['Night-Owl', 'Midnight', 'Moonlit']) assert.ok(adjectives.includes(a), a);
  assert.equal(autoTitle(inp).adj, 'Night-Owl');
});

test('priority', () => {
  const history = [...Array(30)].map(() => ({ endedAt: at(23) }));
  const inp = input(catalog(game('olive0', 'olive', { played: 30, history })), { earned: { 'giant-slayer': 1 } });
  assert.equal(autoTitle(inp).adj, 'Giant-Slaying');
});

test('stubborn', () => {
  const inp = input(catalog(game('sky0', 'sky', { played: 60, won: 10, lost: 50, versus: true })));
  const { adjectives } = titleWords(inp);
  assert.ok(adjectives.includes('Stubborn') && adjectives.includes('Never-Say-Die'));
});

test('theme word follows the theme', () => {
  const { adjectives } = titleWords(input(catalog(), { theme: 'clay' }));
  assert.ok(adjectives.includes('Squishy'));
  assert.ok(!adjectives.includes('Breezy'));
});

test('current pick stays offered', () => {
  const w = titleWords(input(catalog()), { adj: 'Night-Owl', noun: 'Strategist' });
  assert.ok(w.adjectives.includes('Night-Owl'));
  assert.ok(w.nouns.includes('Strategist'));
});

test('parseTitle rejects junk', () => {
  for (const raw of [null, 'oops', '{"adj":1,"noun":"x","at":1}', '{"auto":true}', '{"adj":"","noun":"x","at":1}']) assert.equal(parseTitle(raw), null, String(raw));
  assert.deepEqual(parseTitle('{"adj":"Zen","noun":"Puzzler","at":3}'), { adj: 'Zen', noun: 'Puzzler', at: 3 });
  assert.deepEqual(parseTitle('{"auto":true,"at":3}'), { auto: true, at: 3 });
});
