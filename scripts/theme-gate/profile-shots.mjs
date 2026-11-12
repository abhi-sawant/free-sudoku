// Screenshots of the profile page (signed in, with saves), its title picker, and a game menu's Leaderboard button and
// dialog, in every theme, for checking that each theme styles them like its own home and game screens. Kept apart from
// capture.mjs so its distance baselines don't move. Needs the dev server and Chromium (PLAYWRIGHT_CHROMIUM).
// Usage: node scripts/theme-gate/profile-shots.mjs --out <dir> [--themes a,b] [--width 420] [--scheme light|dark]

import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://localhost:5173');
const out = arg('out');
const width = Number(arg('width', '420'));
const scheme = arg('scheme', 'light');
const axes = JSON.parse(readFileSync(new URL('./axes.json', import.meta.url), 'utf8'));
const themes = (arg('themes') ?? Object.keys(axes).join(',')).split(',');
if (!out) { console.error('--out <dir> is required'); process.exit(2); }
mkdirSync(out, { recursive: true });

const user = { id: 1, email: 'tester@example.com', displayName: 'Tester' };
const session = JSON.stringify({ accessToken: 'a'.repeat(40), refreshToken: 'r'.repeat(40), accessExpiresAt: Date.now() + 3600e3, user });
const now = new Date(); now.setHours(22, 30, 0, 0);
const history = [...Array(60)].map((_, i) => ({ level: 'easy', puzzle: i, endedAt: now.getTime() - i * 864e5 * 1.3, elapsed: 4e5, result: 'won' }));
const board = { game: 'sudoku', kind: 'time', variant: 'easy', variants: ['easy', 'medium', 'hard', 'expert'], total: 3, me: { rank: 2, value: '75000' },
  entries: [{ rank: 1, name: 'Ann', value: '61000', you: false }, { rank: 2, name: 'Tester', value: '75000', you: true }, { rank: 3, name: 'Bo', value: '90000', you: false }] };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
  await ctx.route('**/api/**', (r) => {
    const p = new URL(r.request().url()).pathname;
    const body = p.includes('/leaderboard/') ? board : p.endsWith('/sync') ? { rev: 0, items: [], more: false, results: [] }
      : p.endsWith('/sessions') ? { sessions: [{ id: 1, device: 'Chrome on Linux', current: true, lastSeenAt: '2026-11-12 10:00:00' }] } : { user };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await ctx.newPage();
  await page.goto(base + '/');
  await page.evaluate(([t, s, h]) => {
    localStorage.setItem('games.theme', t);
    localStorage.setItem('sync.session', s);
    localStorage.setItem('sudoku.history', JSON.stringify(h));
    localStorage.setItem('chess.stats', JSON.stringify({ hard: { played: 14, won: 9, drawn: 1, lost: 4 } }));
  }, [theme, session, history]);
  await page.goto(base + '/profile/index.html');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${theme}-profile.png`, fullPage: true });
  await page.click('#profile-title');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${theme}-title.png` });
  await page.goto(base + '/sudoku/index.html');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${theme}-menu.png` });
  await page.locator('.lb-btn').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${theme}-board.png` });
  await ctx.close();
  console.log(`captured ${theme}`);
}
await browser.close();
