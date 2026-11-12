// The primary button (Install on the profile page) keeps its own fill in a theme, rather than losing it to the theme's
// plain button surface. Usage: node scripts/theme-gate/primary.mjs <id> [--base http://localhost:5173]

import { chromium } from 'playwright-core';

const id = process.argv[2];
const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
await page.addInitScript((t) => localStorage.setItem('games.theme', t), id);
await page.goto(`${base}/profile/index.html`, { waitUntil: 'networkidle' });
const r = await page.evaluate(() => {
  const btn = document.getElementById('install-btn');
  btn.hidden = false;
  const plain = document.createElement('button');
  plain.className = 'btn';
  btn.after(plain);
  const out = { primary: getComputedStyle(btn).backgroundColor, plain: getComputedStyle(plain).backgroundColor };
  plain.remove();
  return out;
});
await browser.close();
const ok = r.primary !== r.plain;
console.log(`${ok ? 'ok  ' : 'FAIL'} ${id}: primary button ${r.primary} vs plain button ${r.plain}`);
process.exit(ok ? 0 : 1);
