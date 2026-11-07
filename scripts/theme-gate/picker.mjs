// The theme picker must stay usable with many themes: at 320x568 the Done button is on screen and the list scrolls.
// Usage: node scripts/theme-gate/picker.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true })).newPage();
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const grid = document.getElementById('theme-grid');
  const first = grid.firstElementChild;
  while (grid.children.length < 13) grid.append(first.cloneNode(true));
});
await page.click('#theme-btn');
await page.waitForTimeout(400);
const r = await page.evaluate(() => {
  const close = document.getElementById('theme-close').getBoundingClientRect();
  const grid = document.getElementById('theme-grid');
  return { closeBottom: Math.round(close.bottom), vh: innerHeight, closeTop: Math.round(close.top), scrolls: grid.scrollHeight > grid.clientHeight, options: grid.children.length };
});
console.log(JSON.stringify(r));
await browser.close();
const ok = r.closeTop >= 0 && r.closeBottom <= r.vh && r.scrolls;
console.log(ok ? 'ok: Done is on screen and the list scrolls' : 'FAIL: Done is off screen or the list does not scroll');
process.exit(ok ? 0 : 1);
