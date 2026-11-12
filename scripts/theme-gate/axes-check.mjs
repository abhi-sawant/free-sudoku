// The distinctness rule from docs/superpowers/specs/2026-11-07-new-themes-design.md: a theme must differ from every
// other theme on at least MIN_DIFF of the eight axes, and hold a value no other theme has on at least MIN_UNIQUE.
// Usage: node scripts/theme-gate/axes-check.mjs <theme-id>

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MIN_DIFF = 4;
export const MIN_UNIQUE = 2;

/** @param {Record<string, Record<string, string>>} axes @param {string} id */
export function checkAxes(axes, id) {
  const me = axes[id];
  const others = Object.entries(axes).filter(([k]) => k !== id);
  const keys = Object.keys(me);
  const failures = [];
  for (const [other, theirs] of others) {
    const n = keys.filter((k) => me[k] !== theirs[k]).length;
    if (n < MIN_DIFF) failures.push(`${id} differs from ${other} on ${n} axes, needs ${MIN_DIFF}`);
  }
  const unique = keys.filter((k) => others.every(([, theirs]) => theirs[k] !== me[k]));
  if (unique.length < MIN_UNIQUE) {
    failures.push(`${id} has ${unique.length} unique axis value(s) (${unique.join(', ') || 'none'}), needs ${MIN_UNIQUE}`);
  }
  return { ok: failures.length === 0, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const axes = JSON.parse(readFileSync(new URL('./axes.json', import.meta.url), 'utf8'));
  const id = process.argv[2];
  if (!axes[id]) { console.error(`unknown theme: ${id}`); process.exit(2); }
  const r = checkAxes(axes, id);
  console.log(r.ok ? `${id}: ok` : r.failures.join('\n'));
  process.exit(r.ok ? 0 : 1);
}
