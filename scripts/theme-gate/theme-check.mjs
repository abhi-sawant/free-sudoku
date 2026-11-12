// Per-theme checks that don't depend on the theme's look (see the plan's Review Focus):
//  1. With the OS in LIGHT mode and every module script blocked, <html data-theme> is already the theme (first paint),
//     and --paper is the expected colour (so a dark-only theme keeps its dark tokens in light mode).
//  2. After a normal load, the browser's theme-color follows --paper.
//  3. The picker lists the theme and draws its swatch in the theme's own paper.
// Usage: node scripts/theme-gate/theme-check.mjs <id> --paper <#hex> [--paper-dark <#hex>] [--base <url>]
//   --paper is the colour in light mode; --paper-dark (default: the same) is the colour in dark mode.

import { chromium } from 'playwright-core';

const id = process.argv[2];
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('base', 'http://localhost:5173');
const paperLight = arg('paper');
const paperDark = arg('paper-dark', paperLight);
if (!id || !paperLight) { console.error('usage: theme-check.mjs <id> --paper <#hex> [--paper-dark <#hex>]'); process.exit(2); }

const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` (${detail})`}`); };

for (const [scheme, expected] of [['light', paperLight], ['dark', paperDark]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, colorScheme: scheme });
  await ctx.addInitScript((t) => localStorage.setItem('games.theme', t), id);
  const blocked = await ctx.newPage();
  await blocked.route(/\.(ts|js)(\?.*)?$/, (r) => (r.request().resourceType() === 'script' ? r.abort() : r.continue()));
  await blocked.goto(`${base}/sudoku/index.html`, { waitUntil: 'domcontentloaded' });
  const early = await blocked.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    paper: (() => { const p = document.createElement('i'); p.style.color = 'var(--paper)'; document.body.append(p); return getComputedStyle(p).color; })(),
  }));
  check(`${scheme}: data-theme is ${id} before any script runs`, early.theme === id, early.theme);
  check(`${scheme}: --paper is ${expected}`, early.paper === toRgb(expected), early.paper);

  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const meta = await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content));
  check(`${scheme}: theme-color follows --paper`, meta.every((c) => c.toLowerCase() === expected.toLowerCase()), meta.join(','));
  await page.goto(`${base}/profile/index.html`, { waitUntil: 'networkidle' }); // the picker lives on the profile
  const swatch = await page.evaluate((t) => {
    const el = document.querySelector(`.theme-opt[data-theme="${t}"]`);
    return el ? getComputedStyle(el).backgroundColor : null;
  }, id);
  check(`${scheme}: picker draws the ${id} swatch in its own paper`, swatch === toRgb(expected), String(swatch));
  await ctx.close();
}
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
