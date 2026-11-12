// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_MAX, canon, foldOverflow, isSyncKey, kindOf, mergeItem, sameValue } from '../src/shared/sync/merge.ts';

const j = JSON.stringify;
const merge = (key: string, a: unknown, b: unknown, localNewer = false) =>
  mergeItem(key, a === null ? null : j(a), b === null ? null : j(b), localNewer);
const val = (r: { value: string | null }) => (r.value === null ? null : JSON.parse(r.value));

test('which keys sync', () => {
  for (const k of ['sudoku.history', '2248.stats', 'halo.archive', 'chess.playtime', 'klondike.current', 'sudoku.played.easy',
    'fifteen.bestMoves', 'yacht.best', 'qubo.best', 'games.badges', 'games.title']) assert.ok(isSyncKey(k), k);
  assert.equal(kindOf('games.title'), 'title');
  for (const k of ['games.theme', 'update.skipped', 'racer.muted', 'stats.found', 'badges.found', 'gotd.pick', 'games.sealed',
    'sync.session', 'sync.state', 'sync.device']) assert.equal(kindOf(k), null, k);
});

test('history: union by content, newest first, same on both devices', () => {
  const a = [{ endedAt: 30, result: 'won' }, { endedAt: 10, result: 'lost' }];
  const b = [{ endedAt: 30, result: 'won' }, { endedAt: 20, result: 'won' }];
  const ab = val(merge('sudoku.history', a, b));
  const ba = val(merge('sudoku.history', b, a));
  assert.deepEqual(ab.map((e: any) => e.endedAt), [30, 20, 10]);
  assert.deepEqual(ab, ba);
});

test('history: capped at 500, the rest returned to be folded', () => {
  const a = Array.from({ length: 400 }, (_, i) => ({ endedAt: 1000 + i, result: 'won' }));
  const b = Array.from({ length: 400 }, (_, i) => ({ endedAt: 5000 + i, result: 'lost' }));
  const r = merge('sudoku.history', a, b);
  assert.equal(val(r).length, HISTORY_MAX);
  assert.equal(r.overflow!.length, 300);
  assert.equal(val(r)[0].endedAt, 5399);
});

test('overflow already covered by the archive is not folded twice', () => {
  const archive = { count: 5, num: { endedAt: { n: 5, sum: 0, min: 1, max: 100 } }, big: {}, tally: {} };
  const out = foldOverflow(archive, [{ endedAt: 50, result: 'won' }, { endedAt: 150, result: 'won' }]);
  assert.equal(out.count, 6);
});

test('archive: the bigger summary wins, never a sum', () => {
  const small = { count: 2, num: {}, big: {}, tally: {} };
  const big = { count: 9, num: {}, big: {}, tally: {} };
  assert.equal(val(merge('sudoku.archive', small, big)).count, 9);
  assert.equal(val(merge('sudoku.archive', big, small)).count, 9);
});

test('stats: counters take the larger, best times the smaller', () => {
  const a = { easy: { played: 5, won: 3, bestTime: 90000 }, hard: { played: 1, won: 0, bestTime: null } };
  const b = { easy: { played: 4, won: 4, bestTime: 80000 }, medium: { played: 2, won: 1, bestTime: 70000 } };
  const r = val(merge('sudoku.stats', a, b));
  assert.deepEqual(r.easy, { played: 5, won: 4, bestTime: 80000 });
  assert.deepEqual(r.hard, { played: 1, won: 0, bestTime: null });
  assert.deepEqual(r.medium, { played: 2, won: 1, bestTime: 70000 });
  assert.deepEqual(r, val(merge('sudoku.stats', b, a)));
});

test('stats: best scores keep the larger, including digit-string scores', () => {
  const r = val(merge('halo.stats', { best: '12345678901234567890', runs: 3 }, { best: '9999', runs: 7 }));
  assert.deepEqual(r, { best: '12345678901234567890', runs: 7 });
});

test('best moves: the smaller wins, best score: the larger', () => {
  assert.deepEqual(val(merge('fifteen.bestMoves', { easy: 40, hard: 90 }, { easy: 35 })), { easy: 35, hard: 90 });
  assert.equal(val(merge('yacht.best', 210, 250)), 250);
});

