// The Leaderboard button on a game's menu, next to How to play and History & stats. Only signed-in players get it (it's
// loaded from pwa.ts's signed-in branch), and only on games that have a board. Every game page's menu has the same
// buttons, so this works for all of them without touching any game.

import { openBoard } from './board';
import { hasBoard } from './games';

export function initLeaderboardButton(): void {
  const slug = location.pathname.slice(import.meta.env.BASE_URL.length).split('/')[0];
  if (!slug || !hasBoard(slug) || document.querySelector('.lb-btn')) return;
  // After History & stats; a game without one (Qubo) has it after How to play.
  const anchor = document.getElementById('history-btn') ?? document.querySelector<HTMLElement>('a.history-link[href^="/howto/"]');
  if (!anchor) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn history-link lb-btn';
  btn.innerHTML = '<span>Leaderboard</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>';
  btn.addEventListener('click', () => openBoard(slug));
  anchor.after(btn);
}
