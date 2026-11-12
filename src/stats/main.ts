// The stats page, /stats/: every game's numbers from this device, as the home page's cards; tap one for its details.
// The overview across games (calendar, time of day, top games, highlights) is on the profile. Opening this page is
// remembered as `stats.found`, for the badge that rewards it.

import '../pwa';
import { formatExp, formatScore } from '../shared/tilescore';
import { type GameInfo, type GameStats, collectGame, loadCatalog } from '../shared/gamestats';
import { clock, duration, esc, nf, pct } from '../profile/overview';

try { if (!localStorage.getItem('stats.found')) localStorage.setItem('stats.found', String(Date.now())); } catch { /* storage unavailable */ }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });


const label = (s: string) => esc(s.charAt(0).toUpperCase() + s.slice(1).replace(/([a-z])(\d)/g, '$1 $2'));

/** The one number that sums a game up best: its best time, win rate, score, tile or run. */
function headline(g: GameStats): string {
  if (g.bestTime !== undefined) return `Best ${clock(g.bestTime)}`;
  if (g.versus && g.played) return `${pct.format(g.won / g.played)} wins`;
  if (g.bestScore) return `Best ${formatScore(g.bestScore)}`;
  if (g.bestTile) return `Best tile ${nf.format(g.bestTile)}`;
  if (g.bestRun) return `Best ${nf.format(g.bestRun)}`;
  if (g.bestStreak) return `Best streak ${g.bestStreak}`;
  if (g.won && g.played) return `${pct.format(g.won / g.played)} won`;
  return '';
}

// ---------- Page ----------

let all: GameStats[] = [];

async function main() {
  let catalog: GameInfo[];
  try {
    catalog = await loadCatalog();
  } catch {
    $('status').textContent = 'Stats need the games list, which could not be loaded. Try again online.';
    $('status').hidden = false;
    return;
  }
  all = catalog.map(collectGame);
  renderGames();
}

function renderGames() {
  const nav = $('games');
  const families: [string, string, GameStats[]][] = [];
  for (const g of all) {
    let f = families.find(([ink]) => ink === g.info.family);
    if (!f) families.push((f = [g.info.family, g.info.familyLabel, []]));
    f[2].push(g);
  }
  nav.innerHTML = families.map(([ink, title, games]) => `<section class="family ink-${ink}" data-family="${ink}">
      <h2 class="section-label">${esc(title)}</h2>
      ${games.map((g) => {
        const line1 = g.played ? `${nf.format(g.played)} played${g.timeMs >= 60_000 ? ` · ${duration(g.timeMs)}` : ''}` : 'Never played';
        const line2 = g.played ? headline(g) : '';
        return `<button type="button" class="game-card ink-${ink} grain${g.played ? '' : ' never'}" data-slug="${g.info.slug}">
          ${g.info.icon}
          <span class="game-text">
            <span class="game-name">${esc(g.info.name)}</span>
            <span class="stat-line">${line1}</span>
            ${line2 ? `<span class="stat-line">${line2}</span>` : ''}
          </span>
        </button>`;
      }).join('')}
    </section>`).join('');
  nav.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.game-card');
    const g = card && all.find((x) => x.info.slug === card.dataset.slug);
    if (g) showGame(g);
  });
}

// ---------- One game ----------

const dialog = $<HTMLDialogElement>('game-dialog');
$('game-dialog-close').addEventListener('click', () => dialog.close());

