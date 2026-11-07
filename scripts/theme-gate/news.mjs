// Newsprint: the paper, sheet and sunk surfaces are strictly neutral grey (no warm or cool cast) in both OS schemes.
// Usage: node scripts/theme-gate/news.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
let failed = 0;
for (const colorScheme of ['light', 'dark']) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme })).newPage();
  await page.addInitScript(() => localStorage.setItem('games.theme', 'news'));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const vals = await page.evaluate(() => ['--paper', '--sheet', '--sunk'].map((v) => {
    const el = document.createElement('i'); el.style.color = `var(${v})`; document.body.append(el);
    const c = getComputedStyle(el).color; el.remove(); return [v, c];
  }));
  for (const [v, c] of vals) {
    const [r, g, b] = c.match(/\d+/g).map(Number);
    const grey = r === g && g === b;
    console.log(`${grey ? 'ok  ' : 'FAIL'} ${colorScheme}: ${v} is neutral (${c})`);
    if (!grey) failed++;
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
