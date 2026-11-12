<?php
declare(strict_types=1);

// Run nightly from cPanel > Cron Jobs (see SETUP-GUIDE.md). Deletes expired codes, sessions, counters and
// accounts that never verified their email.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

$src = dirname(__DIR__) . '/src';
require_once "$src/Config.php";
require_once "$src/Db.php";

$now = Db::now();
$out = [];
$out['codes']    = Db::run('DELETE FROM email_otps WHERE expires_at < ?', [$now]);
$out['sessions'] = Db::run('DELETE FROM sessions WHERE refresh_expires_at < ?', [$now]);
$out['limits']   = Db::run('DELETE FROM rate_limits WHERE window_start < ?', [time() - 86400]);
$out['unverified'] = Db::run('DELETE FROM users WHERE email_verified_at IS NULL AND created_at < ?', [Db::now(-3 * 86400)]);
echo date('c') . ' cleanup: ' . json_encode($out) . PHP_EOL;
