// The leaderboards page, /leaderboard/: pick a game (and a level) to see its top players. The board is public, so it
// works signed out; signed-in players also see their own rank. `?game=` links straight to a game.

import '../pwa';
import { loadCatalog } from '../shared/gamestats';
import { formatValue, hasBoard } from '../shared/leaderboard/games';
import { type Board, ApiError, getBoard } from '../shared/sync/api';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const screen = $('screen');
const select = $<HTMLSelectElement>('game-pick');
const families = new Map<string, string>();
let token = 0;

const setStatus = (text: string) => { $('status').textContent = text; $('status').hidden = !text; };

function render(b: Board) {
  const you = b.entries.find((e) => e.you);
  $('variants').replaceChildren(
    ...(b.variants.length > 1 ? b.variants : []).map((v) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = v;
      btn.setAttribute('aria-pressed', String(v === b.variant));
      btn.addEventListener('click', () => void load(b.game, v));
      return btn;
    }),
  );
  $('value-head').textContent = b.kind === 'time' ? 'Time' : 'Score';
  $('rows').replaceChildren(
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
  $('board').hidden = b.entries.length === 0;
  setStatus(b.entries.length ? '' : 'No one is on this board yet. Play a game while signed in to take the first place.');
  const me = $('me');
  me.hidden = !b.me || !!you;
  if (b.me) me.innerHTML = `Your best: <b>${formatValue(b.kind, b.me.value)}</b>, rank ${b.me.rank} of ${b.total}.`;
}

async function load(game: string, variant?: string) {
  const mine = ++token;
  setStatus('Loading…');
  try {
    const b = await getBoard(game, variant);
    if (mine === token) render(b);
  } catch (e) {
    if (mine !== token) return;
    $('board').hidden = true;
    setStatus(e instanceof ApiError && e.offline ? "You're offline. Leaderboards need a connection." : "Couldn't load this leaderboard. Please try again.");
  }
  history.replaceState(null, '', `?game=${game}${variant ? `&level=${encodeURIComponent(variant)}` : ''}`);
}

function pick(game: string) {
  screen.className = `screen lb-page ink-${families.get(game) ?? 'blue'}`;
  void load(game);
}

void (async () => {
  const games = (await loadCatalog().catch(() => [])).filter((g) => hasBoard(g.slug));
  if (!games.length) { setStatus("Couldn't load the game list. Please try again."); return; }
  const byFamily = new Map<string, HTMLOptGroupElement>();
  for (const g of games) {
    families.set(g.slug, g.family);
    let grp = byFamily.get(g.familyLabel);
    if (!grp) { grp = document.createElement('optgroup'); grp.label = g.familyLabel; byFamily.set(g.familyLabel, grp); select.append(grp); }
    grp.append(new Option(g.name, g.slug));
  }
  const want = new URLSearchParams(location.search).get('game') ?? '';
  select.value = games.some((g) => g.slug === want) ? want : games[0].slug;
  select.addEventListener('change', () => pick(select.value));
  screen.className = `screen lb-page ink-${families.get(select.value) ?? 'blue'}`;
  const level = new URLSearchParams(location.search).get('level') ?? undefined;
  void load(select.value, level);
})();
