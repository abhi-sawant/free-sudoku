// Where the profile keeps the player's title choice. `games.title` is a synced key (merge.ts: the later pick wins), so a
// title chosen on one device shows on every device signed in to the same account.

import { type StoredTitle, type Title, parseTitle } from './titles';

export const TITLE_KEY = 'games.title';

export function loadTitle(): StoredTitle | null {
  try { return parseTitle(localStorage.getItem(TITLE_KEY)); } catch { return null; }
}

/** A pair the player picked, or 'auto' to let the profile choose again. */
export function saveTitle(t: Title | 'auto'): void {
  const v: StoredTitle = t === 'auto' ? { auto: true, at: Date.now() } : { adj: t.adj, noun: t.noun, at: Date.now() };
  try { localStorage.setItem(TITLE_KEY, JSON.stringify(v)); } catch { /* storage unavailable: the choice isn't kept */ }
}
