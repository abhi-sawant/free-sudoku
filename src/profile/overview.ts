// The profile's overview of every game: the activity calendar, time of day, top games and highlights. Moved from the
// stats page, which now keeps only the per-game list; the formatting helpers are shared with it.

import { type GameStats, byHour, dayKey, startOfDay } from '../shared/gamestats';

export const nf = new Intl.NumberFormat();
export const pct = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 14h 5m, 25m, 40s. */
export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${nf.format(h)}h ${m % 60}m`;
}

/** A best time as a clock: 3:12, or 1:04:09. */
export function clock(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** A column per week (starting Sunday), a row per weekday; the last column is this week. */
export function renderCalendar(el: HTMLElement, perDay: Map<string, number>, weeks: number): void {
  const today = startOfDay(Date.now());
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
  const counts: number[] = [];
  const cells: { t: number; n: number }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const n = perDay.get(dayKey(d.getTime())) ?? 0;
    cells.push({ t: d.getTime(), n });
    if (n) counts.push(n);
  }
  const max = Math.max(1, ...counts);
  const level = (n: number) => (!n ? 0 : n <= max * 0.25 ? 1 : n <= max * 0.6 ? 2 : 3);
  const days = cells.filter((c) => c.t <= today && c.n).length;
  el.setAttribute('aria-label', `Games played on ${days} of the last ${weeks * 7} days`);
  el.innerHTML = cells.map(({ t, n }) => {
    const cls = t > today ? 'future' : t === today ? 'today' : '';
    return `<i data-l="${level(n)}" class="${cls}" title="${dayFmt.format(t)}: ${n} game${n === 1 ? '' : 's'}"></i>`;
  }).join('');
}

export function renderHours(el: HTMLElement, all: GameStats[]): void {
  const h = byHour(all);
  const max = Math.max(1, ...h);
  const peak = h.indexOf(Math.max(...h));
  el.setAttribute('aria-label', `Most games end around ${new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2000, 0, 1, peak))}`);
  el.innerHTML = h.map((n, i) =>
    `<i class="${n ? '' : 'none'}" style="height:${Math.max(3, (n / max) * 100)}%" title="${i}:00, ${n} game${n === 1 ? '' : 's'}"></i>`).join('');
}

export function renderTop(el: HTMLElement, all: GameStats[]): void {
  const top = all.filter((g) => g.played).sort((a, b) => b.played - a.played).slice(0, 5);
  const max = Math.max(1, top[0]?.played ?? 1);
  el.innerHTML = top.map((g) => `<div class="top-row ink-${g.info.family}">
      <span class="name">${esc(g.info.name)}</span>
      <span class="bar" style="width:${Math.max(4, (g.played / max) * 100)}%"></span>
      <span class="count">${nf.format(g.played)}</span>
    </div>`).join('');
}

export function renderHighlights(el: HTMLElement, all: GameStats[], longest: number): void {
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
  el.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
