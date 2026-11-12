// Halo stats, kept in localStorage.

import { toScore } from '../shared/tilescore';

export interface Stats {
  played: number; // counted on the first move, so boards opened and left untouched don't count
  bestExp: number; // highest tile ever made
  bestScore: bigint; // stored as a digit string, since JSON has no BigInt
}

const STATS_KEY = 'halo.stats';

export function loadStats(): Stats {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null');
    if (s) return { played: Number(s.played) || 0, bestExp: Number(s.bestExp) || 0, bestScore: toScore(s.bestScore) };
  } catch { /* fall through */ }
  return { played: 0, bestExp: 0, bestScore: 0n };
}

function update(fn: (s: Stats) => void) {
  const stats = loadStats();
  fn(stats);
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify({ ...stats, bestScore: stats.bestScore.toString() }));
  } catch { /* storage full or unavailable */ }
}

export function recordStart() {
  update((s) => { s.played++; });
}

/** Keeps the best tile and score up to date during play, not just when a game ends. */
export function recordProgress(maxExp: number, score: bigint) {
  update((s) => {
    s.bestExp = Math.max(s.bestExp, maxExp);
    if (score > s.bestScore) s.bestScore = score;
  });
}