function showGame(g: GameStats) {
  $('game-dialog-title').textContent = g.info.name;
  const rows: [string, string][] = [];
  rows.push(['Played', nf.format(g.played)]);
  if (g.versus) rows.push(['Won · drawn · lost', `${nf.format(g.won)} · ${nf.format(g.drawn)} · ${nf.format(g.lost)}`]);
  else if (g.won) rows.push(['Won', `${nf.format(g.won)}${g.played ? ` (${pct.format(g.won / g.played)})` : ''}`]);
  if (g.bestTime !== undefined) rows.push(['Best time', clock(g.bestTime)]);
  if (g.bestScore) rows.push(['Best score', formatScore(g.bestScore)]);
  if (g.bestTileExp) rows.push(['Best tile', formatExp(g.bestTileExp)]);
  if (g.bestTile) rows.push(['Best tile', nf.format(g.bestTile)]);
  if (g.bestRun) rows.push(['Best', nf.format(g.bestRun)]);
  if (g.bestStreak) rows.push(['Best streak', nf.format(g.bestStreak)]);
  if (g.timeMs) rows.push(['Time played', duration(g.timeMs)]);
  const timed = g.history.filter((e) => typeof e.activeMs === 'number' && e.activeMs > 0);
  if (timed.length) rows.push(['Average game', duration(timed.reduce((s, e) => s + (e.activeMs ?? 0), 0) / timed.length)]);
  else {
    const el = g.history.filter((e) => typeof e.elapsed === 'number' && e.elapsed > 0);
    if (el.length) rows.push(['Average game', duration(el.reduce((s, e) => s + (e.elapsed ?? 0), 0) / el.length)]);
  }
  if (g.opens) rows.push(['Times opened', nf.format(g.opens)]);
  if (g.first) rows.push(['First played', dateFmt.format(g.first)]);
  if (g.last) rows.push(['Last played', dateFmt.format(g.last)]);

  let html = `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

  const levels = g.levels.filter((l) => l.played);
  if (levels.length > 1 || (levels.length === 1 && levels[0].name !== 'default')) {
    const cols = g.versus ? ['Played', 'Won', 'Drawn', 'Lost'] : levels.some((l) => l.bestTime != null) ? ['Played', 'Won', 'Best'] : ['Played', 'Best'];
    html += `<h3>By level</h3><table class="summary"><thead><tr><th scope="col">Level</th>${cols.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${
      levels.map((l) => `<tr><th scope="row">${label(l.name)}</th>${
        g.versus ? `<td>${l.played}</td><td>${l.won ?? 0}</td><td>${l.drawn ?? 0}</td><td>${l.lost ?? 0}</td>`
        : cols.length === 3 ? `<td>${l.played}</td><td>${l.won ?? 0}</td><td>${l.bestTime != null ? clock(l.bestTime) : '–'}</td>`
        : `<td>${l.played}</td><td>${l.best ? nf.format(l.best) : '–'}</td>`
      }</tr>`).join('')}</tbody></table>`;
  }

  const a = g.archive;
  if (a.count) {
    const older: [string, string][] = [['Games', nf.format(a.count)]];
    const avg = (k: string) => (a.num[k]?.n ? a.num[k].sum / a.num[k].n : null);
    const t = avg('activeMs') ?? avg('elapsed');
    if (t) older.push(['Average game', duration(t)]);
    const sc = avg('score');
    if (sc != null) older.push(['Average score', nf.format(Math.round(sc))]);
    else if (a.big.score?.n) older.push(['Average score', formatScore(BigInt(a.big.score.sum) / BigInt(a.big.score.n))]);
    const mv = avg('moves');
    if (mv != null) older.push(['Average moves', nf.format(Math.round(mv))]);
    const res = a.tally.result;
    if (res?.won) older.push(['Won', nf.format(res.won)]);
    if (a.num.endedAt) older.push(['From', `${dateFmt.format(a.num.endedAt.min)} to ${dateFmt.format(a.num.endedAt.max)}`]);
    html += `<h3>Older games</h3><dl>${older.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p class="note">Only the last ${nf.format(g.history.length)} games are kept in full; these are the averages of the ones before.</p>`;
  }
  if (!g.played) html = `<p class="note">You haven't played ${esc(g.info.name)} yet.</p>`;
  $('game-dialog-body').innerHTML = html;
  dialog.showModal();
  $('game-dialog-body').scrollTop = 0;
}

void main();
