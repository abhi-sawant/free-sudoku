<?php
declare(strict_types=1);

// Front controller: every request to api.games.slowatcoding.com ends up here (see .htaccess).

$src = dirname(__DIR__) . '/src';
foreach (['Config', 'Db', 'Http', 'RateLimit', 'Validator', 'Mailer', 'Auth', 'routes_auth', 'routes_account', 'routes_sync', 'LeaderboardConfig', 'routes_leaderboard'] as $f) {
    require_once "$src/$f.php";
}

ini_set('display_errors', '0');
error_reporting(E_ALL);
ini_set('log_errors', '1');
ini_set('error_log', dirname(__DIR__) . '/storage/error.log');
date_default_timezone_set('UTC');

try {
    Http::cors();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'OPTIONS') { http_response_code(204); exit; }

    $path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = '/' . trim(preg_replace('#^/v1(?=/|$)#', '', $path), '/');

    // [method, pattern, handler]. Patterns are anchored regexes; captures are passed as $args.
    $routes = [
        ['GET',    '#^/health$#',                  fn() => ['ok' => true, 'db' => (bool) Db::one('SELECT 1 AS x'), 'time' => gmdate('c')]],
        ['POST',   '#^/auth/signup$#',             'route_signup'],
        ['POST',   '#^/auth/verify-email$#',       'route_verify_email'],
        ['POST',   '#^/auth/resend-otp$#',         'route_resend_otp'],
        ['POST',   '#^/auth/signin$#',             'route_signin'],
        ['POST',   '#^/auth/refresh$#',            'route_refresh'],
        ['POST',   '#^/auth/signout$#',            'route_signout'],
        ['POST',   '#^/auth/forgot-password$#',    'route_forgot_password'],
        ['POST',   '#^/auth/reset-password$#',     'route_reset_password'],
        ['GET',    '#^/account$#',                 'route_account_get'],
        ['PATCH',  '#^/account$#',                 'route_account_patch'],
        ['DELETE', '#^/account$#',                 'route_delete_account'],
        ['POST',   '#^/account/change-password$#', 'route_change_password'],
        ['GET',    '#^/account/sessions$#',        'route_sessions_list'],
        ['DELETE', '#^/account/sessions/(\d+)$#',  'route_session_revoke'],
        ['GET',    '#^/sync$#',                    'route_sync_get'],
        ['PUT',    '#^/sync$#',                    'route_sync_put'],
        ['POST',   '#^/leaderboard/submit$#',      'route_leaderboard_submit'],
        ['GET',    '#^/leaderboard/([a-z0-9]{2,24})$#', 'route_leaderboard_get'],
    ];

    $pathMatched = false;
    foreach ($routes as [$m, $re, $handler]) {
        if (!preg_match($re, $path, $args)) continue;
        $pathMatched = true;
        if ($m !== $method) continue;
        array_shift($args);
        $in = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) ? Http::body() : [];
        $out = $handler($in, $args);
        Http::json(200, $out);
    }
    throw $pathMatched ? new ApiError(405, 'method_not_allowed', 'Method not allowed.') : new ApiError(404, 'not_found', 'Not found.');
} catch (ApiError $e) {
    Http::json($e->status, ['error' => ['code' => $e->errorCode, 'message' => $e->getMessage()] + $e->extra]);
} catch (Throwable $e) {
    error_log($e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $msg = 'Something went wrong on our side. Please try again later.';
    Http::json(500, ['error' => ['code' => 'server_error', 'message' => Config::debug() ? $e->getMessage() : $msg]]);
}
