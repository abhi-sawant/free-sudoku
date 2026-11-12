<?php
declare(strict_types=1);

/**
 * Global leaderboards: one best result per player, per game and variant. Signed-in players' apps send improvements
 * (src/shared/leaderboard/submit.ts); players who opted out (users.leaderboard_optout) are never stored or shown.
 */

const LB_MAX_ITEMS_PER_SUBMIT = 80;
const LB_MAX_ROWS = 100;

function route_leaderboard_submit(array $in): array
{
    $me = Auth::require();
    RateLimit::hit('lb:user:' . $me['id'], 60, 60);
    $items = $in['items'] ?? null;
    if (!is_array($items) || count($items) > LB_MAX_ITEMS_PER_SUBMIT) throw new ApiError(422, 'bad_items', 'Send up to ' . LB_MAX_ITEMS_PER_SUBMIT . ' results.');
    if ((int) ($me['leaderboard_optout'] ?? 0) === 1) return ['accepted' => 0, 'optedOut' => true];

    $accepted = 0;
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $game = (string) ($it['game'] ?? '');
        if (LeaderboardConfig::kind($game) === null) continue;
        try {
            $variant = LeaderboardConfig::variant($it['variant'] ?? null);
            $value = LeaderboardConfig::value($game, $it['value'] ?? null);
        } catch (ApiError) {
            continue; // one bad result must not block the rest
        }
        // Keep only the better of the stored and the new result.
        $cmp = LeaderboardConfig::ascending($game) ? '<' : '>';
        Db::run(
            "INSERT INTO leaderboard_bests (user_id, game, variant, value, updated_at) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE updated_at = IF(VALUES(value) $cmp value, VALUES(updated_at), updated_at),
                                     value = IF(VALUES(value) $cmp value, VALUES(value), value)",
            [$me['id'], $game, $variant, $value, Db::now()]
        );
        $accepted++;
    }
    return ['accepted' => $accepted];
}

/** The player behind a Bearer token, if there is a valid one; the board itself is public. */
function lb_optional_user_id(): ?int
{
    $token = Http::bearer();
    if ($token === null) return null;
    $row = Db::one('SELECT user_id FROM sessions WHERE access_hash = ? AND access_expires_at > ?', [Auth::tokenHash($token), Db::now()]);
    return $row ? (int) $row['user_id'] : null;
}

function route_leaderboard_get(array $in, array $args): array
{
    $game = $args[0];
    $kind = LeaderboardConfig::kind($game);
    if ($kind === null) throw new ApiError(404, 'not_found', 'No leaderboard for that game.');
    RateLimit::hit('lbget:ip:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 120, 60);

    $variants = Db::all('SELECT variant, COUNT(*) AS n FROM leaderboard_bests WHERE game = ? GROUP BY variant ORDER BY n DESC, variant', [$game]);
    $names = array_column($variants, 'variant');
    $variant = isset($_GET['variant']) ? LeaderboardConfig::variant($_GET['variant']) : ($names[0] ?? 'all');
    $limit = min(LB_MAX_ROWS, max(1, (int) ($_GET['limit'] ?? 25)));
    $asc = LeaderboardConfig::ascending($game);
    $dir = $asc ? 'ASC' : 'DESC';
    $uid = lb_optional_user_id();

    $rows = Db::all(
        "SELECT b.user_id, b.value, b.updated_at, u.display_name
         FROM leaderboard_bests b JOIN users u ON u.id = b.user_id
         WHERE b.game = ? AND b.variant = ? AND u.leaderboard_optout = 0
         ORDER BY b.value $dir, b.updated_at ASC, b.user_id ASC LIMIT $limit",
        [$game, $variant]
    );
    $entries = [];
    foreach ($rows as $i => $r) {
        $name = trim((string) $r['display_name']);
        $entries[] = [
            'rank' => $i + 1,
            'name' => $name !== '' ? $name : 'Player ' . (crc32('p' . $r['user_id']) % 9000 + 1000),
            'value' => (string) $r['value'],
            'at' => $r['updated_at'],
            'you' => $uid !== null && (int) $r['user_id'] === $uid,
        ];
    }

    $total = Db::one('SELECT COUNT(*) AS n FROM leaderboard_bests WHERE game = ? AND variant = ?', [$game, $variant]);
    $mine = null;
    if ($uid !== null) {
        $m = Db::one('SELECT value FROM leaderboard_bests WHERE user_id = ? AND game = ? AND variant = ?', [$uid, $game, $variant]);
        if ($m) {
            $op = $asc ? '<' : '>';
            $ahead = Db::one("SELECT COUNT(*) AS n FROM leaderboard_bests WHERE game = ? AND variant = ? AND value $op ?", [$game, $variant, $m['value']]);
            $mine = ['rank' => (int) $ahead['n'] + 1, 'value' => (string) $m['value']];
        }
    }

    return [
        'game' => $game, 'kind' => $kind, 'variant' => $variant,
        'variants' => $names, 'entries' => $entries, 'total' => (int) $total['n'], 'me' => $mine,
    ];
}
