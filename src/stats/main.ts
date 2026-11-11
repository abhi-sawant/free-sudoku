// The hidden stats page, /stats/: every game's numbers from this device in one place. Nothing links here. Opening it
// is remembered as `stats.found`, for the achievement that rewards finding it.

import '../pwa';
import { formatExp, formatScore } from '../shared/tilescore';
import { type GameInfo, type GameStats, byHour, collectGame, dayKey, gamesPerDay, loadCatalog, startOfDay, streaks } from '../shared/gamestats';

try { if (!localStorage.getItem('stats.found')) localStorage.setItem('stats.found', String(Date.now())); } catch { /* storage unavailable */ }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nf = new Intl.NumberFormat();
const pct = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 14h 5m, 25m, 40s. */
function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${nf.format(h)}h ${m % 60}m`;
}

/** A best time as a clock: 3:12, or 1:04:09. */
function clock(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

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
    $('totals').textContent = 'Stats need the games list, which could not be loaded. Try again online.';
    return;
  }
  all = catalog.map(collectGame);
  const played = all.reduce((s, g) => s + g.played, 0);
  const time = all.reduce((s, g) => s + g.timeMs, 0);
  const tried = all.filter((g) => g.played > 0).length;
  const perDay = gamesPerDay(all);
  const { current, longest } = streaks(perDay);

  if (!played) {
    $('totals').textContent = '';
    $('empty').hidden = false;
  } else {
    $('totals').innerHTML = [
      `<b>${nf.format(played)}</b> game${played === 1 ? '' : 's'}`,
      time ? `<b>${duration(time)}</b> played` : '',
      `<b>${tried}</b> of ${all.length} tried`,
      current ? `<b>${current}</b>-day streak` : '',
    ].filter(Boolean).join(' · ');
    $('activity').hidden = false;
    renderCalendar(perDay);
    renderHours();
    renderTop();
    renderHighlights(longest);
  }
  renderGames();
}

function renderCalendar(perDay: Map<string, number>) {
  const WEEKS = 17;
  const today = startOfDay(Date.now());
  // Columns are weeks starting on Sunday; the last column is this week.
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7);
  const counts: number[] = [];
  const cells: { t: number; n: number }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const n = perDay.get(dayKey(d.getTime())) ?? 0;
    cells.push({ t: d.getTime(), n });
    if (n) counts.push(n);
  }
  const max = Math.max(1, ...counts);
  const level = (n: number) => (!n ? 0 : n <= max * 0.25 ? 1 : n <= max * 0.6 ? 2 : 3);
  const days = cells.filter((c) => c.t <= today && c.n).length;
  $('calendar').setAttribute('aria-label', `Games played on ${days} of the last ${WEEKS * 7} days`);
  $('calendar').innerHTML = cells.map(({ t, n }) => {
    const cls = t > today ? 'future' : t === today ? 'today' : '';
    return `<i data-l="${level(n)}" class="${cls}" title="${dayFmt.format(t)}: ${n} game${n === 1 ? '' : 's'}"></i>`;
  }).join('');
}

function renderHours() {
  const h = byHour(all);
  const max = Math.max(1, ...h);
  const peak = h.indexOf(Math.max(...h));
  $('hours').setAttribute('aria-label', `Most games end around ${new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2000, 0, 1, peak))}`);
  $('hours').innerHTML = h.map((n, i) =>
    `<i class="${n ? '' : 'none'}" style="height:${Math.max(3, (n / max) * 100)}%" title="${i}:00, ${n} game${n === 1 ? '' : 's'}"></i>`).join('');
}

function renderTop() {
  const top = all.filter((g) => g.played).sort((a, b) => b.played - a.played).slice(0, 5);
  const max = Math.max(1, top[0]?.played ?? 1);
  $('top').innerHTML = top.map((g) => `<div class="top-row ink-${g.info.family}">
      <span class="name">${esc(g.info.name)}</span>
      <span class="bar" style="width:${Math.max(4, (g.played / max) * 100)}%"></span>
      <span class="count">${nf.format(g.played)}</span>
    </div>`).join('');
}

function renderHighlights(longest: number) {
  const rows: [string, string][] = [];
  const by = <K extends keyof GameStats>(k: K) => all.filter((g) => (g[k] as number) > 0).sort((a, b) => (b[k] as number) - (a[k] as number))[0];
  const mostTime = by('timeMs');
  if (mostTime) rows.push(['Most time', `${esc(mostTime.info.name)} · ${duration(mostTime.timeMs)}`]);
  const versus = all.filter((g) => g.versus && g.played >= 10).sort((a, b) => b.won / b.played - a.won / a.played)[0];
  if (versus) rows.push(['Best win rate', `${esc(versus.info.name)} · ${pct.format(versus.won / versus.played)}`]);
  const wins = all.reduce((s, g) => s + g.won, 0);
  if (wins) rows.push(['Games won', nf.format(wins)]);
  if (longest > 1) rows.push(['Longest streak', `${longest} days`]);
  const families = new Map<string, number>();
  for (const g of all) families.set(g.info.familyLabel, (families.get(g.info.familyLabel) ?? 0) + g.played);
  const fav = [...families].sort((a, b) => b[1] - a[1])[0];
  if (fav?.[1]) rows.push(['Favourite kind', esc(fav[0])]);
  const opened = by('opens');
  if (opened) rows.push(['Opened most', `${esc(opened.info.name)} · ${nf.format(opened.opens)}×`]);
  const firsts = all.map((g) => g.first).filter((d): d is number => !!d);
  if (firsts.length) rows.push(['Playing since', monthFmt.format(Math.min(...firsts))]);
  $('highlights').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
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
