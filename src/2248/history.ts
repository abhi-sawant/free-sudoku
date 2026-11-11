// Log of finished games (out of moves, or left unfinished), newest first, kept in localStorage.

import { toScore } from './score';

export interface HistoryEntry {
  startedAt: number | null; // epoch ms of the first merge
  endedAt: number;
  score: bigint; // stored as a digit string, since JSON has no BigInt
  maxExp: number;
  merges: number;
  result: 'over' | 'unfinished';
}

const HISTORY_KEY = '2248.history';
const MAX_ENTRIES = 500;

export function loadHistory(): HistoryEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(list) ? list.map((e) => ({ ...e, score: toScore(e.score) })) : [];
  } catch {
    return [];
  }
}

export function addHistory(entry: HistoryEntry) {
  const list = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.map((e) => ({ ...e, score: e.score.toString() }))));
  } catch { /* storage full or unavailable */ }
}

/** Mean score of the logged games, rounded down, or null if there are none. */
export function averageScore(list: HistoryEntry[]): bigint | null {
  return list.length ? list.reduce((a, e) => a + e.score, 0n) / BigInt(list.length) : null;
}

/** Highest score among the logged games, or 0. */
export function bestLoggedScore(list: HistoryEntry[]): bigint {
  return list.reduce((best, e) => (e.score > best ? e.score : best), 0n);
}