test('playtime: larger totals, earlier first, local pending kept', () => {
  const a = { ms: 5000, opens: 3, first: 200, last: 900, pending: 40 };
  const b = { ms: 9000, opens: 2, first: 100, last: 800, pending: 99 };
  assert.deepEqual(val(merge('chess.playtime', a, b)), { ms: 9000, opens: 3, first: 100, last: 900, pending: 40 });
});

test('played ids and badges are unions; a badge keeps its earliest unlock', () => {
  assert.deepEqual(val(merge('sudoku.played.easy', [3, 1], [2, 3])), [1, 2, 3]);
  assert.deepEqual(val(merge('games.badges', { a: 500, b: 700 }, { a: 300, c: 100 })), { a: 300, b: 700, c: 100 });
});

test('the game in progress: the newer save wins, including finishing it', () => {
  assert.deepEqual(val(merge('klondike.current', { m: 1 }, { m: 2 }, true)), { m: 1 });
  assert.deepEqual(val(merge('klondike.current', { m: 1 }, { m: 2 }, false)), { m: 2 });
  assert.equal(val(merge('klondike.current', { m: 1 }, null, false)), null);
});

test('a missing side takes the other', () => {
  assert.deepEqual(val(merge('sudoku.stats', null, { easy: { played: 1 } })), { easy: { played: 1 } });
  assert.deepEqual(val(merge('sudoku.stats', { easy: { played: 1 } }, null)), { easy: { played: 1 } });
});

test('unreadable text never beats readable', () => {
  assert.deepEqual(mergeItem('sudoku.stats', '{oops', j({ a: 1 }), false).value, j({ a: 1 }));
  assert.equal(mergeItem('sudoku.stats', j({ a: 1 }), 'nope', false).value, j({ a: 1 }));
});

test('idempotent and commutative: merging again changes nothing', () => {
  const cases: [string, unknown, unknown][] = [
    ['sudoku.history', [{ endedAt: 3, result: 'won' }], [{ endedAt: 4, result: 'lost' }]],
    ['sudoku.stats', { easy: { played: 2, won: 1, bestTime: 5 } }, { easy: { played: 3, won: 1, bestTime: 4 } }],
    ['chess.playtime', { ms: 1, opens: 1, first: 5, last: 6, pending: 0 }, { ms: 2, opens: 2, first: 3, last: 9, pending: 0 }],
    ['games.badges', { a: 1 }, { b: 2 }],
  ];
  for (const [k, a, b] of cases) {
    const once = merge(k, a, b).value!;
    const sym = merge(k, b, a).value!;
    assert.ok(sameValue(once, sym), `${k} commutes`);
    assert.ok(sameValue(mergeItem(k, once, j(b), false).value, once), `${k} idempotent with b`);
    assert.ok(sameValue(mergeItem(k, once, j(a), false).value, once), `${k} idempotent with a`);
  }
});

test('two devices converge after syncing in any order', () => {
  const A = j([{ endedAt: 1, result: 'won' }, { endedAt: 3, result: 'won' }]);
  const B = j([{ endedAt: 2, result: 'lost' }]);
  // A syncs first (server = A), then B merges and pushes, then A pulls.
  const server1 = A;
  const b2 = mergeItem('sudoku.history', B, server1, false).value!;
  const a2 = mergeItem('sudoku.history', A, b2, false).value!;
  assert.ok(sameValue(a2, b2));
  assert.equal(JSON.parse(a2).length, 3);
});

test('canon ignores key order', () => {
  assert.equal(canon({ b: 1, a: [{ d: 1, c: 2 }] }), canon({ a: [{ c: 2, d: 1 }], b: 1 }));
});

test('title: the later pick wins, either order', () => {
  const pick = { adj: 'A', noun: 'B', at: 5 }, auto = { auto: true, at: 9 };
  assert.deepEqual(val(merge('games.title', pick, auto)), auto);
  assert.deepEqual(val(merge('games.title', auto, pick)), auto);
  const x = { adj: 'Zen', noun: 'Puzzler', at: 7 }, y = { adj: 'Bold', noun: 'Dealer', at: 7 };
  assert.deepEqual(val(merge('games.title', x, y)), val(merge('games.title', y, x)));
  assert.deepEqual(val(merge('games.title', x, x)), x);
});
