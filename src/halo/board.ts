// Halo rules: numbered tiles sit in a ring. Each turn you place the piece in your hand into a gap. A merge piece (+)
// fuses the matching pair either side of it into a tile one step higher, and keeps folding in the next pair out while
// that pair matches too. A take piece (−) lifts a tile out of the ring into your hand instead. The ring holds CAP
// pieces; the game ends when it is full and no move would bring it back under.
// Tiles store their exponent, as in 2248: exp 1 is 2, exp 11 is 2048, with no ceiling.

export const CAP = 18;
export const START_TILES = 6;

export type Piece =
  | { id: number; kind: 'num'; exp: number }
  | { id: number; kind: 'plus' }
  | { id: number; kind: 'minus' };

let nextId = 0;
export const num = (exp: number): Piece => ({ id: nextId++, kind: 'num', exp });
export const plus = (): Piece => ({ id: nextId++, kind: 'plus' });
export const minus = (): Piece => ({ id: nextId++, kind: 'minus' });

/** The smallest number that can appear: it trails the biggest tile by 6 steps, so the range climbs as you do and old
 *  small tiles stop getting partners. New numbers are this or up to 3 steps above it. */
export function minSpawnExp(maxExp: number): number {
  return Math.max(1, maxExp - 6);
}

/** Merge pieces come about one turn in five, and never more than five turns apart. */
const PLUS_EVERY = 5;
const PLUS_CHANCE = 0.2;
const MINUS_CHANCE = 0.05;

/** The next piece for the hand. `sincePlus` counts the turns since the last merge piece. */
export function nextPiece(maxExp: number, sincePlus: number, ringSize: number, rand = Math.random): Piece {
  const r = rand();
  if (sincePlus >= PLUS_EVERY - 1 || r < PLUS_CHANCE) return plus();
  if (ringSize >= 3 && r < PLUS_CHANCE + MINUS_CHANCE) return minus();
  return num(minSpawnExp(maxExp) + Math.floor(rand() * 4));
}

export function startRing(rand = Math.random): Piece[] {
  return Array.from({ length: START_TILES }, () => num(1 + Math.floor(rand() * 3)));
}

export function maxExpIn(ring: Piece[]): number {
  return ring.reduce((m, p) => (p.kind === 'num' && p.exp > m ? p.exp : m), 0);
}

/** One fusion: `absorbed` tiles fold into `into`, which becomes `exp`. `ring` is the ring after it. */
export interface Fusion {
  into: number;
  absorbed: number[];
  exp: number;
  depth: number; // 1 for the first pair of a chain, 2 for the next…
  points: bigint;
  ring: Piece[];
}

/** Points for a fusion: the new tile's value, times how far into the chain it is. */
export const fusionPoints = (exp: number, depth: number) => 2n ** BigInt(exp) * BigInt(depth);

/** The exponent of a centre tile 2^c with a pair of 2^p folded in: c + 2p rounded up to a power of two. Worked out
 *  from exponents so it stays exact for any size; when one side is far bigger the other only tips it over. */
export function fuseExp(c: number, p: number): number {
  if (c > p + 50) return c + 1;
  if (p > c + 50) return p + 2;
  const base = Math.min(c, p);
  return base + Math.ceil(Math.log2(2 ** (c - base) + 2 * 2 ** (p - base)));
}

/**
 * Runs the chain from the merge piece at `at`, if its neighbours match: they fuse into the centre, then the next
 * pair out joins while it matches. As in 2248, a fused tile is the total of what went in, rounded up to a power of
 * two: a pair of 2s makes 4, then a pair of 4s around that makes 4 + 8 = 12, so 16. Returns the fusions in order
 * (empty if nothing reacts).
 */
function react(ring: Piece[], at: number): Fusion[] {
  const out: Fusion[] = [];
  let r = ring.slice();
  let c = at;
  let centre: number | null = null; // the centre's exponent once it has fused
  for (let depth = 1; ; depth++) {
    const n = r.length;
    if (n < 3) break;
    const li = (c - 1 + n) % n, ri = (c + 1) % n;
    if (li === ri) break;
    const L = r[li], R = r[ri];
    if (L.kind !== 'num' || R.kind !== 'num' || L.exp !== R.exp) break;
    const exp: number = centre === null ? L.exp + 1 : fuseExp(centre, L.exp);
    const id = r[c].id;
    const fused: Piece = { id, kind: 'num', exp };
    // Rebuild the ring without the pair, with the centre fused.
    const next: Piece[] = [];
    r.forEach((p, i) => {
      if (i === li || i === ri) return;
      next.push(i === c ? fused : p);
    });
    r = next;
    c = r.findIndex((p) => p.id === id);
    centre = exp;
    out.push({ into: id, absorbed: [L.id, R.id], exp, depth, points: fusionPoints(exp, depth), ring: r });
  }
  return out;
}

/** Every reaction the ring has waiting, one chain at a time, until no merge piece in it has a matching pair. */
export function settle(ring: Piece[]): Fusion[] {
  const all: Fusion[] = [];
  let r = ring;
  for (;;) {
    let fired = false;
    for (let i = 0; i < r.length; i++) {
      if (r[i].kind !== 'plus') continue;
      const chain = react(r, i);
      if (chain.length) {
        all.push(...chain);
        r = chain[chain.length - 1].ring;
        fired = true;
        break;
      }
    }
    if (!fired) return all;
  }
}

/** Places `piece` (a number or a merge piece) so it lands at index `gap`, i.e. after ring[gap - 1]. */
export function insert(ring: Piece[], gap: number, piece: Piece): Piece[] {
  const r = ring.slice();
  r.splice(ring.length ? ((gap % ring.length) + ring.length) % ring.length : 0, 0, piece);
  return r;
}

/** The ring after placing `piece` at `gap` and letting it react. */
export function placeResult(ring: Piece[], gap: number, piece: Piece): { placed: Piece[]; fusions: Fusion[]; ring: Piece[] } {
  const placed = insert(ring, gap, piece);
  const fusions = settle(placed);
  return { placed, fusions, ring: fusions.length ? fusions[fusions.length - 1].ring : placed };
}

/** Whether a move is legal: it must leave the ring at CAP pieces or fewer. A take piece can always be used. */
export function canPlace(ring: Piece[], gap: number, piece: Piece): boolean {
  if (piece.kind === 'minus') return ring.length > 0;
  return placeResult(ring, gap, piece).ring.length <= CAP;
}

/** The game goes on while any gap takes the hand's piece. With room in the ring every gap does; a full ring needs a
 *  placement that sets off a merge. */
export function hasMove(ring: Piece[], hand: Piece): boolean {
  if (hand.kind === 'minus') return ring.length > 0;
  if (ring.length < CAP) return true;
  for (let g = 0; g < ring.length; g++) if (canPlace(ring, g, hand)) return true;
  return false;
}

/** A plain copy of a piece for saving; ids are given out again on load. */
export type SavedPiece = number | '+' | '-';
export const savePiece = (p: Piece): SavedPiece => (p.kind === 'num' ? p.exp : p.kind === 'plus' ? '+' : '-');
export function loadPiece(s: unknown): Piece | null {
  if (s === '+') return plus();
  if (s === '-') return minus();
  return typeof s === 'number' && Number.isInteger(s) && s > 0 ? num(s) : null;
}
