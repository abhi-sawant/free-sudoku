// Felt & Wood: card faces stay cream, and both black and red suits read at 4.5:1 on them, in a light and a dark OS.
// Usage: node scripts/theme-gate/felt.mjs [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
let failed = 0;
const say = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

for (const colorScheme of ['light', 'dark']) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme })).newPage();
  await page.addInitScript(() => localStorage.setItem('games.theme', 'felt'));
  await page.goto(`${base}/klondike/index.html`, { waitUntil: 'networkidle' });
  await page.locator('#levels button, .levels button').first().click();
  await page.waitForSelector('.card:not(.down)');
  const r = await page.evaluate(() => {
    const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const probe = (red) => {
      const c = document.createElement('div'); c.className = `card${red ? ' red' : ''}`; c.style.position = 'fixed';
      document.querySelector('.card').parentElement.append(c);
      const s = getComputedStyle(c); const out = { bg: rgb(s.backgroundColor), fg: rgb(s.color) }; c.remove(); return out;
    };
    const black = probe(false), red = probe(true);
    const [r, g, b] = black.bg;
    return { cream: r > 225 && g > 215 && b > 180 && r >= b + 12, bg: black.bg.join(','), black: ratio(black.bg, black.fg), red: ratio(red.bg, red.fg) };
  });
  say(r.cream, `${colorScheme}: card face is cream (${r.bg})`);
  say(r.black >= 4.5, `${colorScheme}: black suit ${r.black.toFixed(2)}:1`);
  say(r.red >= 4.5, `${colorScheme}: red suit ${r.red.toFixed(2)}:1`);
  // Yacht's score card is a .card too, but not a playing card: it must keep the theme's own surface, not cream stock.
  await page.goto(`${base}/yacht/index.html`, { waitUntil: 'networkidle' });
  const sheet = await page.evaluate(() => {
    const card = getComputedStyle(document.getElementById('card'));
    const probe = document.createElement('i'); probe.style.color = 'var(--face)'; document.body.append(probe);
    const face = getComputedStyle(probe).color; probe.remove();
    return { bg: card.backgroundColor, face };
  });
  say(!sheet.bg.startsWith(sheet.face.replace(')', '')), `${colorScheme}: Yacht's score card is not printed as a playing card (${sheet.bg})`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
