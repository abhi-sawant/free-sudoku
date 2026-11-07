// Neo-brutalist: a pressed button moves down-right into its hard shadow, and the shadow shrinks to match.
// Usage: node scripts/theme-gate/brutal.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
await page.addInitScript(() => localStorage.setItem('games.theme', 'brutal'));
await page.goto(`${base}/sudoku/index.html`, { waitUntil: 'networkidle' });
const btn = page.locator('#levels button').first();
const box = await btn.boundingBox();
const read = () => btn.evaluate((el) => ({ t: getComputedStyle(el).transform, s: getComputedStyle(el).boxShadow }));
const rest = await read();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(150);
const pressed = await read();
await page.mouse.up();
await browser.close();
const m = pressed.t.match(/matrix\(([^)]+)\)/);
const [tx, ty] = m ? m[1].split(',').slice(4).map(Number) : [0, 0];
const ok = tx >= 2 && ty >= 2 && pressed.s !== rest.s;
console.log(JSON.stringify({ rest: rest.s.slice(0, 60), pressed: pressed.s.slice(0, 60), tx, ty }));
console.log(ok ? 'ok: a pressed button moves into its shadow' : 'FAIL: a pressed button does not move into its shadow');
process.exit(ok ? 0 : 1);
