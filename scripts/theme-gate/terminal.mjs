// Terminal: the amber accent reads at 4.5:1 on the paper, the selected Sudoku cell shows a blinking cursor, and the
// blink stops under prefers-reduced-motion. The top bar's family tag never pushes a game's title onto a second line
// (Road Racer's longest level name included).
// Usage: node scripts/theme-gate/terminal.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
let failed = 0;
const say = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

async function selectedCursor(reducedMotion) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion })).newPage();
  await page.addInitScript(() => localStorage.setItem('games.theme', 'terminal'));
  await page.goto(`${base}/sudoku/index.html`, { waitUntil: 'networkidle' });
  await page.locator('#levels button').first().click();
  await page.locator('.cell:not(.given)').first().click();
  const out = await page.evaluate(() => {
    const cell = document.querySelector('.cell.selected');
    const after = cell && getComputedStyle(cell, '::after');
    const lum = (hex) => {
      const c = document.createElement('i'); c.style.color = hex; document.body.append(c);
      const [r, g, b] = getComputedStyle(c).color.match(/\d+/g).map(Number); c.remove();
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const s = getComputedStyle(document.documentElement);
    const a = lum(s.getPropertyValue('--c').trim()), p = lum(s.getPropertyValue('--paper').trim());
    return {
      cursor: !!after && after.content !== 'none' && after.display !== 'none',
      anim: after ? after.animationName : 'none',
      ratio: (Math.max(a, p) + 0.05) / (Math.min(a, p) + 0.05),
    };
  });
  await page.close();
  return out;
}

const moving = await selectedCursor('no-preference');
say(moving.ratio >= 4.5, `amber accent on paper is ${moving.ratio.toFixed(2)}:1`);
say(moving.cursor && moving.anim !== 'none', `selected cell shows a blinking cursor (animation ${moving.anim})`);
const still = await selectedCursor('reduce');
say(still.cursor && still.anim === 'none', `reduced motion: cursor shown, blink off (animation ${still.anim})`);
for (const level of ['country', 'highway', 'city', 'night']) {
  const page = await (await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true })).newPage();
  await page.addInitScript(() => localStorage.setItem('games.theme', 'terminal'));
  await page.goto(`${base}/racer/index.html`, { waitUntil: 'networkidle' });
  await page.click(`.level[data-level="${level}"]`);
  const r = await page.evaluate(() => {
    const b = document.querySelector('#game .meta b');
    const range = document.createRange();
    range.selectNodeContents(b); // the title's own text: the tag is generated content and has its own line
    return { text: b.textContent, lines: new Set([...range.getClientRects()].map((q) => Math.round(q.top))).size };
  });
  say(r.lines <= 1, `top bar "[tag] ${r.text}" sits on one line at 360px (${r.lines} lines)`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
