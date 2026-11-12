// The theme picker (on the profile page) must stay usable with every theme: at 320x568 each option can be scrolled to
// and picked, and nothing makes the page scroll sideways.
// Usage: node scripts/theme-gate/picker.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true })).newPage();
await page.goto(`${base}/profile/index.html`, { waitUntil: 'networkidle' });
const ids = await page.locator('#theme-grid .theme-opt').evaluateAll((els) => els.map((e) => e.dataset.theme));
const picked = [];
for (const id of ids) {
  await page.locator(`#theme-grid .theme-opt[data-theme="${id}"]`).click();
  if (await page.evaluate((t) => document.documentElement.dataset.theme === t, id)) picked.push(id);
}
const sideways = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await browser.close();
const ok = ids.length >= 13 && picked.length === ids.length && !sideways;
console.log(JSON.stringify({ options: ids.length, picked: picked.length, sideways }));
console.log(ok ? 'ok: every theme can be picked and nothing scrolls sideways' : 'FAIL: an option could not be picked, or the page scrolls sideways');
process.exit(ok ? 0 : 1);
