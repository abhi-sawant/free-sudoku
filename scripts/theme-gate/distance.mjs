// Pairwise visual distance between themes from capture.mjs's screenshots. 0 = identical, 1 = opposite.
// Per screen: the mean of a downscaled-pixel distance (24x40, RGB) and a colour-histogram distance (8 bins a channel),
// then the mean over screens. With --check <id>, exits 1 if <id> is closer than baseline.json's min to any theme.
// Usage: node scripts/theme-gate/distance.mjs <dir> [--check <id>] [--write-baseline]

import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = process.argv[2];
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const baselinePath = new URL('./baseline.json', import.meta.url);
if (!dir) { console.error('usage: distance.mjs <dir> [--check <id>] [--write-baseline]'); process.exit(2); }

const themes = readdirSync(dir).filter((t) => !t.startsWith('.')).sort();
const screens = readdirSync(`${dir}/${themes[0]}`).filter((f) => f.endsWith('.png')).map((f) => f.replace('.png', ''));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage();

// Each image becomes a feature set: the 24x40 RGB pixels and a 512-bin colour histogram.
const features = {};
for (const t of themes) {
  features[t] = {};
  for (const s of screens) {
    const b64 = readFileSync(`${dir}/${t}/${s}.png`).toString('base64');
    features[t][s] = await page.evaluate(async (data) => {
      const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
      const c = document.createElement('canvas'); c.width = 24; c.height = 40;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 40);
      const px = Array.from(g.getImageData(0, 0, 24, 40).data);
      const full = document.createElement('canvas'); full.width = 78; full.height = 160;
      const fg = full.getContext('2d'); fg.drawImage(img, 0, 0, 78, 160);
      const d = fg.getImageData(0, 0, 78, 160).data;
      const hist = new Array(512).fill(0);
      for (let i = 0; i < d.length; i += 4) hist[((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5)]++;
      const n = d.length / 4;
      return { px, hist: hist.map((v) => v / n) };
    }, b64);
  }
}
await browser.close();

function pairDistance(a, b) {
  let total = 0;
  for (const s of screens) {
    const A = features[a][s], B = features[b][s];
    let sum = 0, cnt = 0;
    for (let i = 0; i < A.px.length; i++) { if (i % 4 === 3) continue; sum += Math.abs(A.px[i] - B.px[i]) / 255; cnt++; }
    const pixel = sum / cnt;
    const hist = 0.5 * A.hist.reduce((acc, v, i) => acc + Math.abs(v - B.hist[i]), 0);
    total += (pixel + hist) / 2;
  }
  return total / screens.length;
}

const matrix = {};
for (const a of themes) for (const b of themes) if (a < b) matrix[`${a}|${b}`] = pairDistance(a, b);

console.log('       ' + themes.map((t) => t.slice(0, 7).padStart(8)).join(''));
for (const a of themes) {
  console.log(a.slice(0, 7).padEnd(7) + themes.map((b) => (a === b ? '       -' : (matrix[a < b ? `${a}|${b}` : `${b}|${a}`]).toFixed(3).padStart(8))).join(''));
}
const [minPair, min] = Object.entries(matrix).sort((x, y) => x[1] - y[1])[0];
console.log(`\ncloser pair: ${minPair.replace('|', ' / ')} = ${min.toFixed(3)}`);

if (process.argv.includes('--write-baseline')) {
  writeFileSync(baselinePath, JSON.stringify({ min: Number(min.toFixed(4)), pair: minPair.split('|') }, null, 2) + '\n');
  console.log('baseline written');
}
const id = arg('check');
if (id) {
  const base = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const mine = Object.entries(matrix).filter(([k]) => k.split('|').includes(id)).map(([k, v]) => [k.split('|').find((x) => x !== id), v]).sort((a, b) => a[1] - b[1]);
  console.log(`${id}: closest to ${mine[0][0]} at ${mine[0][1].toFixed(3)} (baseline min ${base.min})`);
  const bad = mine.filter(([, v]) => v < base.min);
  for (const [o, v] of bad) console.log(`  TOO CLOSE: ${id} / ${o} = ${v.toFixed(3)}`);
  process.exit(bad.length ? 1 : 0);
}
