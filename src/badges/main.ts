// The badges page, /badges/: every badge, earned ones first in each group with the date, locked ones with how to earn
// them (secret ones as "???"). Linked from the profile; opening it earns the Badge hunter badge.

import '../pwa';
import { type Badge, allBadges, catalog, checkBadges, loadEarned } from '../shared/badges';
import { medal } from '../shared/celebrate';

try { if (!localStorage.getItem('badges.found')) localStorage.setItem('badges.found', String(Date.now())); } catch { /* storage unavailable */ }

const $ = (id: string) => document.getElementById(id)!;
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** The page's groups, by the badge ids they start with. */
const GROUPS: [title: string, test: (b: Badge) => boolean][] = [
  ['Getting going', (b) => b.id === 'first-game' || b.id.startsWith('games-') || b.id.startsWith('found-')],
  ['Variety', (b) => b.id.startsWith('tried-') || b.id.startsWith('family-')],
  ['Time and habits', (b) => b.id.startsWith('time-') || b.id.startsWith('streak-') || ['marathon', 'night-owl', 'early-bird'].includes(b.id)],
  ['Skill', (b) => !b.secret],
  ['Secrets', (b) => !!b.secret],
];

function row(b: Badge, at: number | undefined): HTMLElement {
  const li = document.createElement('li');
  li.className = `badge-row${at ? '' : ' locked'}`;
  li.append(medal(b, !at));
  const text = document.createElement('div');
  text.className = 'text';
  const name = document.createElement('b');
  name.textContent = !at && b.secret ? '???' : b.name;
  const desc = document.createElement('span');
  desc.className = 'desc';
  desc.textContent = !at && b.secret ? 'A secret. Keep exploring.' : b.desc;
  text.append(name, desc);
  li.append(text);
  if (at) {
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = dateFmt.format(at);
    li.append(when);
  }
  return li;
}

async function main() {
  // Opening this page can itself earn a badge, so check before drawing.
  await checkBadges().catch(() => []);
  let badges: Badge[];
  try {
    badges = allBadges(await catalog());
  } catch {
    $('count').textContent = 'Badges need the games list, which could not be loaded. Try again online.';
    return;
  }
  const earned = loadEarned();
  const got = badges.filter((b) => earned[b.id]).length;
  $('count').innerHTML = `<b>${got}</b> of ${badges.length} earned`;
  requestAnimationFrame(() => { ($('progress').firstElementChild as HTMLElement).style.width = `${(got / badges.length) * 100}%`; });

  const left = new Set(badges);
  const groups = $('groups');
  for (const [title, test] of GROUPS) {
    const mine = badges.filter((b) => left.has(b) && test(b));
    if (!mine.length) continue;
    for (const b of mine) left.delete(b);
    // Earned first, newest first; then the rest in their usual order.
    mine.sort((a, b) => (earned[b.id] ?? 0) - (earned[a.id] ?? 0));
    const h = document.createElement('h2');
    h.className = 'section-label';
    h.textContent = title;
    const list = document.createElement('ul');
    list.className = 'badge-list';
    list.append(...mine.map((b) => row(b, earned[b.id])));
    groups.append(h, list);
  }
}

void main();
