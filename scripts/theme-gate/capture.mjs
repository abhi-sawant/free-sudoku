// Captures the same screens in each theme at phone width and checks the contrast rules from DESIGN.md.
// Needs the dev server (`npm run dev`) and Chromium: set PLAYWRIGHT_CHROMIUM to a chrome binary, or let
// playwright-core use its own.
// Usage: node scripts/theme-gate/capture.mjs --base http://localhost:5173 --out <dir> [--themes a,b,c] [--scheme light|dark]
// Run it in both schemes: a dark-only theme has to stand apart from the others' dark forms, not just their light ones.

import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://localhost:5173');
const out = arg('out');
const scheme = arg('scheme', 'light');
const axes = JSON.parse(readFileSync(new URL('./axes.json', import.meta.url), 'utf8'));
const themes = (arg('themes') ?? Object.keys(axes).join(',')).split(',');
if (!out) { console.error('--out <dir> is required'); process.exit(2); }

export const SCREENS = ['home', 'sudoku', 'chess', 'klondike', '2248', 'rules'];
const FAMILY_ACCENTS = ['blue', 'orange', 'lilac', 'sky', 'olive', 'berry', 'plum', 'cocoa'];
const known = existsSync(new URL('./contrast-known.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('./contrast-known.json', import.meta.url), 'utf8')) : {};

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ['--no-sandbox'],
});

async function startGame(page) {
  for (const sel of ['#levels button', '.levels button', '#modes button', '.modes button', '#home button.level', '#home .new-game', '#home .btn-primary:not([hidden])']) {
    const l = page.locator(sel).first();
    if (await l.count() && await l.isVisible()) { await l.click(); break; }
  }
  await page.waitForTimeout(700);
}

const luminance = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

let failed = false;
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1, isMobile: true, colorScheme: scheme });
  await ctx.addInitScript((t) => localStorage.setItem('games.theme', t), theme);
  mkdirSync(`${out}/${theme}`, { recursive: true });
  const page = await ctx.newPage();
  const shot = (name) => page.screenshot({ path: `${out}/${theme}/${name}.png` });

  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await shot('home');

  // Contrast: each family accent on --paper, and --on-ink on each accent.
  const colours = await page.evaluate((names) => {
    const probe = document.createElement('i'); document.body.append(probe);
    const rgb = (v) => { probe.style.color = v; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number); };
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => rgb(`var(--${n})`);
    const res = { paper: v('paper'), onInk: v('on-ink'), accents: Object.fromEntries(names.map((n) => [n, v(n)])) };
    probe.remove(); return res;
  }, FAMILY_ACCENTS);
  const issues = [];
  for (const [n, c] of Object.entries(colours.accents)) {
    const onPaper = ratio(c, colours.paper), withInk = ratio(colours.onInk, c);
    if (onPaper < 4.5) issues.push({ key: `${n} on paper`, ratio: onPaper });
    if (withInk < 4.5) issues.push({ key: `on-ink on ${n}`, ratio: withInk });
  }
  const fresh = issues.filter((i) => !(known[theme] ?? []).includes(i.key));
  const text = (list) => list.map((i) => `${i.key} ${i.ratio.toFixed(2)}`).join('; ');
  console.log(`${theme}: contrast ${issues.length ? (fresh.length ? `FAIL ${text(fresh)}` : `known gaps (${text(issues)})`) : 'ok'}`);
  if (fresh.length) failed = true;

  for (const [name, path] of [['sudoku', 'sudoku'], ['chess', 'chess'], ['klondike', 'klondike'], ['2248', '2248']]) {
    await page.goto(`${base}/${path}/index.html`, { waitUntil: 'networkidle' });
    await startGame(page);
    await shot(name);
    if (name === 'sudoku') {
      await page.locator('.help-btn').click(); await page.waitForTimeout(600);
      await shot('rules');
    }
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
