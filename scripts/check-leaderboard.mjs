// Browser check for the per-game Leaderboard button (src/shared/leaderboard/button.ts) and its dialog (board.ts).
// Needs the dev server (`npm run dev`) and Chromium: set PLAYWRIGHT_CHROMIUM to a chrome binary, or let playwright-core
// use its own. The API is stubbed per case, so nothing reaches the real server.
// Usage: node scripts/check-leaderboard.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://localhost:5173');
const session = JSON.stringify({ accessToken: 'a'.repeat(40), refreshToken: 'r'.repeat(40), accessExpiresAt: Date.now() + 3600e3,
  user: { id: 1, email: 't@example.com', displayName: 'Tester' } });
const BOARD = { game: 'sudoku', kind: 'time', variant: 'easy', variants: ['easy', 'medium', 'hard'], total: 3,
  entries: [{ rank: 1, name: 'Ann', value: '61000', at: '', you: false }, { rank: 2, name: 'Tester', value: '75000', at: '', you: true },
    { rank: 3, name: 'Bo', value: '90000', at: '', you: false }], me: { rank: 2, value: '75000' } };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };

async function open(path, { signedIn = true, board = () => ({ status: 200, body: BOARD }) } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  await ctx.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/leaderboard/') && route.request().method() === 'GET') {
      const r = board(url);
      return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
    }
    if (url.pathname.endsWith('/sync') && route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"rev":0,"items":[],"more":false}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[],"rev":0,"accepted":0}' });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/');
  if (signedIn) await page.evaluate((s) => localStorage.setItem('sync.session', s), session);
  await page.goto(base + path);
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}
const nextId = (page, sel) => page.locator(sel).evaluate((el) => el.previousElementSibling?.id || el.previousElementSibling?.getAttribute('href') || '');

try {
  let t = await open('/sudoku/index.html', { signedIn: false });
  check(!(await t.page.locator('.lb-btn').count()), 'signed out: no Leaderboard button');
  await t.ctx.close();

  t = await open('/sudoku/index.html');
  check(await t.page.locator('.lb-btn').isVisible(), 'signed in: Sudoku has a Leaderboard button');
  check((await nextId(t.page, '.lb-btn')) === 'history-btn', 'it sits right after History & stats');
  await t.page.locator('.lb-btn').click();
  await t.page.waitForTimeout(500);
  const dialog = t.page.locator('dialog.lb-dialog');
  check(await dialog.evaluate((d) => d.open), 'click opens the board dialog');
  check((await dialog.locator('tbody tr').count()) === 3, 'the board shows the 3 rows');
  check(await dialog.locator('tbody tr.you').count() === 1, 'your row is marked');
  check((await dialog.locator('.lb-variants .btn').count()) === 3, 'level buttons for each variant');
  check(!t.errors.length, `no page errors ${t.errors.join(' | ')}`);
  await t.ctx.close();

  t = await open('/qubo/index.html');
  check(await t.page.locator('.lb-btn').isVisible(), 'Qubo has a Leaderboard button');
  check(/howto/.test(await nextId(t.page, '.lb-btn')), 'Qubo: after the How to play link');
  await t.ctx.close();

  t = await open('/chess/index.html');
  check(!(await t.page.locator('.lb-btn').count()), 'Chess (no board): no button');
  await t.ctx.close();

  t = await open('/sudoku/index.html', { board: () => ({ status: 500, body: { error: { code: 'x', message: 'boom' } } }) });
  await t.page.locator('.lb-btn').click(); await t.page.waitForTimeout(500);
  check(await t.page.locator('.lb-dialog .lb-status').isVisible() && !(await t.page.locator('.lb-dialog .lb-table').isVisible()), 'server error: a status line, no table');
  await t.ctx.close();

  t = await open('/sudoku/index.html', { board: () => ({ status: 200, body: { ...BOARD, entries: [], total: 0, me: null } }) });
  await t.page.locator('.lb-btn').click(); await t.page.waitForTimeout(500);
  check((await t.page.locator('.lb-dialog .lb-status').innerText()).includes('No one is on this board yet'), 'empty board: the "No one is on this board yet" line');
  await t.ctx.close();

  t = await open('/sudoku/index.html', { board: () => ({ status: 200, body: { ...BOARD, entries: BOARD.entries.map((e) => ({ ...e, you: false })), me: null } }) });
  await t.page.locator('.lb-btn').click(); await t.page.waitForTimeout(500);
  check((await t.page.locator('.lb-dialog tbody tr').count()) === 3 && !(await t.page.locator('.lb-dialog .lb-me').isVisible()) && !t.errors.length,
    'opted out: the board shows, with no rank line and no errors');
  await t.ctx.close();
} finally {
  await browser.close();
}
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
