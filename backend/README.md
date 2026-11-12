# Games API (PHP + MySQL)

The optional accounts and sync backend for the Games site, served at `https://api.games.slowatcoding.com/v1`.
Plain PHP 8.1+ with no Composer and no frameworks, built for cPanel shared hosting.

**To deploy it, follow [SETUP-GUIDE.md](SETUP-GUIDE.md).** It is deployed by hand, not by the site's GitHub Action.

```
public/index.php     router: the only PHP file reachable from the web (document root points at public/)
public/.htaccess     https redirect, rewrite to index.php, Authorization header pass-through
src/                 Config, Db (PDO), Http (JSON, CORS), Auth (passwords, codes, sessions), Mailer (SMTP, no library),
                     RateLimit, Validator, and the route handlers (routes_auth, routes_account, routes_sync)
cron/cleanup.php     nightly tidy-up, run from cPanel Cron Jobs
schema.sql           the five tables; import once in phpMyAdmin
config.sample.php    copy to config.php (never committed) and fill in
storage/             error.log, and mail.log when the mail driver is `log`; not web-accessible
```

How it works, in short: accounts are an email and a password (stored hashed with a server-side pepper); an emailed
6-digit code verifies the address and resets passwords; each device holds an opaque access token and a refresh token
(only hashes are stored); progress is a versioned key-value store, with merging done by the app
(`src/shared/sync/merge.ts`) and the server rejecting writes made against an out-of-date version.
