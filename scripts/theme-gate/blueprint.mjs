// Blueprint: the drafting grid is drawn on the page, and never sits over a board to take its clicks.
// Usage: node scripts/theme-gate/blueprint.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
await page.addInitScript(() => localStorage.setItem('games.theme', 'blueprint'));
await page.goto(`${base}/sudoku/index.html`, { waitUntil: 'networkidle' });
await page.locator('#levels button').first().click();
const r = await page.evaluate(() => {
  const cell = document.querySelector('.cell:not(.given)');
  const b = cell.getBoundingClientRect();
  const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  return { grid: getComputedStyle(document.body).backgroundImage.includes('gradient'), hit: hit === cell || cell.contains(hit) };
});
await page.locator('.cell:not(.given)').first().click();
const selected = await page.locator('.cell.selected').count();
await browser.close();
let failed = 0;
const say = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
say(r.grid, 'the page carries the drafting grid');
say(r.hit && selected === 1, 'a click on a cell reaches the cell, not the grid');
process.exit(failed ? 1 : 0);
