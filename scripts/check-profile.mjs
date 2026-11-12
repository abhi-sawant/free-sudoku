// Browser check for the profile page (/profile/), the trimmed stats page and the badges page.
// Needs the dev server (`npm run dev`) and Chromium: set PLAYWRIGHT_CHROMIUM to a chrome binary, or let playwright-core
// use its own. The API is stubbed, so nothing reaches the real server.
// Usage: node scripts/check-profile.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://localhost:5173');
const user = { id: 1, email: 'tester@example.com', displayName: 'Tester', leaderboardOptOut: false };
const session = JSON.stringify({ accessToken: 'a'.repeat(40), refreshToken: 'r'.repeat(40), accessExpiresAt: Date.now() + 3600e3, user });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };

/** A fake sync server, shared by the pages of one device. */
function fakeApi() {
  const items = new Map();
  let rev = 0;
  return {
    items,
    put(key, value) { rev++; items.set(key, { value, rev, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }); },
    async route(route) {
      const req = route.request();
      const url = new URL(req.url());
      const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      const path = url.pathname.replace(/^\/api/, '');
      if (path === '/sync' && req.method() === 'GET') {
        const since = Number(url.searchParams.get('since')) || 0;
        return json({ rev, more: false, items: [...items].filter(([, v]) => v.rev > since).sort((a, b) => a[1].rev - b[1].rev)
          .map(([key, v]) => ({ key, value: v.value, rev: v.rev, deviceId: 'x', updatedAt: v.updatedAt })) });
      }
      if (path === '/sync' && req.method() === 'PUT') {
        const results = JSON.parse(req.postData()).items.map((it) => {
          const cur = items.get(it.key);
          if (cur && cur.rev !== it.baseRev) return { key: it.key, status: 'conflict', rev: cur.rev, value: cur.value };
          this.put(it.key, it.value);
          return { key: it.key, status: 'ok', rev };
        });
        return json({ results, rev });
      }
      if (path === '/account') return json({ user });
      if (path === '/account/sessions') return json({ sessions: [{ id: 1, device: 'Chrome on Linux', current: true, lastSeenAt: '2026-11-12 10:00:00' }] });
      return json({ ok: true });
    },
  };
}

async function device({ signedIn = false, width = 420, seed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const api = fakeApi();
  await ctx.route('**/api/**', (r) => api.route(r));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/');
  await page.evaluate(([s, signedIn, seed]) => {
    if (signedIn) localStorage.setItem('sync.session', s);
    if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, [session, signedIn, seed]);
  return { ctx, page, api, errors };
}
const go = async (page, path) => { await page.goto(base + path); await page.waitForTimeout(1500); };
const text = (page, sel) => page.locator(sel).innerText();

/** 40 finished sudoku games over the last 40 days, at 11pm. */
function sudokuSeed() {
  const now = new Date(); now.setHours(23, 0, 0, 0);
  const history = [...Array(40)].map((_, i) => ({ level: 'easy', puzzle: i, startedAt: now.getTime() - i * 864e5 - 6e5, endedAt: now.getTime() - i * 864e5, elapsed: 6e5, solved: true, result: 'won' }));
  return { 'sudoku.history': JSON.stringify(history), 'sudoku.stats': JSON.stringify({ easy: { played: 40, won: 40, bestTime: 300000 } }) };
}

try {
  // ---- Task 5: overview
  let d = await device();
  await go(d.page, '/profile/index.html');
  check((await text(d.page, '#tile-games')) === '0', 'fresh device: 0 games in the banner');
  check(await d.page.locator('#overview-empty').isVisible(), 'fresh device: the empty-state line shows');
  check((await text(d.page, '#overview-empty')).includes('Play a few games and your stats appear here'), 'empty-state copy');
  check(!/NaN|Infinity|undefined/.test(await d.page.locator('body').innerText()), 'no NaN, Infinity or undefined on the page');
  check(!d.errors.length, `no page errors ${d.errors.join(' | ')}`);
  await d.ctx.close();

  d = await device({ seed: sudokuSeed() });
  await go(d.page, '/profile/index.html');
  check((await d.page.locator('#calendar i[data-l="3"], #calendar i[data-l="2"], #calendar i[data-l="1"]').count()) > 0, 'seeded: the calendar has active days');
  check((await text(d.page, '#top')).includes('Sudoku'), 'seeded: Sudoku is a top game');
  check((await text(d.page, '#tile-games')) === '40', 'seeded: 40 games in the banner');
  await go(d.page, '/stats/index.html');
  check(!(await d.page.locator('#calendar, #hours, #top, #highlights').count()), 'stats page: no overview any more');
  check((await d.page.locator('#games .game-card').count()) > 40, 'stats page: still lists every game');
  await go(d.page, '/badges/index.html');
  check(!(await d.page.getByRole('heading', { name: 'Secrets' }).count()), 'badges page: no Secrets group');
  check((await d.page.locator('body').innerText()).includes('Open your full stats'), 'badges page: Snoop says "Open your full stats"');
  await d.ctx.close();

  d = await device({ seed: sudokuSeed(), width: 1280 });
  await go(d.page, '/profile/index.html');
  const tops = await d.page.locator('#overview > .panel:not([hidden])').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  check(new Set(tops).size < tops.length, 'desktop: the overview has two columns');
  await d.ctx.close();
  d = await device({ seed: sudokuSeed(), width: 360 });
  await go(d.page, '/profile/index.html');
  const lefts = await d.page.locator('#overview > .panel:not([hidden])').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  check(new Set(lefts).size === 1, 'phone: one column');
  check(await d.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
  await d.ctx.close();

  // ---- Review focus 3: the games list can't be fetched
  d = await device();
  await d.page.route('**/index.html', (r) => (r.request().resourceType() === 'fetch' ? r.abort() : r.continue()));
  await go(d.page, '/profile/index.html');
  check((await text(d.page, '#overview-error')).includes('Stats need the games list'), 'offline catalog: the error line shows');
  check(await d.page.locator('#settings').isVisible(), 'offline catalog: settings still there');
  await d.ctx.close();
} finally {
  await browser.close();
}
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
