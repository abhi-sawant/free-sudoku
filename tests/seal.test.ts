// Run with: npm test  (node's built-in test runner; no extra dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';

type Backing = { data: Map<string, string>; full: boolean };

/** A fake Storage over a shared backing store: each "tab" gets its own Storage class and its own copy of seal.ts,
 *  as two pages would, but they see the same data. */
let n = 0;
async function tab(b: Backing): Promise<Storage> {
  class FakeStorage {
    get length() { return b.data.size; }
    key(i: number) { return [...b.data.keys()][i] ?? null; }
    getItem(k: string) { return b.data.get(k) ?? null; }
    setItem(k: string, v: string) { if (b.full) throw new Error('QuotaExceededError'); b.data.set(k, String(v)); }
    removeItem(k: string) { b.data.delete(k); }
    clear() { b.data.clear(); }
  }
  const g = globalThis as any;
  g.Storage = FakeStorage;
  g.window = { localStorage: new FakeStorage() };
  await import(`../src/shared/seal.ts?tab${n++}`);
  return g.window.localStorage;
}
const fresh = (): Backing => ({ data: new Map(), full: false });
const names = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i)!);

test('round trip, and nothing readable on disk', async () => {
  const b = fresh(), s = await tab(b);
  s.setItem('halo.stats', '{"best":9}');
  assert.equal(s.getItem('halo.stats'), '{"best":9}');
  assert.ok(![...b.data.keys()].some(k => k.includes('halo')));
  assert.ok(![...b.data.values()].some(v => v.includes('best')));
});

test('an edited or copied value reads as missing', async () => {
  const b = fresh(), s = await tab(b);
  s.setItem('a', 'one'); s.setItem('b', 'two');
  for (const [k, v] of b.data) if (v.startsWith('~1')) b.data.set(k, v.slice(0, -1) + (v.endsWith('x') ? 'y' : 'x'));
  assert.equal(s.getItem('a'), null);
  assert.equal(s.getItem('b'), null);
});

test('listing keys gives real names back', async () => {
  const b = fresh(), s = await tab(b);
  s.setItem('gotd.x', '1'); s.setItem('halo.stats', '2');
  const listed = names(s);
  assert.ok(listed.includes('gotd.x') && listed.includes('halo.stats'));
});

test('two tabs adding different keys do not drop each other from the index', async () => {
  const b = fresh();
  const a = await tab(b), c = await tab(b);
  c.setItem('halo.stats', '1');
  a.setItem('2248.stats', '2'); // a's copy of the index predates halo.stats
  assert.ok(names(a).includes('halo.stats'), 'tab a lists the key tab c added');
  assert.ok(names(c).includes('2248.stats'));
  const d = await tab(b);
  assert.ok(names(d).includes('halo.stats') && names(d).includes('2248.stats'));
});

test('removing a key removes it from the index across tabs', async () => {
  const b = fresh();
  const a = await tab(b), c = await tab(b);
  a.setItem('x', '1'); a.removeItem('x');
  c.setItem('y', '1');
  const d = await tab(b);
  assert.equal(names(d).filter(k => k === 'x').length, 0);
  assert.equal(d.getItem('x'), null);
});

test('migration moves old saves under codes and verifies them', async () => {
  const b = fresh();
  b.data.set('old.save', 'hello'); b.data.set('games.theme', 'dark');
  const s = await tab(b);
  assert.equal(s.getItem('old.save'), 'hello');
  assert.ok(!b.data.has('old.save'), 'old plain key removed');
  assert.equal(b.data.get('games.theme'), 'dark');
  b.data.set('old.save', 'forged');
  assert.equal(s.getItem('old.save'), 'hello', 'once migrated, a plain key is ignored');
});

test('a failed index write leaves the device unmigrated, and it is retried', async () => {
  const b = fresh();
  b.data.set('old.save', 'hello');
  // Storage that takes the sealed save but then fills up before the index can be written.
  let writes = 0;
  const orig = Map.prototype.set;
  b.data.set = function (k: string, v: string) {
    if (++writes === 1) { b.full = true; throw new Error('QuotaExceededError'); } // the index is written first
    return orig.call(this, k, v);
  } as any;
  const s1 = await tab(b);
  assert.ok(!([...b.data.keys()].some(k => k === 'games.sealed')), 'not marked as done');
  assert.equal(s1.getItem('old.save'), 'hello', 'still readable');
  b.data.set = orig as any; b.full = false;
  const s2 = await tab(b);
  assert.equal(s2.getItem('old.save'), 'hello');
  assert.ok(names(s2).includes('old.save'), 'the name is in the index after the retry');
});

test('a failed index write on save is retried on the next save', async () => {
  const b = fresh(), s = await tab(b);
  b.full = true;
  assert.throws(() => s.setItem('q', '1')); // the value itself can't be stored
  b.full = false;
  s.setItem('q', '1');
  const d = await tab(b);
  assert.ok(names(d).includes('q'));
});

test('a second copy of the module does not wrap the wrapper', async () => {
  const b = fresh(), s = await tab(b);
  s.setItem('k', 'v');
  await import(`../src/shared/seal.ts?again${n++}`); // same Storage prototype
  assert.equal(s.getItem('k'), 'v');
});
