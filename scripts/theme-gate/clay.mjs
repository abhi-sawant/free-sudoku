// Claymorphism: a key is puffed up at rest (light from the top left: highlight inset top-left, shade inset bottom-right)
// and a pressed key flips that shading, as if pushed into the clay.
// Usage: node scripts/theme-gate/clay.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
await page.addInitScript(() => localStorage.setItem('games.theme', 'clay'));
await page.goto(`${base}/sudoku/index.html`, { waitUntil: 'networkidle' });
await page.locator('#levels button').first().click();
const key = page.locator('.pad-btn').first();
const box = await key.boundingBox();
// The first inset layer's x offset: positive means the highlight sits top-left (puffed), negative means flipped.
const firstInsetX = () => key.evaluate((el) => {
  const m = getComputedStyle(el).boxShadow.match(/(-?[\d.]+)px (-?[\d.]+)px [\d.]+px[^,]*inset|inset[^,]*?(-?[\d.]+)px (-?[\d.]+)px/);
  return m ? Number(m[1] ?? m[3]) : NaN;
});
const rest = await firstInsetX();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(200);
const pressed = await firstInsetX();
await page.mouse.up();
await browser.close();
const ok = rest > 0 && pressed < 0;
console.log(`${ok ? 'ok  ' : 'FAIL'} pad key inset shading: rest x=${rest}, pressed x=${pressed}`);
process.exit(ok ? 0 : 1);
