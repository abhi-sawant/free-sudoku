// Reads a game's best results from its saved stats, in the shape the leaderboard wants: one value per level.
// Pure (no storage access), so it can be tested; submit.ts does the reading.

import { toScore } from '../tilescore.ts';
import { type Kind, boardKind } from './games.ts';

export interface Best { game: string; variant: string; value: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const pos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** `stats` is the parsed `<slug>.stats`; `extra` holds the few games that keep their best elsewhere (`qubo.best`, `yacht.best`). */
export function bestsOf(slug: string, stats: unknown, extra?: unknown): Best[] {
  const kind: Kind | undefined = boardKind(slug);
  if (!kind) return [];
  const out: Best[] = [];
  const add = (variant: string, v: string) => { if (v !== '0' && /^[a-z0-9][a-z0-9_-]{0,22}$/.test(variant)) out.push({ game: slug, variant, value: v }); };

  if (slug === 'yacht') {
    // Only solo play has a score; the rest are against the computer.
    if (pos(extra)) add('solo', String(Math.floor(extra)));
    return out;
  }
  if (isObj(stats) && (typeof stats.played === 'number' || typeof stats.runs === 'number')) {
    // One record for the whole game: 2048, 2248, Halo, Threes, Qubo.
    if (stats.bestScore !== undefined) add('all', toScore(stats.bestScore).toString());
    else if (pos(stats.best)) add('all', String(Math.floor(stats.best)));
  } else if (isObj(stats)) {
    // A record per level.
    for (const [level, v] of Object.entries(stats)) {
      if (!isObj(v)) continue;
      if (kind === 'time' && pos(v.bestTime)) add(level.toLowerCase(), String(Math.round(v.bestTime)));
      if (kind === 'score' && pos(v.best)) add(level.toLowerCase(), String(Math.floor(v.best)));
    }
  }
  if (!out.length && slug === 'qubo' && pos(extra)) add('all', String(Math.floor(extra)));
  return out;
}
