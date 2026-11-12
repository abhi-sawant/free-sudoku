<?php
// Copy this file to config.php (same folder) and fill in the values. config.php is never committed to git.
// SETUP-GUIDE.md explains where each value comes from.

return [
    // MySQL, from cPanel > MySQL Databases. MilesWeb prefixes names with your account name, e.g. "abc123_games".
    'db' => [
        'host' => 'localhost',
        'name' => 'CPANELUSER_games',
        'user' => 'CPANELUSER_gamesapp',
        'pass' => 'THE-DATABASE-PASSWORD',
    ],

    // Two long random strings. Generate each one with:  php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    // or at any password generator (64+ random characters). NEVER change them once users exist, or every
    // password, code and sign-in becomes invalid.
    'secret' => 'PASTE-A-LONG-RANDOM-STRING-HERE',
    'pepper' => 'PASTE-A-DIFFERENT-LONG-RANDOM-STRING-HERE',

    // Websites and apps allowed to call this API from a browser (CORS). Exact origins, no trailing slash.
    'allowed_origins' => [
        'https://games.slowatcoding.com',
        'https://localhost',          // the Android app
        'capacitor://localhost',      // an iOS build, if ever
        // 'http://localhost:5174',   // local development (npm run dev); remove in production
    ],

    // How the verification / reset emails are sent.
    //   'smtp' : through the mailbox you create in cPanel (recommended)
    //   'mail' : PHP's built-in mail() (often lands in spam)
    //   'log'  : writes the email to storage/mail.log instead of sending (for local testing only)
    'mail' => [
        'driver'     => 'smtp',
        'host'       => 'mail.slowatcoding.com',   // shown in cPanel > Email Accounts > Connect Devices
        'port'       => 465,                       // 465 = SSL, 587 = STARTTLS
        'encryption' => 'ssl',                     // 'ssl' (port 465) or 'tls' (port 587)
        'user'       => 'no-reply@slowatcoding.com',
        'pass'       => 'THE-MAILBOX-PASSWORD',
        'from'       => 'no-reply@slowatcoding.com',
        'from_name'  => 'Games',
    ],

    'app_name' => 'Games',

    // Leave false in production. true shows error details in responses (never do that on the live site).
    'debug' => false,
];
