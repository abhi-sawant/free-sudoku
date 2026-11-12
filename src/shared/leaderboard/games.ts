// Which games have a global leaderboard and how each is ranked. Keep in step with backend/src/LeaderboardConfig.php.
//   time  = milliseconds, lower is better (one board per level)
//   score = points, higher is better
// Games against the computer or a friend (win/draw/loss only) and Word Guess have no board.

export type Kind = 'time' | 'score';

const TIME = [
  'sudoku', 'killer', 'kakuro', 'calcudoku', 'futoshiki', 'skyscrapers', 'jigsaw', 'sudokux', 'minesweeper',
  'nonograms', 'takuzu', 'nurikabe', 'hitori', 'starbattle', 'lightsout', 'tents', 'lightup', 'heyawake', 'lits',
  'slitherlink', 'masyu', 'bridges', 'flow', 'watersort', 'fifteen', 'sokoban', 'rushhour', 'pegs',
  'klondike', 'freecell', 'spider', 'yukon', 'canfield', 'fortythieves', 'pyramid', 'tripeaks', 'golf',
  'wordsearch', 'letterwheel',
];
const SCORE = ['2048', '2248', 'halo', 'threes', 'qubo', 'crazycat', 'racer', 'yacht'];

const KINDS = new Map<string, Kind>([...TIME.map((s) => [s, 'time'] as const), ...SCORE.map((s) => [s, 'score'] as const)]);

export const boardKind = (slug: string): Kind | undefined => KINDS.get(slug);
export const hasBoard = (slug: string) => KINDS.has(slug);
export const boardSlugs = (): string[] => [...KINDS.keys()];

/** Is `a` a better result than `b` on this kind of board? */
export const better = (kind: Kind, a: bigint, b: bigint) => (kind === 'time' ? a < b : a > b);

/** A time as m:ss (or h:mm:ss); a score as digits with thousands separators. */
export function formatValue(kind: Kind, value: string): string {
  if (kind === 'score') return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const total = Math.round(Number(value) / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
