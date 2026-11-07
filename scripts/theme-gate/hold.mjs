// Qubo's round Jump button on a touch screen, in every theme: its label stays on one line, and a theme that squares
// the round icon buttons squares this one too.
// Usage: node scripts/theme-gate/hold.mjs [--themes a,b] [--base http://localhost:5173]

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://localhost:5173');
const axes = JSON.parse(readFileSync(new URL('./axes.json', import.meta.url), 'utf8'));
const themes = (arg('themes') ?? Object.keys(axes).join(',')).split(',');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
let failures = 0;
for (const t of themes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem('games.theme', t), t);
  await page.goto(`${base}/qubo/index.html`, { waitUntil: 'networkidle' });
  await page.click('#play-btn');
  const r = await page.evaluate(() => {
    const hold = document.getElementById('hold-btn');
    const s = getComputedStyle(hold);
    // Its natural height at its own width, against the same with nothing allowed to wrap (brackets and other
    // generated content included).
    hold.style.height = 'auto';
    const natural = hold.getBoundingClientRect().height;
    hold.style.whiteSpace = 'nowrap';
    const single = hold.getBoundingClientRect().height;
    hold.style.height = hold.style.whiteSpace = '';
    return { wraps: natural > single + 1, hold: s.borderTopLeftRadius, icon: getComputedStyle(document.getElementById('back-btn')).borderTopLeftRadius };
  });
  await ctx.close();
  const problems = [];
  if (r.wraps) problems.push('label wraps');
  if (parseFloat(r.icon) === 0 && parseFloat(r.hold) !== 0) problems.push(`round (${r.hold}) while icon buttons are square`);
  if (problems.length) { failures++; console.log(`FAIL ${t}: ${problems.join('; ')}`); }
  else console.log(`ok   ${t}: one line, radius ${r.hold} (icon buttons ${r.icon})`);
}
await browser.close();
process.exit(failures ? 1 : 0);
