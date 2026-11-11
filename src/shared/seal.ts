// Sealed saves: everything the games keep in localStorage is scrambled and signed on its way in, and checked and
// unscrambled on its way out, so a save can't be read or edited by hand in the browser's developer tools. The games
// don't know: this wraps localStorage itself, and is the first thing pwa.ts (on every page) loads.
//
// It's a deterrent for casual editing, not security: the code that seals is in the page, so anyone who reads it can
// forge a save. Anything that will ever be trusted beyond this device (multiplayer) must be checked by a server.
//
// Keys are stored under codes, not names: `2248.stats` is saved as something like `0a8x3k2q9wv1m`, worked out from the
// name, so nothing on disk says which game a save belongs to. Listing keys still gives the real names back.
//
// A sealed value is "~1" + a 16-character check + the scrambled text. The check covers the key's name and the
// value, so an edited value, or one copied from another key, fails it and reads as missing. The scramble shifts only
// printable ASCII, within printable ASCII, so a value stays the same size; anything else passes through, still covered
// by the check. Saves written before this are moved to their codes and sealed the first time it runs on a device;
// after that, a save under a readable name, or an unsealed value, is ignored.

/** Left readable: read by an inline script before any of this loads (it picks the theme before the first paint). */
const OPEN_KEYS = new Set(['games.theme']);
const MARK = '~1';
const DONE = 'games.sealed';

// The key, assembled at run time rather than kept as text.
const K = [0x6d2b79f5, 0x1b873593, 0x85ebca6b, 0xc2b2ae35].map((v, i) => (v ^ (0x9e3779b9 * (i + 1))) >>> 0);

function fmix(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const hex8 = (n: number) => n.toString(16).padStart(8, '0');

/** The 16-character check over a key's name and value: two 32-bit hashes worked out in one pass. */
function check(name: string, plain: string): string {
  let a = K[0] ^ plain.length, b = K[1] ^ name.length;
  // Written out rather than through a helper: this runs on every character of every save, and plain loops are fastest.
  for (let i = 0; i <= name.length; i++) {
    const c = i < name.length ? name.charCodeAt(i) : 0;
    a = Math.imul(a ^ c, 0x5bd1e995); a ^= a >>> 15;
    b = Math.imul(b ^ c, 0x27d4eb2d); b ^= b >>> 13;
  }
  for (let i = 0; i < plain.length; i++) {
    const c = plain.charCodeAt(i);
    a = Math.imul(a ^ c, 0x5bd1e995); a ^= a >>> 15;
    b = Math.imul(b ^ c, 0x27d4eb2d); b ^= b >>> 13;
  }
  return hex8(fmix(a)) + hex8(fmix(b ^ a));
}

/** Shifts each printable ASCII character by the next number from a keystream seeded by the check, so every value
 *  scrambles differently; other characters pass through. `dir` 1 scrambles, -1 unscrambles. */
function shift(text: string, tag: string, dir: 1 | -1): string {
  let a = fmix(K[2] ^ parseInt(tag.slice(0, 8), 16) ^ Math.imul(parseInt(tag.slice(8), 16), 0x9e3779b1)) | 0;
  const n = text.length;
  const buf = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    const v = c - 32;
    if (v >= 0 && v < 95) {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const k = ((((t ^ (t >>> 14)) >>> 16) * 95) >>> 16); // 0 to 94, without a division
      let w = dir === 1 ? v + k : v - k;
      if (w >= 95) w -= 95; else if (w < 0) w += 95;
      buf[i] = w + 32;
    } else {
      buf[i] = c;
    }
  }
  let out = '';
  for (let i = 0; i < n; i += 8192) out += String.fromCharCode.apply(null, buf.subarray(i, i + 8192) as unknown as number[]);
  return out;
}

export function seal(name: string, plain: string): string {
  const tag = check(name, plain);
  return MARK + tag + shift(plain, tag, 1);
}

/** The value, or null if it isn't sealed or fails its check. */
export function unseal(name: string, raw: string): string | null {
  if (!raw.startsWith(MARK) || raw.length < MARK.length + 16) return null;
  const tag = raw.slice(MARK.length, MARK.length + 16);
  const plain = shift(raw.slice(MARK.length + 16), tag, -1);
  return check(name, plain) === tag ? plain : null;
}

/** A key's stored name: a code worked out from its real name, so nothing on disk says which game a save is for. */
const codes = new Map<string, string>();
export function codeOf(name: string): string {
  if (OPEN_KEYS.has(name)) return name;
  let c = codes.get(name);
  if (!c) {
    const h = check(`\u0001${name}`, String(K[3]));
    c = (parseInt(h.slice(0, 8), 16).toString(36) + parseInt(h.slice(8), 16).toString(36)).padStart(13, '0').slice(-13);
    codes.set(name, c);
  }
  return c;
}

