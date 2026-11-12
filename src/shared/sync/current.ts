// The game in progress (`<game>.current`) is the one save that two devices can't combine: there is only one board.
// merge.ts keeps whichever device saved last; this adds what that misses when a game page is open. Pure, so
// tests/current.test.ts can check every case.
//
// - The page holds its game in memory from the moment it loaded, so a newer copy written underneath it is never
//   shown, and the page's next save would write its old game back over it. So: if the player hasn't played on this
//   page since opening it, it reloads to show the newer game; if they have, their game stays.
// - Whenever this device's game is kept over a different one, the other is kept beside it, under a key that never
//   syncs, for the menu's "Continue from your other device" (othergame.ts).

import { sameValue } from './merge.ts';

/** Where the losing copy from the other device is kept. Not a sync key (see kindOf in merge.ts). */
export const otherKey = (currentKey: string) => `${currentKey}.other`;

/** How the open page relates to this key: not its game, its game but unplayed since load, or played since load. */
export type PageHold = 'none' | 'untouched' | 'touched';

export interface CurrentResult {
  /** What this device's save should now be. */
  value: string | null;
  /** The copy to offer from the other device, or null for none. */
  other: string | null;
  /** The open game page should reload to show `value`. */
  reload: boolean;
}

/** A save of a game nobody has made a move in yet. Games that record `started` (the puzzle boards, solitaire) hide
 *  Continue for one, so the other device's copy isn't offered either: there would be nothing to continue. */
export function notStarted(save: string): boolean {
  try { return (JSON.parse(save) as { started?: unknown }).started === false; } catch { return false; }
}

export function resolveCurrent(local: string | null, remote: string | null, localNewer: boolean, page: PageHold): CurrentResult {
  if (sameValue(local, remote)) return { value: local, other: null, reload: false };
  const keepLocal = localNewer || page === 'touched';
  if (keepLocal) return { value: local, other: remote, reload: false };
  return { value: remote, other: null, reload: page === 'untouched' };
}
