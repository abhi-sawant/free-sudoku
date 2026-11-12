import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestsOf } from '../src/shared/leaderboard/bests.ts';
import { better, formatValue, hasBoard } from '../src/shared/leaderboard/games.ts';

test('timed games give one best time per level, in ms', () => {
  const stats = { easy: { played: 3, won: 2, bestTime: 61234.4 }, hard: { played: 1, won: 0, bestTime: null }, medium: { played: 1, won: 1, bestTime: 90000 } };
  assert.deepEqual(bestsOf('sudoku', stats), [
    { game: 'sudoku', variant: 'easy', value: '61234' },
    { game: 'sudoku', variant: 'medium', value: '90000' },
  ]);
});

test('score games keep exact big scores', () => {
  assert.deepEqual(bestsOf('2248', { played: 4, bestScore: '123456789012345678901', bestExp: 9 }), [{ game: '2248', variant: 'all', value: '123456789012345678901' }]);
  assert.deepEqual(bestsOf('threes', { played: 2, bestScore: 4000 }), [{ game: 'threes', variant: 'all', value: '4000' }]);
});

test('arcade games rank per-level scores; Qubo falls back to its old best key', () => {
  assert.deepEqual(bestsOf('racer', { country: { runs: 3, best: 812 }, city: { runs: 0 } }), [{ game: 'racer', variant: 'country', value: '812' }]);
  assert.deepEqual(bestsOf('qubo', null, 40), [{ game: 'qubo', variant: 'all', value: '40' }]);
  assert.deepEqual(bestsOf('yacht', { solo: {} }, 251), [{ game: 'yacht', variant: 'solo', value: '251' }]);
});

test('games without boards, empty stats and junk give nothing', () => {
  assert.equal(hasBoard('chess'), false);
  assert.deepEqual(bestsOf('chess', { easy: { played: 1, won: 1, bestTime: 5000 } }), []);
  assert.deepEqual(bestsOf('sudoku', null), []);
  assert.deepEqual(bestsOf('2048', { played: 1, bestScore: 'abc' }), []);
});

test('ranking direction and formatting', () => {
  assert.equal(better('time', 5n, 9n), true);
  assert.equal(better('score', 5n, 9n), false);
  assert.equal(formatValue('time', '61234'), '1:01');
  assert.equal(formatValue('time', '3725000'), '1:02:05');
  assert.equal(formatValue('score', '1234567'), '1,234,567');
});
