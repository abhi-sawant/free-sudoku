// Sends this player's best results to the global leaderboards. Runs only for signed-in players who haven't opted out
// (Account → Leaderboard), so signed-out play never touches the network. A result is sent once; later, only when it
// improves. Failures are silent and retried on the next game or page load: a leaderboard is never required to play.

import { type Best, bestsOf } from './bests.ts';
import { type Kind, better, boardKind, boardSlugs } from './games.ts';
import { ApiError, authed } from '../sync/api.ts';
import { loadSession } from '../sync/session.ts';

const SENT = 'leaderboard.sent';
const EXTRA: Record<string, string> = { qubo: 'qubo.best', yacht: 'yacht.best' };

interface Sent { uid: number; v: Record<string, string> }

const readJSON = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };

function loadSent(uid: number): Sent {
  const s = readJSON(SENT) as Sent | null;
  return s && s.uid === uid && s.v && typeof s.v === 'object' ? s : { uid, v: {} };
}
const saveSent = (s: Sent) => { try { localStorage.setItem(SENT, JSON.stringify(s)); } catch { /* storage full */ } };

/** Forget what was sent, so the next run sends every best again (after opting back in, or signing in as someone else). */
export function resetSent() { try { localStorage.removeItem(SENT); } catch { /* ignore */ } }

/** The results in `slugs` that are new or better than what was last sent. */
export function pending(slugs: string[], sent: Record<string, string>): Best[] {
  const out: Best[] = [];
  for (const slug of slugs) {
    const kind = boardKind(slug) as Kind | undefined;
    if (!kind) continue;
    const extra = EXTRA[slug] ? readJSON(EXTRA[slug]) : undefined;
    for (const b of bestsOf(slug, readJSON(`${slug}.stats`), extra)) {
      const prev = sent[`${b.game}|${b.variant}`];
      if (prev === undefined || better(kind, BigInt(b.value), BigInt(prev))) out.push(b);
    }
  }
  return out;
}

let running = false;

export async function submitBests(slugs: string[] = boardSlugs()) {
  const session = loadSession();
  if (!session || session.user.leaderboardOptOut || running) return;
  running = true;
  try {
    const sent = loadSent(session.user.id);
    const todo = pending(slugs, sent.v);
    for (let i = 0; i < todo.length; i += 60) {
      const batch = todo.slice(i, i + 60);
      const r = await authed<{ accepted: number; optedOut?: boolean }>('POST', '/leaderboard/submit', { items: batch });
      if (r.optedOut) return;
      for (const b of batch) sent.v[`${b.game}|${b.variant}`] = b.value;
      saveSent(sent);
    }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e; // offline, rate-limited or signed out: try again later
  } finally {
    running = false;
  }
}

let timer = 0;

/** Called on every page for signed-in players. */
export function initLeaderboard() {
  const here = location.pathname.slice(import.meta.env.BASE_URL.length).split('/')[0];
  // After a game ends the stats are written a moment after the progress event.
  addEventListener('games:progress', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void submitBests(boardKind(here) ? [here] : []), 1500);
  });
  addEventListener('games:leaderboard', () => { resetSent(); void submitBests(); });
  setTimeout(() => void submitBests(), 4000); // catch up on anything earned before the account existed
}
