// A home-page game icon keeps every piece that Mist (the reference) draws: in each theme, a piece Mist shows has a
// fill that differs from its icon's tile, an outline (box-shadow or border) or a background image. A theme that
// strips outlines off icon pieces must not leave a piece that was only an outline on a tile of its own colour.
// Themes that list games by name and hide the icons pass. Checks the arcade icons unless --games names others.
// Usage: node scripts/theme-gate/icons.mjs [--themes a,b] [--games qubo,racer] [--scheme light|dark] [--base URL]

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://localhost:5173');
const axes = JSON.parse(readFileSync(new URL('./axes.json', import.meta.url), 'utf8'));
const themes = (arg('themes') ?? Object.keys(axes).join(',')).split(',');
const games = arg('games', 'crazycat,qubo,racer').split(',');
const schemes = arg('scheme') ? [arg('scheme')] : ['light', 'dark'];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
let failures = 0;
for (const scheme of schemes) {
  let reference = null;
  for (const t of ['mist', ...themes.filter((x) => x !== 'mist')]) {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme: scheme })).newPage();
    await page.addInitScript((t) => localStorage.setItem('games.theme', t), t);
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const hidden = await page.evaluate((games) => {
      const out = [];
      for (const icon of document.querySelectorAll(games.map((g) => `.game-icon-${g}`).join(','))) {
        const iconCss = getComputedStyle(icon);
        if (iconCss.display === 'none') continue; // themes that list games by name hide the icons
        const tile = iconCss.backgroundColor;
        for (const piece of icon.querySelectorAll('i')) {
          const s = getComputedStyle(piece);
          if (s.display === 'none' || s.visibility === 'hidden' || piece.offsetWidth === 0) continue;
          const filled = s.backgroundColor !== tile && s.backgroundColor !== 'rgba(0, 0, 0, 0)';
          const outlined = s.boxShadow !== 'none' || parseFloat(s.borderTopWidth) > 0;
          const drawn = s.backgroundImage !== 'none';
          if (!filled && !outlined && !drawn) out.push(`${[...icon.classList].find((c) => c.startsWith('game-icon-'))} i.${piece.className}`);
        }
      }
      return [...new Set(out)];
    }, games);
    await page.context().close();
    if (!reference) { reference = new Set(hidden); if (!themes.includes('mist')) continue; }
    const bad = hidden.filter((x) => !reference.has(x));
    if (bad.length) { failures++; console.log(`FAIL ${t} ${scheme}: invisible ${bad.join(', ')}`); }
    else console.log(`ok   ${t} ${scheme}`);
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