/** The sealed list of real names in use, so listing keys (game of the day looks for any save of a game) still works. */
const INDEX = '\u0000names';

/** Marks localStorage as wrapped. Kept on the shared Storage prototype rather than in this module, so a second copy
 *  of this code on the page (a stale cached chunk, say) can't wrap the wrapper and move the saves twice. */
const WRAPPED = Symbol.for('w');

/** Wraps localStorage. Safe to call more than once, from any number of copies. */
export function installSeal() {
  const proto = Storage.prototype as Storage & { [WRAPPED]?: true };
  if (proto[WRAPPED]) return;
  let store: Storage;
  try { store = window.localStorage; } catch { return; } // blocked storage: the games already cope
  const get = proto.getItem, set = proto.setItem, remove = proto.removeItem, key = proto.key, clear = proto.clear;
  // The last value read per key, so a game that reads the same save often only unscrambles it once.
  const cache = new Map<string, [raw: string, plain: string | null]>();
  const names = new Set<string>();
  const byCode = new Map<string, string>();
  const remember = (name: string) => { names.add(name); byCode.set(codeOf(name), name); };
  const saveIndex = () => {
    const v = JSON.stringify([...names]);
    try { set.call(store, codeOf(INDEX), seal(INDEX, v)); } catch { /* full */ }
  };
  // Until every save has moved to its code (see below), one that couldn't move yet is still read from its old name.
  let migrated = false;
  const read = (name: string): string | null => {
    const raw = get.call(store, codeOf(name));
    if (raw === null) return migrated || name === DONE || name === INDEX ? null : get.call(store, name);
    const hit = cache.get(name);
    if (hit && hit[0] === raw) return hit[1];
    const plain = unseal(name, raw);
    cache.set(name, [raw, plain]);
    return plain;
  };

  try {
    for (const n of JSON.parse(read(INDEX) ?? '[]') as string[]) if (typeof n === 'string') remember(n);
  } catch { /* no index yet */ }

  // Moving saves to their codes, the first time this runs on a device, on whichever page the player opens first.
  // Nothing may be lost, so each save is written under its code and read back before the old one is removed; if any
  // can't move (storage full), the device isn't marked as done, that save keeps being read from its old name, and the
  // move is tried again on the next page load. Once everything has moved, a save under a readable name is ignored,
  // so typing one in by hand does nothing.
  migrated = read(DONE) === '1';
  if (!migrated) {
    const legacy: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = key.call(store, i);
      if (k !== null && !OPEN_KEYS.has(k) && !byCode.has(k) && k !== codeOf(INDEX) && k !== codeOf(DONE)) legacy.push(k);
    }
    let all = true;
    for (const k of legacy) {
      const v = get.call(store, k);
      if (v === null) continue;
      try {
        const sealed = seal(k, v);
        set.call(store, codeOf(k), sealed);
        if (unseal(k, get.call(store, codeOf(k)) ?? '') !== v) throw new Error('not saved');
        remember(k);
        remove.call(store, k);
      } catch {
        all = false; // left under its old name, still readable; tried again next time
        try { if (get.call(store, codeOf(k)) !== null && !names.has(k)) remove.call(store, codeOf(k)); } catch { /* ignore */ }
      }
    }
    saveIndex();
    if (all) {
      try {
        set.call(store, codeOf(DONE), seal(DONE, '1'));
        migrated = true;
      } catch { /* try again next time */ }
    }
  }

  Object.defineProperty(proto, WRAPPED, { value: true });
  proto.getItem = function (this: Storage, name: string) {
    if (this !== store || OPEN_KEYS.has(name)) return get.call(this, name);
    return read(String(name));
  };
  proto.setItem = function (this: Storage, name: string, value: string) {
    if (this !== store || OPEN_KEYS.has(name)) return set.call(this, name, value);
    const n = String(name), v = String(value);
    const raw = seal(n, v);
    set.call(this, codeOf(n), raw);
    cache.set(n, [raw, v]);
    if (!names.has(n)) { remember(n); saveIndex(); }
    if (!migrated && get.call(this, n) !== null) remove.call(this, n); // the old copy is out of date now
  };
  proto.removeItem = function (this: Storage, name: string) {
    if (this !== store || OPEN_KEYS.has(name)) return remove.call(this, name);
    const n = String(name);
    remove.call(this, codeOf(n));
    if (!migrated) remove.call(this, n); // and any copy not moved yet
    cache.delete(n);
    if (names.delete(n)) { byCode.delete(codeOf(n)); saveIndex(); }
  };
  // Listing keys gives back the real names; the codes and the index stay out of sight.
  proto.key = function (this: Storage, i: number) {
    const k = key.call(this, i);
    if (this !== store || k === null) return k;
    return byCode.get(k) ?? k;
  };
  proto.clear = function (this: Storage) {
    clear.call(this);
    if (this === store) { cache.clear(); names.clear(); byCode.clear(); }
  };
}

installSeal();
