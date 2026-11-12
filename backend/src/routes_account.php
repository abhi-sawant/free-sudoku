<?php
declare(strict_types=1);

function route_account_get(array $in): array
{
    $me = Auth::require();
    $n = Db::one('SELECT COUNT(*) AS n FROM sync_items WHERE user_id = ? AND deleted = 0', [$me['id']]);
    return ['user' => Auth::publicUser($me), 'syncedItems' => (int) ($n['n'] ?? 0)];
}

function route_account_patch(array $in): array
{
    $me = Auth::require();
    $name = Validator::name($in['displayName'] ?? '');
    Db::run('UPDATE users SET display_name = ? WHERE id = ?', [$name, $me['id']]);
    $me['display_name'] = $name;
    return ['user' => Auth::publicUser($me)];
}

function route_change_password(array $in): array
{
    $me = Auth::require();
    RateLimit::hit('chpw:user:' . $me['id'], 10, 900);
    $row = Db::one('SELECT password_hash FROM users WHERE id = ?', [$me['id']]);
    if (!Auth::checkPassword((string) ($in['currentPassword'] ?? ''), $row['password_hash'] ?? null)) {
        throw new ApiError(403, 'bad_credentials', 'Your current password is wrong.');
    }
    $new = Validator::password($in['newPassword'] ?? '');
    Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [Auth::hashPassword($new), $me['id']]);
    // Every other device has to sign in again.
    Db::run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', [$me['id'], $me['session_id']]);
    return ['ok' => true];
}

function route_delete_account(array $in): array
{
    $me = Auth::require();
    RateLimit::hit('delacct:user:' . $me['id'], 5, 900);
    $row = Db::one('SELECT password_hash FROM users WHERE id = ?', [$me['id']]);
    if (!Auth::checkPassword((string) ($in['password'] ?? ''), $row['password_hash'] ?? null)) {
        throw new ApiError(403, 'bad_credentials', 'Your password is wrong.');
    }
    Db::run('DELETE FROM users WHERE id = ?', [$me['id']]); // sessions, codes and synced progress go with it
    return ['ok' => true];
}

function route_sessions_list(array $in): array
{
    $me = Auth::require();
    $rows = Db::all('SELECT id, device_label, created_at, last_seen_at FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC', [$me['id']]);
    return ['sessions' => array_map(fn($r) => [
        'id' => (int) $r['id'], 'device' => $r['device_label'] ?: 'Unknown device',
        'createdAt' => $r['created_at'], 'lastSeenAt' => $r['last_seen_at'], 'current' => (int) $r['id'] === (int) $me['session_id'],
    ], $rows)];
}

function route_session_revoke(array $in, array $args): array
{
    $me = Auth::require();
    Db::run('DELETE FROM sessions WHERE id = ? AND user_id = ?', [(int) $args[0], $me['id']]);
    return ['ok' => true];
}
