<?php
declare(strict_types=1);

final class Validator
{
    public static function email(mixed $v): string
    {
        $e = strtolower(trim((string) $v));
        if ($e === '' || strlen($e) > 190 || !filter_var($e, FILTER_VALIDATE_EMAIL)) {
            throw new ApiError(422, 'invalid_email', 'Enter a valid email address.');
        }
        return $e;
    }

    public static function password(mixed $v): string
    {
        $p = (string) $v;
        if (mb_strlen($p) < 8) throw new ApiError(422, 'weak_password', 'Use at least 8 characters for the password.');
        if (strlen($p) > 200) throw new ApiError(422, 'weak_password', 'That password is too long.');
        return $p;
    }

    public static function name(mixed $v): string
    {
        $n = trim(preg_replace('/\s+/u', ' ', (string) $v) ?? '');
        if (mb_strlen($n) > 40) throw new ApiError(422, 'invalid_name', 'The name can be up to 40 characters.');
        return strip_tags($n);
    }

    public static function code(mixed $v): string
    {
        $c = preg_replace('/\D/', '', (string) $v) ?? '';
        if (strlen($c) !== 6) throw new ApiError(422, 'invalid_code', 'Enter the 6-digit code.');
        return $c;
    }

    public static function deviceId(mixed $v): string
    {
        $d = (string) $v;
        return preg_match('/^[A-Za-z0-9_-]{8,64}$/', $d) ? $d : '';
    }

    public static function deviceLabel(mixed $v): string
    {
        return mb_substr(strip_tags(trim((string) $v)), 0, 80);
    }

    /** Keys the app syncs look like "sudoku.history", "games.badges", "sudoku.played.easy". */
    public static function syncKey(mixed $v): string
    {
        $k = (string) $v;
        if (!preg_match('/^[a-z0-9][A-Za-z0-9._-]{0,63}$/', $k)) throw new ApiError(422, 'invalid_key', 'Bad sync key.');
        return $k;
    }
}
