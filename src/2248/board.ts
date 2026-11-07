// 2248 rules: connect a path of tiles, merge it into one, clear low tiles, drop and refill.
// Tiles store their exponent: exp 1 is 2, exp 11 is 2048.

export const COLS = 5;
export const ROWS = 8;

export interface Tile {
  id: number;
  exp: number;
  r: number;
  c: number;
}

export type Grid = (Tile | null)[][]; // [row][col]

let nextId = 0;

export function newTile(exp: number, r: number, c: number): Tile {
  return { id: nextId++, exp, r, c };
}

/** The smallest tile that can still appear: it rises as bigger tiles are made, to keep the board moving. It
 *  stays 8 doublings below the biggest tile (from a 1024 tile on), with no ceiling, so the range keeps moving
 *  up however far a game goes. */
export function minSpawnExp(maxExp: number): number {
  return Math.max(1, maxExp - 8);
}

export function randomExp(maxExp: number): number {
  return minSpawnExp(maxExp) + Math.floor(Math.random() * 4);
}

export function createGrid(exps?: number[][]): Grid {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => newTile(exps ? exps[r][c] : randomExp(1), r, c)));
}

export function isAdjacent(a: Tile, b: Tile): boolean {
  const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
}

/**
 * Whether `t` can join the path: it must touch the last tile (diagonals count), and match it
 * or be one step higher. The first link must match exactly. Returns 'backtrack' for the
 * previous tile, so dragging back undoes the last step.
 */
export function canExtend(path: Tile[], t: Tile): boolean | 'backtrack' {
  if (path.includes(t)) return path.length > 1 && path[path.length - 2] === t ? 'backtrack' : false;
  const last = path[path.length - 1];
  if (!isAdjacent(last, t)) return false;
  if (path.length === 1) return t.exp === last.exp;
  return t.exp === last.exp || t.exp === last.exp + 1;
}

/** Sum of the path's values. */
export function pathValue(path: Tile[]): number {
  return path.reduce((sum, t) => sum + 2 ** t.exp, 0);
}

/** The merged tile is the path's sum rounded up to a power of two. */
export function mergedExp(path: Tile[]): number {
  return Math.ceil(Math.log2(pathValue(path)));
}

/**
 * After a merge: removes tiles below the spawn minimum, drops the rest down, and fills the
 * gaps from the top. Updates tile positions in place. `spawnedFrom` maps each new tile to the
 * row above the board it falls from.
 */
export function settle(grid: Grid, maxExp: number): { removed: Tile[]; spawned: Tile[]; spawnedFrom: Map<number, number> } {
  const min = minSpawnExp(maxExp);
  const removed: Tile[] = [];
  for (const row of grid) {
    row.forEach((t, c) => {
      if (t && t.exp < min) { removed.push(t); row[c] = null; }
    });
  }

  const spawned: Tile[] = [];
  const spawnedFrom = new Map<number, number>();
  for (let c = 0; c < COLS; c++) {
    const column: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) { const t = grid[r][c]; if (t) column.push(t); }
    for (let k = 0; column.length < ROWS; k++) {
      const t = newTile(randomExp(maxExp), -(k + 1), c);
      spawnedFrom.set(t.id, t.r);
      spawned.push(t);
      column.push(t);
    }
    column.forEach((t, k) => {
      t.r = ROWS - 1 - k;
      t.c = c;
      grid[t.r][c] = t;
    });
  }
  return { removed, spawned, spawnedFrom };
}

/** A move exists while any two touching tiles match. */
export function hasMoves(grid: Grid): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      for (const [dr, dc] of [[0, 1], [1, -1], [1, 0], [1, 1]]) {
        const n = grid[r + dr]?.[c + dc];
        if (n && n.exp === t.exp) return true;
      }
    }
  }
  return false;
}

export function maxTileExp(grid: Grid): number {
  return Math.max(...grid.flat().map((t) => t?.exp ?? 0));
}

/** Short label for a tile. A tile of 1024 reads "1K", so the labels keep doubling cleanly (1K, 2K, 4K … 512K, 1M)
 *  rather than showing the exact value (4.1K, 8.2K, 16.4K). Each 10 doublings is one step up: K, M, B, then aa, ab,
 *  ac … This is only the label; a tile's value is still the power of two. */
export function formatExp(exp: number): string {
  const unit = Math.floor(exp / 10);
  const digits = String(2 ** (exp % 10));
  if (unit <= 3) return digits + ['', 'K', 'M', 'B'][unit];
  const i = unit - 4;
  return digits + String.fromCharCode(97 + (Math.floor(i / 26) % 26)) + String.fromCharCode(97 + (i % 26));
}
