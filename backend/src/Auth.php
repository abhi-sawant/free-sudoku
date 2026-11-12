<?php
declare(strict_types=1);

/** Passwords, one-time codes, and device sessions (opaque random tokens; only their hashes are stored). */
final class Auth
{
    private const ACCESS_TTL = 3600;              // 1 hour
    private const REFRESH_TTL = 60 * 86400;       // 60 days
    private const OTP_TTL = 600;                  // 10 minutes
    private const OTP_MAX_ATTEMPTS = 5;

    // ---- passwords ----

    private static function prehash(string $password): string
    {
        // HMAC with a server-side pepper first, so a stolen database alone can't be cracked offline.
        return base64_encode(hash_hmac('sha256', $password, (string) Config::get('pepper'), true));
    }

    public static function hashPassword(string $password): string
    {
        return password_hash(self::prehash($password), PASSWORD_DEFAULT);
    }

    public static function checkPassword(string $password, ?string $hash): bool
    {
        // For an unknown email we still do the same work, so response time doesn't reveal whether the account exists.
        if ($hash === null) {
            password_verify(self::prehash($password), '$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234');
            return false;
        }
        return password_verify(self::prehash($password), $hash);
    }

    // ---- tokens ----

    public static function tokenHash(string $token): string
    {
        return hash_hmac('sha256', $token, (string) Config::get('secret'));
    }

    /** @return array{accessToken:string, refreshToken:string, expiresIn:int} */
    public static function createSession(int $userId, string $deviceId, string $deviceLabel): array
    {
        $access = bin2hex(random_bytes(32));
        $refresh = bin2hex(random_bytes(32));
        // A device signing in again replaces its old session instead of piling up rows.
        if ($deviceId !== '') Db::run('DELETE FROM sessions WHERE user_id = ? AND device_id = ?', [$userId, $deviceId]);
        Db::run(
            'INSERT INTO sessions (user_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at, device_id, device_label, created_at, last_seen_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$userId, self::tokenHash($access), Db::now(self::ACCESS_TTL), self::tokenHash($refresh), Db::now(self::REFRESH_TTL),
             $deviceId, $deviceLabel, Db::now(), Db::now()]
        );
        return ['accessToken' => $access, 'refreshToken' => $refresh, 'expiresIn' => self::ACCESS_TTL];
    }

    /** Swaps a refresh token for a fresh pair. The old pair stops working. */
    public static function refresh(string $refreshToken): array
    {
        $s = Db::one('SELECT id, user_id FROM sessions WHERE refresh_hash = ? AND refresh_expires_at > ?', [self::tokenHash($refreshToken), Db::now()]);
        if (!$s) throw new ApiError(401, 'invalid_refresh', 'Please sign in again.');
        $access = bin2hex(random_bytes(32));
        $refresh = bin2hex(random_bytes(32));
        Db::run(
            'UPDATE sessions SET access_hash = ?, access_expires_at = ?, refresh_hash = ?, refresh_expires_at = ?, last_seen_at = ? WHERE id = ?',
            [self::tokenHash($access), Db::now(self::ACCESS_TTL), self::tokenHash($refresh), Db::now(self::REFRESH_TTL), Db::now(), $s['id']]
        );
        return ['accessToken' => $access, 'refreshToken' => $refresh, 'expiresIn' => self::ACCESS_TTL];
    }

    /** The signed-in user and session for this request, or a 401. */
    public static function require(): array
    {
        $token = Http::bearer();
        if ($token === null) throw new ApiError(401, 'unauthorized', 'Sign in to continue.');
        $row = Db::one(
            'SELECT s.id AS session_id, s.device_id, s.last_seen_at, u.id, u.email, u.display_name, u.email_verified_at, u.created_at
             FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.access_hash = ? AND s.access_expires_at > ? AND u.email_verified_at IS NOT NULL',
            [self::tokenHash($token), Db::now()]
        );
        if (!$row) throw new ApiError(401, 'unauthorized', 'Your session expired. Please sign in again.');
        if (strtotime($row['last_seen_at'] . ' UTC') < time() - 300) {
            Db::run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [Db::now(), $row['session_id']]);
        }
        return $row;
    }

    public static function publicUser(array $u): array
    {
        return ['id' => (int) $u['id'], 'email' => $u['email'], 'displayName' => $u['display_name'], 'createdAt' => $u['created_at']];
    }

    // ---- one-time codes ----

    private static function otpHash(int $userId, string $purpose, string $code): string
    {
        return hash_hmac('sha256', "$userId|$purpose|$code", (string) Config::get('secret'));
    }

    /** Creates a new code (replacing older ones for the same purpose) and emails it. */
    public static function sendOtp(array $user, string $purpose): void
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        Db::run('DELETE FROM email_otps WHERE user_id = ? AND purpose = ?', [$user['id'], $purpose]);
        Db::run(
            'INSERT INTO email_otps (user_id, purpose, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)',
            [$user['id'], $purpose, self::otpHash((int) $user['id'], $purpose, $code), Db::now(self::OTP_TTL), Db::now()]
        );
        try {
            Mailer::otp($user['email'], (string) $user['display_name'], $code, $purpose);
        } catch (Throwable $e) {
            error_log('Mail failed: ' . $e->getMessage());
            throw new ApiError(502, 'email_failed', "We couldn't send the email right now. Please try again in a few minutes.");
        }
    }

    /** Checks a code. Burns the code after too many wrong guesses; consumes it on success. */
    public static function checkOtp(int $userId, string $purpose, string $code): void
    {
        $row = Db::one('SELECT id, code_hash, attempts FROM email_otps WHERE user_id = ? AND purpose = ? AND expires_at > ? ORDER BY id DESC LIMIT 1', [$userId, $purpose, Db::now()]);
        $bad = new ApiError(400, 'invalid_code', 'That code is wrong or has expired.');
        if (!$row) throw $bad;
        if ((int) $row['attempts'] >= self::OTP_MAX_ATTEMPTS) {
            Db::run('DELETE FROM email_otps WHERE id = ?', [$row['id']]);
            throw new ApiError(400, 'code_locked', 'Too many wrong codes. Request a new one.');
        }
        if (!hash_equals($row['code_hash'], self::otpHash($userId, $purpose, $code))) {
            Db::run('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
            throw $bad;
        }
        Db::run('DELETE FROM email_otps WHERE user_id = ? AND purpose = ?', [$userId, $purpose]);
    }

    public static function userByEmail(string $email): ?array
    {
        return Db::one('SELECT * FROM users WHERE email = ?', [$email]);
    }
}
