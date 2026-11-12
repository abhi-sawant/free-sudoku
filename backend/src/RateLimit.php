<?php
declare(strict_types=1);

/** Fixed-window counters kept in MySQL. hit() throws a 429 once a bucket passes its limit. */
final class RateLimit
{
    public static function hit(string $bucket, int $max, int $windowSeconds): void
    {
        $bucket = substr($bucket, 0, 120);
        $now = time();
        // Column order matters: MySQL evaluates the assignments left to right, so `hits` still sees the old window.
        Db::run(
            'INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, ?)
             ON DUPLICATE KEY UPDATE hits = IF(window_start <= ?, 1, hits + 1), window_start = IF(window_start <= ?, ?, window_start)',
            [$bucket, $now, $now - $windowSeconds, $now - $windowSeconds, $now]
        );
        $row = Db::one('SELECT hits FROM rate_limits WHERE bucket = ?', [$bucket]);
        if ($row && (int) $row['hits'] > $max) {
            throw new ApiError(429, 'rate_limited', 'Too many attempts. Please wait a little and try again.');
        }
    }
}
