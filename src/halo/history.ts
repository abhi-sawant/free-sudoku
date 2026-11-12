// Log of finished games (ring full, or left unfinished), newest first, kept in localStorage.

import { toScore } from '../shared/tilescore';
import { capHistory, stampActive } from '../shared/archive';

export interface HistoryEntry {
  startedAt: number | null; // epoch ms of the first move
  endedAt: number;
  score: bigint; // stored as a digit string, since JSON has no BigInt
  maxExp: number;
  moves: number;
  result: 'over' | 'unfinished';
  activeMs?: number; // active play time, from the shared playtime tracker
}

const HISTORY_KEY = 'halo.history';
const MAX_ENTRIES = 500;

export function loadHistory(): HistoryEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    // Every field is read back as a plain number, so an edited save can't put markup into the history page.
    return Array.isArray(list) ? list.map((e) => ({
      startedAt: Number(e?.startedAt) || null,
      endedAt: Number(e?.endedAt) || 0,
      score: toScore(e?.score),
      maxExp: Number(e?.maxExp) || 0,
      moves: Number(e?.moves) || 0,
      result: e?.result === 'over' ? 'over' : 'unfinished',
      ...(Number.isFinite(e?.activeMs) ? { activeMs: Number(e.activeMs) } : {}),
    })) : [];
  } catch {
    return [];
  }
}

export function addHistory(entry: HistoryEntry) {
  const list = [stampActive(HISTORY_KEY, entry), ...loadHistory()].map((e) => ({ ...e, score: e.score.toString() }));
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(capHistory(HISTORY_KEY, list, MAX_ENTRIES)));
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
