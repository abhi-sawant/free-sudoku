<?php
declare(strict_types=1);

/** Sign up, verify the email, sign in/out, refresh, forgot and reset password. Each handler returns an array. */

function route_signup(array $in): array
{
    $ip = Http::clientIp();
    $email = Validator::email($in['email'] ?? '');
    $password = Validator::password($in['password'] ?? '');
    $name = Validator::name($in['displayName'] ?? '');
    RateLimit::hit("signup:ip:$ip", 10, 3600);
    RateLimit::hit("otp:email:$email", 5, 3600);

    $user = Auth::userByEmail($email);
    if ($user && $user['email_verified_at'] !== null) {
        // Same answer as a brand-new signup, so nobody can probe which emails have accounts.
        try { Mailer::alreadyRegistered($email); } catch (Throwable $e) { error_log('Mail failed: ' . $e->getMessage()); }
        return ['ok' => true, 'next' => 'verify'];
    }
    if ($user) {
        // Signed up before but never verified: take the new password and name, send a fresh code.
        Db::run('UPDATE users SET password_hash = ?, display_name = ? WHERE id = ?', [Auth::hashPassword($password), $name, $user['id']]);
        $user['display_name'] = $name;
    } else {
        Db::run('INSERT INTO users (email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)', [$email, Auth::hashPassword($password), $name, Db::now()]);
        $user = ['id' => Db::insertId(), 'email' => $email, 'display_name' => $name];
    }
    Auth::sendOtp($user, 'verify');
    return ['ok' => true, 'next' => 'verify'];
}

function route_resend_otp(array $in): array
{
    $email = Validator::email($in['email'] ?? '');
    $purpose = ($in['purpose'] ?? 'verify') === 'reset' ? 'reset' : 'verify';
    RateLimit::hit('resend:ip:' . Http::clientIp(), 20, 3600);
    RateLimit::hit("otp:email:$email", 5, 3600);
    $user = Auth::userByEmail($email);
    if ($user) {
        $verified = $user['email_verified_at'] !== null;
        if (($purpose === 'verify' && !$verified) || ($purpose === 'reset' && $verified)) Auth::sendOtp($user, $purpose);
    }
    return ['ok' => true];
}

function route_verify_email(array $in): array
{
    $email = Validator::email($in['email'] ?? '');
    $code = Validator::code($in['code'] ?? '');
    RateLimit::hit('verify:ip:' . Http::clientIp(), 30, 3600);
    $user = Auth::userByEmail($email);
    if (!$user || $user['email_verified_at'] !== null) throw new ApiError(400, 'invalid_code', 'That code is wrong or has expired.');
    Auth::checkOtp((int) $user['id'], 'verify', $code);
    Db::run('UPDATE users SET email_verified_at = ? WHERE id = ?', [Db::now(), $user['id']]);
    $user['email_verified_at'] = Db::now();
    // Verifying the email also signs this device in.
    $tokens = Auth::createSession((int) $user['id'], Validator::deviceId($in['deviceId'] ?? ''), Validator::deviceLabel($in['deviceLabel'] ?? ''));
    return ['user' => Auth::publicUser($user)] + $tokens;
}

function route_signin(array $in): array
{
    $email = Validator::email($in['email'] ?? '');
    $password = (string) ($in['password'] ?? '');
    $ip = Http::clientIp();
    RateLimit::hit("signin:ip:$ip", 30, 900);
    RateLimit::hit("signin:email:$email", 8, 900);

    $user = Auth::userByEmail($email);
    $ok = Auth::checkPassword($password, $user['password_hash'] ?? null);
    if (!$user || !$ok) throw new ApiError(401, 'bad_credentials', 'Wrong email or password.');
    if ($user['email_verified_at'] === null) {
        RateLimit::hit("otp:email:$email", 5, 3600);
        Auth::sendOtp($user, 'verify');
        throw new ApiError(403, 'email_not_verified', 'Verify your email first. We sent you a new code.');
    }
    $tokens = Auth::createSession((int) $user['id'], Validator::deviceId($in['deviceId'] ?? ''), Validator::deviceLabel($in['deviceLabel'] ?? ''));
    return ['user' => Auth::publicUser($user)] + $tokens;
}

function route_refresh(array $in): array
{
    RateLimit::hit('refresh:ip:' . Http::clientIp(), 120, 3600);
    $token = (string) ($in['refreshToken'] ?? '');
    if (!preg_match('/^[A-Za-z0-9]{20,128}$/', $token)) throw new ApiError(401, 'invalid_refresh', 'Please sign in again.');
    return Auth::refresh($token);
}

function route_signout(array $in): array
{
    $me = Auth::require();
    Db::run('DELETE FROM sessions WHERE id = ?', [$me['session_id']]);
    return ['ok' => true];
}

function route_forgot_password(array $in): array
{
    $email = Validator::email($in['email'] ?? '');
    RateLimit::hit('forgot:ip:' . Http::clientIp(), 10, 3600);
    RateLimit::hit("otp:email:$email", 5, 3600);
    $user = Auth::userByEmail($email);
    // Always the same answer, whether or not the account exists.
    if ($user && $user['email_verified_at'] !== null) Auth::sendOtp($user, 'reset');
    return ['ok' => true];
}

function route_reset_password(array $in): array
{
    $email = Validator::email($in['email'] ?? '');
    $code = Validator::code($in['code'] ?? '');
    $password = Validator::password($in['password'] ?? '');
    RateLimit::hit('reset:ip:' . Http::clientIp(), 30, 3600);
    $user = Auth::userByEmail($email);
    if (!$user) throw new ApiError(400, 'invalid_code', 'That code is wrong or has expired.');
    Auth::checkOtp((int) $user['id'], 'reset', $code);
    Db::run('UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', [Auth::hashPassword($password), Db::now(), $user['id']]);
    // A reset signs the account out everywhere.
    Db::run('DELETE FROM sessions WHERE user_id = ?', [$user['id']]);
    return ['ok' => true];
}
