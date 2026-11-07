import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkAxes } from './axes-check.mjs';

const KEYS = ['ground', 'edges', 'depth', 'corners', 'type', 'texture', 'home', 'families'];
const mk = (vals) => Object.fromEntries(KEYS.map((k, i) => [k, vals[i]]));
const base = { a: mk(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']) };

test('fails a theme that differs from another on only 3 axes', () => {
  const axes = { ...base, b: mk(['b1', 'b2', 'b3', 'a4', 'a5', 'a6', 'a7', 'a8']) };
  const r = checkAxes(axes, 'b');
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /differs from a on 3/);
});

test('passes a theme that differs on 4 axes and holds 2 values no other theme has', () => {
  const axes = { ...base, b: mk(['b1', 'b2', 'b3', 'b4', 'a5', 'a6', 'a7', 'a8']) };
  assert.deepEqual(checkAxes(axes, 'b'), { ok: true, failures: [] });
});

test('fails a theme with 4 differing axes but fewer than 2 values of its own', () => {
  // b differs from a on 4 axes and from c on 5, but borrows every value except its ground
  const axes = {
    a: mk(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']),
    c: mk(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']),
    b: mk(['b1', 'c2', 'a3', 'c4', 'c5', 'a6', 'a7', 'a8']),
  };
  const r = checkAxes(axes, 'b');
  assert.equal(r.ok, false);
  assert.match(r.failures.join('\n'), /unique/);
});

test('every theme in axes.json passes against the others', () => {
  const axes = JSON.parse(readFileSync(new URL('./axes.json', import.meta.url), 'utf8'));
  for (const id of ['mist', 'linen', 'sage', 'graph', 'block', 'pocket']) assert.ok(axes[id], `${id} is missing`);
  for (const id of Object.keys(axes)) {
    const r = checkAxes(axes, id);
    assert.equal(r.ok, true, `${id}: ${r.failures.join('; ')}`);
  }
});
