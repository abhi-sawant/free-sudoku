// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { notStarted, otherKey, resolveCurrent } from '../src/shared/sync/current.ts';

const A = JSON.stringify({ values: [1], elapsed: 10 });
const B = JSON.stringify({ values: [2], elapsed: 20 });

test('the other copy lives under a key that never syncs', async () => {
  const { isSyncKey } = await import('../src/shared/sync/merge.ts');
  assert.equal(otherKey('sudoku.current'), 'sudoku.current.other');
  assert.equal(isSyncKey(otherKey('sudoku.current')), false);
});

test('same game on both devices: nothing to do, any old other copy is dropped', () => {
  assert.deepEqual(resolveCurrent(A, A, false, 'none'), { value: A, other: null, reload: false });
});

test('a newer game from the other device replaces this one', () => {
  assert.deepEqual(resolveCurrent(A, B, false, 'none'), { value: B, other: null, reload: false });
  assert.deepEqual(resolveCurrent(null, B, false, 'none'), { value: B, other: null, reload: false });
});

test('the open game page reloads to show it, if the player has not played here since opening it', () => {
  assert.deepEqual(resolveCurrent(A, B, false, 'untouched'), { value: B, other: null, reload: true });
  assert.deepEqual(resolveCurrent(null, B, false, 'untouched'), { value: B, other: null, reload: true });
});

test('this device played since opening the page: keep its game, offer the other one', () => {
  // Even if the other device saved later: the page holds this game in memory and would write it back anyway.
  assert.deepEqual(resolveCurrent(A, B, false, 'touched'), { value: A, other: B, reload: false });
  // Finished here (save removed), still in progress there.
  assert.deepEqual(resolveCurrent(null, B, false, 'touched'), { value: null, other: B, reload: false });
});

test('this device saved later: keep its game, offer the other one', () => {
  assert.deepEqual(resolveCurrent(A, B, true, 'none'), { value: A, other: B, reload: false });
  assert.deepEqual(resolveCurrent(A, B, true, 'untouched'), { value: A, other: B, reload: false });
});

test('finished on the other device', () => {
  assert.deepEqual(resolveCurrent(A, null, false, 'none'), { value: null, other: null, reload: false });
  assert.deepEqual(resolveCurrent(A, null, false, 'untouched'), { value: null, other: null, reload: true });
  assert.deepEqual(resolveCurrent(A, null, true, 'none'), { value: A, other: null, reload: false });
  assert.deepEqual(resolveCurrent(A, null, false, 'touched'), { value: A, other: null, reload: false });
});

test('key order alone is not a different game', () => {
  const a = '{"a":1,"b":2}', b = '{"b":2,"a":1}';
  assert.deepEqual(resolveCurrent(a, b, false, 'untouched'), { value: a, other: null, reload: false });
});

test('a game nobody has moved in yet is not offered from the other device', () => {
  assert.equal(notStarted('{"status":"playing","started":false}'), true);
  assert.equal(notStarted('{"status":"playing","started":true}'), false);
  assert.equal(notStarted('{"values":[1]}'), false); // games that don't record it: always offered
  assert.equal(notStarted('not json'), false);
});
