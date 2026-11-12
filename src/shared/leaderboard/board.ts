// A game's global leaderboard, in a dialog on the game's own page: its levels, the top 50, the player's own row
// highlighted and their rank. Opened from the menu's Leaderboard button (button.ts). The dialog is built here, so no
// game page carries markup for it; it takes the page's family ink like every other dialog.

import { type Board, ApiError, getBoard } from '../sync/api';
import { formatValue } from './games';

let dialog: HTMLDialogElement | null = null;
let token = 0;
const el = <T extends HTMLElement>(sel: string) => dialog!.querySelector(sel) as T;

function build(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'dialog lb-dialog';
  d.setAttribute('aria-labelledby', 'lb-title');
  d.innerHTML = `<h2 id="lb-title">Leaderboard</h2>
    <div class="lb-variants" role="group" aria-label="Level"></div>
    <p class="lb-status muted" role="status" aria-live="polite"></p>
    <table class="summary lb-table" hidden>
      <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col" class="lb-value-head">Best</th></tr></thead>
      <tbody></tbody>
    </table>
    <p class="lb-me" hidden></p>
    <div class="dialog-actions one"><button type="button" class="btn btn-primary lb-done">Done</button></div>`;
  d.querySelector('.lb-done')!.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  document.body.append(d);
  return d;
}

function setStatus(text: string) {
  const s = el<HTMLElement>('.lb-status');
  s.textContent = text;
  s.hidden = !text;
}

function render(game: string, b: Board) {
  const you = b.entries.find((e) => e.you);
  el<HTMLElement>('.lb-variants').replaceChildren(
    ...(b.variants.length > 1 ? b.variants : []).map((v) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = v;
      btn.setAttribute('aria-pressed', String(v === b.variant));
      btn.addEventListener('click', () => void load(game, v));
      return btn;
    }),
  );
  el<HTMLElement>('.lb-value-head').textContent = b.kind === 'time' ? 'Time' : 'Score';
  el<HTMLElement>('tbody').replaceChildren(
    ...b.entries.map((e) => {
      const tr = document.createElement('tr');
      if (e.you) tr.className = 'you';
      const rank = document.createElement('th');
      rank.scope = 'row';
      rank.textContent = String(e.rank);
      const name = document.createElement('td');
      name.textContent = e.you ? `${e.name} (you)` : e.name;
      const val = document.createElement('td');
      val.textContent = formatValue(b.kind, e.value);
      tr.append(rank, name, val);
      return tr;
    }),
  );
  el<HTMLElement>('.lb-table').hidden = b.entries.length === 0;
  setStatus(b.entries.length ? '' : 'No one is on this board yet. Play a game while signed in to take the first place.');
  const me = el<HTMLElement>('.lb-me');
  me.hidden = !b.me || !!you;
  if (b.me) {
    const best = document.createElement('b');
    best.textContent = formatValue(b.kind, b.me.value);
    me.replaceChildren('Your best: ', best, `, rank ${b.me.rank} of ${b.total}.`);
  }
}

async function load(game: string, variant?: string) {
  const mine = ++token;
  setStatus('Loading…');
  try {
    const b = await getBoard(game, variant);
    if (mine === token) render(game, b);
  } catch (e) {
    if (mine !== token) return;
    el<HTMLElement>('.lb-table').hidden = true;
    el<HTMLElement>('.lb-me').hidden = true;
    setStatus(e instanceof ApiError && e.offline ? "You're offline. Leaderboards need a connection." : "Couldn't load this leaderboard. Please try again.");
  }
}

/** Opens the leaderboard for `game` (a slug) and loads its first level. */
export function openBoard(game: string): void {
  dialog ??= build();
  if (!dialog.open) dialog.showModal();
  void load(game);
}
