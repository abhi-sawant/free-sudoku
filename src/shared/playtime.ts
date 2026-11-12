// Time played, per game, measured in one place for every game page: it runs while the game screen (#game) is showing,
// the page is visible, and the player has touched or pressed something in the last few minutes. Nothing is shown in
// the games; the numbers are for the stats page. Kept in localStorage as `<game>.playtime`:
//
//   ms       total active time on the game screen, ever
//   opens    times the game's page was opened
//   first    epoch ms the game was first opened (since tracking began)
//   last     epoch ms of the latest active play
//   pending  active ms not yet credited to a history entry (see takeActive)

import { loadJSON, saveJSON } from './store';

export interface Playtime { ms: number; opens: number; first: number; last: number; pending: number }

/** No input for this long and the clock stops, so a board left on screen overnight doesn't count. */
const IDLE_MS = 3 * 60_000;
const TICK_MS = 1000;
const FLUSH_MS = 10_000;

export const playtimeKey = (slug: string) => `${slug}.playtime`;

export function loadPlaytime(slug: string): Playtime {
  const p = loadJSON<Partial<Playtime>>(playtimeKey(slug), {});
  return { ms: Number(p.ms) || 0, opens: Number(p.opens) || 0, first: Number(p.first) || 0, last: Number(p.last) || 0, pending: Number(p.pending) || 0 };
}

// This page's game, and the active time counted since the last write to storage.
let slug: string | null = null;
let unsaved = 0;

function flush() {
  if (!slug || unsaved <= 0) return;
  const p = loadPlaytime(slug);
  p.ms += unsaved;
  p.pending += unsaved;
  p.last = Date.now();
  unsaved = 0;
  saveJSON(playtimeKey(slug), p);
}

/**
 * The active time since the game's previous history entry, credited to the entry being written now, in ms. History
 * writers stamp it on each entry as `activeMs`, so every game gets a per-game play time without tracking it itself.
 */
export function takeActive(game: string): number {
  if (game === slug) flush();
  const p = loadPlaytime(game);
  const ms = Math.round(p.pending);
  if (ms) { p.pending = 0; saveJSON(playtimeKey(game), p); }
  return ms;
}

/** Starts the clock on a game page. Called once, from pwa.ts, which every page loads. */
export function trackPlaytime(game: string) {
  const screen = document.getElementById('game');
  if (!screen) return;
  slug = game;
  const p = loadPlaytime(game);
  p.opens++;
  if (!p.first) p.first = Date.now();
  saveJSON(playtimeKey(game), p);

  let lastInput = Date.now();
  const touched = () => { lastInput = Date.now(); };
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, touched, { passive: true, capture: true });

  let lastTick = performance.now();
  let sinceFlush = 0;
  setInterval(() => {
    const now = performance.now();
    // A tick can arrive late (a throttled tab, a sleeping phone): never count more than two ticks' worth.
    const dt = Math.min(now - lastTick, TICK_MS * 2);
    lastTick = now;
    if (!document.hidden && !screen.hidden && Date.now() - lastInput < IDLE_MS) unsaved += dt;
    sinceFlush += dt;
    if (sinceFlush >= FLUSH_MS) { sinceFlush = 0; flush(); }
  }, TICK_MS);

  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else touched(); });
  addEventListener('pagehide', flush);
}
