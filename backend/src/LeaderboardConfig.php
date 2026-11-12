<?php
declare(strict_types=1);

/**
 * Which games have a leaderboard and how each is ranked. Keep in step with src/shared/leaderboard/games.ts.
 *
 *   time  = milliseconds, lower is better (timed puzzles and card games, one board per level)
 *   score = points, higher is better (score and arcade games)
 *
 * The app can't prove a result is genuine (see src/shared/seal.ts), so the server only turns away impossible ones:
 * the bounds below are deliberately generous.
 */
final class LeaderboardConfig
{
    private const TIME = [
        'sudoku', 'killer', 'kakuro', 'calcudoku', 'futoshiki', 'skyscrapers', 'jigsaw', 'sudokux', 'minesweeper',
        'nonograms', 'takuzu', 'nurikabe', 'hitori', 'starbattle', 'lightsout', 'tents', 'lightup', 'heyawake', 'lits',
        'slitherlink', 'masyu', 'bridges', 'flow', 'watersort', 'fifteen', 'sokoban', 'rushhour', 'pegs',
        'klondike', 'freecell', 'spider', 'yukon', 'canfield', 'fortythieves', 'pyramid', 'tripeaks', 'golf',
        'wordsearch', 'letterwheel',
    ];
    private const SCORE = ['2048', '2248', 'halo', 'threes', 'qubo', 'crazycat', 'racer', 'yacht'];

    public const TIME_MIN_MS = 1000;                 // nobody solves anything in under a second
    public const TIME_MAX_MS = 48 * 3600 * 1000;     // two days
    public const SCORE_MAX = '9000000000000000000';  // fits BIGINT UNSIGNED; 2248 and Halo scores can be huge

    /** @return 'time'|'score'|null */
    public static function kind(string $game): ?string
    {
        if (in_array($game, self::TIME, true)) return 'time';
        if (in_array($game, self::SCORE, true)) return 'score';
        return null;
    }

    /** Lower numbers rank first for times, higher for scores. */
    public static function ascending(string $game): bool
    {
        return self::kind($game) === 'time';
    }

    /** A variant is a level or mode name like "easy" or "draw1"; the games own the names, so only the shape is checked. */
    public static function variant(mixed $v): string
    {
        if (!is_string($v) || !preg_match('/^[a-z0-9][a-z0-9_-]{0,22}$/', $v)) throw new ApiError(422, 'bad_variant', 'Unknown level.');
        return $v;
    }

    /** The result as a digit string, checked against the game's bounds. */
    public static function value(string $game, mixed $v): string
    {
        $s = is_int($v) ? (string) $v : (is_string($v) ? $v : '');
        if (!preg_match('/^[1-9][0-9]{0,18}$/', $s)) throw new ApiError(422, 'bad_value', 'That result is not valid.');
        $ok = self::kind($game) === 'time'
            ? (int) $s >= self::TIME_MIN_MS && (int) $s <= self::TIME_MAX_MS
            : strlen($s) < strlen(self::SCORE_MAX) || (strlen($s) === strlen(self::SCORE_MAX) && $s <= self::SCORE_MAX);
        if (!$ok) throw new ApiError(422, 'implausible', 'That result is not valid.');
        return $s;
    }
}
