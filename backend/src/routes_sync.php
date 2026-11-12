<?php
declare(strict_types=1);

/**
 * Progress sync. The server is a dumb, versioned key-value store: every item has a revision number (rev) that goes up
 * on each write. The app merges (see src/shared/sync/merge.ts) and a write is only accepted if the app had seen the
 * item's latest revision; otherwise the server answers with the current value so the app can merge again.
 */

const SYNC_MAX_ITEM_BYTES = 600_000;
const SYNC_MAX_ITEMS_PER_PUSH = 100;
const SYNC_MAX_KEYS_PER_USER = 600;

function route_sync_get(array $in): array
{
    $me = Auth::require();
    RateLimit::hit('sync:user:' . $me['id'], 240, 60);
    $since = max(0, (int) ($_GET['since'] ?? 0));
    $rows = Db::all('SELECT item_key, value, deleted, rev, device_id, updated_at FROM sync_items WHERE user_id = ? AND rev > ? ORDER BY rev ASC LIMIT 400', [$me['id'], $since]);
    $u = Db::one('SELECT sync_rev FROM users WHERE id = ?', [$me['id']]);
    return [
        'rev' => (int) ($u['sync_rev'] ?? 0),
        'items' => array_map(fn($r) => [
            'key' => $r['item_key'], 'value' => $r['deleted'] ? null : $r['value'], 'rev' => (int) $r['rev'],
            'deviceId' => $r['device_id'], 'updatedAt' => $r['updated_at'],
        ], $rows),
        'more' => count($rows) === 400,
    ];
}

function route_sync_put(array $in): array
{
    $me = Auth::require();
    RateLimit::hit('sync:user:' . $me['id'], 240, 60);
    $items = $in['items'] ?? null;
    if (!is_array($items) || count($items) > SYNC_MAX_ITEMS_PER_PUSH) throw new ApiError(422, 'bad_items', 'Send up to ' . SYNC_MAX_ITEMS_PER_PUSH . ' items.');
    $deviceId = Validator::deviceId($in['deviceId'] ?? '');
    $pdo = Db::pdo();
    $results = [];

    foreach ($items as $it) {
        if (!is_array($it)) throw new ApiError(422, 'bad_items', 'Bad item.');
        $key = Validator::syncKey($it['key'] ?? '');
        $base = max(0, (int) ($it['baseRev'] ?? 0));
        $value = $it['value'] ?? null;
        if ($value !== null) {
            if (!is_string($value) || strlen($value) > SYNC_MAX_ITEM_BYTES) throw new ApiError(422, 'bad_value', "The value for $key is too large.");
            if (!mb_check_encoding($value, 'UTF-8')) throw new ApiError(422, 'bad_value', 'Values must be UTF-8 text.');
        }

        $pdo->beginTransaction();
        try {
            $cur = Db::one('SELECT value, deleted, rev FROM sync_items WHERE user_id = ? AND item_key = ? FOR UPDATE', [$me['id'], $key]);
            if ($cur && (int) $cur['rev'] !== $base) {
                $pdo->rollBack();
                $results[] = ['key' => $key, 'status' => 'conflict', 'rev' => (int) $cur['rev'], 'value' => $cur['deleted'] ? null : $cur['value']];
                continue;
            }
            if (!$cur) {
                $n = Db::one('SELECT COUNT(*) AS n FROM sync_items WHERE user_id = ?', [$me['id']]);
                if ((int) $n['n'] >= SYNC_MAX_KEYS_PER_USER) {
                    $pdo->rollBack();
                    throw new ApiError(422, 'too_many_keys', 'Too many synced items.');
                }
            }
            // The next revision number for this user, handed out atomically.
            Db::run('UPDATE users SET sync_rev = LAST_INSERT_ID(sync_rev + 1) WHERE id = ?', [$me['id']]);
            $rev = (int) $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn();
            Db::run(
                'INSERT INTO sync_items (user_id, item_key, value, deleted, rev, device_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE value = VALUES(value), deleted = VALUES(deleted), rev = VALUES(rev), device_id = VALUES(device_id), updated_at = VALUES(updated_at)',
                [$me['id'], $key, $value, $value === null ? 1 : 0, $rev, $deviceId, Db::now()]
            );
            $pdo->commit();
            $results[] = ['key' => $key, 'status' => 'ok', 'rev' => $rev];
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }
    $u = Db::one('SELECT sync_rev FROM users WHERE id = ?', [$me['id']]);
    return ['results' => $results, 'rev' => (int) ($u['sync_rev'] ?? 0)];
}
