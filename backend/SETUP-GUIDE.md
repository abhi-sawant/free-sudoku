# Setting up the Games backend on MilesWeb (a complete beginner's guide)

This guide takes you from "I have a MilesWeb shared hosting plan" to "people can create accounts and sync their
progress". You don't need to know PHP or databases. Follow the steps in order, and tick each box as you go.

- **Time needed:** about 60–90 minutes the first time.
- **Cost:** nothing extra. It all runs on the hosting plan you already have.
- **Screens may look slightly different.** MilesWeb uses cPanel, and cPanel's look changes between versions and themes.
  If a menu isn't where this guide says, use the search box at the top of cPanel ("Search Tools") and type the
  name in **bold**.

---

## 0. What you are building

```
 Phone / browser                 MilesWeb server
┌──────────────────┐   HTTPS   ┌────────────────────────────────────────────┐
│ games.slowatcoding│ ───────▶ │ api.games.slowatcoding.com  (PHP)           │
│ .com  (the games) │ ◀─────── │   ├─ MySQL database  (accounts, progress)  │
└──────────────────┘   JSON    │   └─ Email mailbox   (sends the codes)     │
                               └────────────────────────────────────────────┘
```

- The **website** (the games) stays exactly where it is. It still works offline with no account.
- The **backend** is a small PHP program in the `backend/` folder of this project. It does five things: creates
  accounts, emails 6-digit codes, signs people in, resets passwords, and stores each person's progress.
- It lives at its own address, `api.games.slowatcoding.com`, and is **separate from the website's folder**. This
  matters: your GitHub deploy replaces the website's folder on every push, so the backend must not be inside it.

### Words you will meet

| Word | Meaning |
|---|---|
| **cPanel** | The control panel of your hosting. Everything below is done here. |
| **Subdomain** | An address like `api.games.slowatcoding.com` under your domain. |
| **Document root** | The folder on the server that an address shows to the world. |
| **MySQL database** | Where accounts and progress are stored. |
| **phpMyAdmin** | A web page inside cPanel for looking at and importing into the database. |
| **SMTP** | How the backend sends email through a mailbox you create. |
| **Cron job** | A task cPanel runs on a schedule (we use it for nightly cleanup). |

### What you need before you start

- [ ] Your MilesWeb login (client area), and your **cPanel** login (usually opened from the client area via
      *Services → your hosting → Login to cPanel*).
- [ ] This project on your computer (the `backend/` folder is inside it).
- [ ] An email address you can read, for testing (e.g. your Gmail).
- [ ] A password manager or a notes file for the passwords you will create. You will make four secrets (database
      password, mailbox password and two long random strings). **Never put them in git or in a chat.**

> **Where is your domain's DNS?** Step 7 needs to know. If `slowatcoding.com` uses MilesWeb's nameservers, everything
> is automatic. If it uses another DNS (Cloudflare, your registrar), you'll add one record there. Check
> *cPanel → Domains → Zone Editor*: if your domain is listed and shows records, MilesWeb is your DNS.

---

## 1. Open cPanel and find your username

1. Log in to MilesWeb → **Services** → your hosting plan → **Login to cPanel** (or go to
   `https://slowatcoding.com:2083` and sign in).
2. On the right-hand side (or under *General Information*) find **Current User**. This is your **cPanel username**,
   something like `slowatcod`. **Write it down.** Wherever this guide says `CPANELUSER`, use it.
3. In *General Information* also note the **Home Directory**, e.g. `/home/slowatcod`. This is where your private
   files live, *outside* the public website folders.

---

## 2. Choose the PHP version

The backend needs **PHP 8.1 or newer** (8.2 or 8.3 is ideal).

1. cPanel → search **Select PHP Version** (CloudLinux) or **MultiPHP Manager**.
2. For **Select PHP Version**: click the version drop-down at the top and pick **8.2** (or newer), then **Set as
   current**. Then in the extensions list make sure these are ticked: `pdo_mysql` (or `mysqlnd`), `mbstring`,
   `openssl`, `json`, `fileinfo`. Most are on by default.
3. For **MultiPHP Manager**: tick the checkbox next to the domain `api.games.slowatcoding.com` (after step 6 creates
   it, come back and do this) and choose PHP 8.2 in the drop-down, **Apply**.

> If you change the PHP version of the *main* domain, you could affect other sites on the account. The games website
> is static files, so this is safe for it, but if you host anything else, only set the version on the API domain.

---

## 3. Create the database

1. cPanel → **MySQL® Database Wizard** (easiest).
2. **Step 1: Create a database.** Name it `games`. cPanel adds your username in front, so the real name becomes e.g.
   `slowatcod_games`. **Write down the full name.** → *Next Step*.
3. **Step 2: Create database user.** Username `gamesapp` (becomes `slowatcod_gamesapp`). Click **Password
   Generator**, copy the password into your notes (tick "I have copied this password in a safe place"), *Use
   Password*. → *Create User*.
4. **Step 3: Add user to database.** Tick **ALL PRIVILEGES** → *Next Step*.

You now have three things in your notes: **database name**, **database user**, **database password**. The host is
always `localhost` on shared hosting.

---

## 4. Create the tables (import `schema.sql`)

1. cPanel → **phpMyAdmin**. (If asked, it signs you in automatically.)
2. In the left sidebar, click your database (`slowatcod_games`).
3. Top menu → **Import** → **Choose file** → pick `backend/schema.sql` from this project → scroll down → **Import**
   (or *Go*).
4. You should see a green "Import has been successfully finished". The left sidebar now lists five tables:
   `email_otps`, `rate_limits`, `sessions`, `sync_items`, `users`.

If you see a red error, copy it. The most common cause is picking the wrong database in step 2 (it must be highlighted
in the sidebar before you import).

---

## 5. Create the mailbox that sends the codes

The backend sends "your code is 123456" emails through a real mailbox on your domain.

1. cPanel → **Email Accounts** → **Create**.
2. Domain `slowatcoding.com`, username `no-reply` → address `no-reply@slowatcoding.com`.
3. Set a strong password (Password Generator again) and **write it down**. Storage can be small, e.g. 100 MB.
   → **Create**.
4. On the Email Accounts list click **Connect Devices** (or *Set Up Mail Client*) next to the new address. Under
   *Mail Client Manual Settings* find **Outgoing Server** (SMTP). Note the **host** (e.g. `mail.slowatcoding.com`) and
   the **SSL port** (**465**). Use the "Secure SSL/TLS Settings".
5. **Make the emails reach the inbox, not spam:** cPanel → **Email Deliverability**. Next to
   `slowatcoding.com` click **Manage**. If it says SPF or DKIM has a problem, click **Repair** (or *Install the
   suggested record*). Both should end up green. If your DNS is not at MilesWeb, it shows the exact records to paste
   into your DNS provider.

> **Is your email already hosted elsewhere?** If `@slowatcoding.com` mail runs through Google Workspace, Zoho, etc.,
> the cPanel mailbox won't receive mail and sending can conflict with your SPF. In that case either use that
> provider's SMTP details in `config.php` (host, port 465/587, an app password) or ask MilesWeb support. The
> backend only needs an SMTP host, a username, a password and a "from" address.

**MilesWeb sending limits:** shared hosting usually caps email at a few hundred per hour. That's plenty for sign-up
codes. The backend also limits itself (max 5 codes per email address per hour).

---

## 6. Create the `api.games.slowatcoding.com` address

Do this **before** uploading. cPanel creates a folder for the address, and that folder is where the backend goes.

1. cPanel → **Domains** (newer cPanel) → **Create A New Domain**.
   - Domain: `api.games.slowatcoding.com`
   - **Untick** "Share document root".
   - Document Root: change it to `/api.games.slowatcoding.com/public` (type this exactly). cPanel suggests
     `/api.games.slowatcoding.com`; you are adding `/public` on the end. cPanel then creates the folder
     `api.games.slowatcoding.com` in your home directory, and only the `public` folder inside it will be visible on the
     internet. Everything else you upload next to it stays private.
   - Submit.

   *Older cPanel with a separate "Subdomains" tool:* Subdomain `api.games`, Domain `slowatcoding.com`, Document Root
   `api.games.slowatcoding.com/public` → Create. (Some versions refuse a second level like `api.games`; if so use the
   Domains tool.)
2. **DNS:**
   - If MilesWeb hosts your DNS, the record is created automatically. Check cPanel → **Zone Editor** shows an
     `api.games` A record.
   - If your DNS is elsewhere (Cloudflare, GoDaddy, etc.): add an **A record**, name `api.games`, value = your
     server's IP address (cPanel → right side → **Shared IP Address**). If you use Cloudflare, set it to **DNS only**
     (grey cloud) while setting up.
3. DNS can take 5–30 minutes (rarely a few hours) to spread. You don't have to wait now; carry on with step 7.
4. If you chose a PHP version via **MultiPHP Manager** in step 2, do it now for this new domain.

> **Important:** The **games website** has its own document root (where the GitHub deploy uploads `dist/`). Make sure
> that is **different** from `/api.games.slowatcoding.com`. The deploy uploads and deletes files in its own folder
> only, so the backend is safe as long as it's not inside it.

---

## 7. Upload the backend files

Upload into the folder cPanel just created, `api.games.slowatcoding.com`. It must look like this when you finish:

```
/home/CPANELUSER/
├── public_html/                    ← your existing website stuff. DO NOT put the backend here
└── api.games.slowatcoding.com/     ← created in step 6: the backend goes here
    ├── public/                     ← only this folder is reachable from the internet
    ├── src/
    ├── cron/
    ├── storage/
    ├── schema.sql
    ├── config.php                  ← you create this in step 9
    └── …
```

(If your cPanel put the folder somewhere else, for example inside `public_html`, use that folder instead. Check in
**Domains** where `api.games.slowatcoding.com` points; the folder name before `/public` is the one.)

### Option A: upload a zip (easiest)

1. On your computer, in the project folder, make a zip of the backend (Terminal on a Mac):

   ```bash
   cd /Users/abhishek/Documents/Projects/Games
   zip -r backend.zip backend -x "backend/config.php" "backend/storage/*.log"
   ```

2. cPanel → **File Manager**. Click **Home Directory** in the left tree, then double-click the folder
   `api.games.slowatcoding.com`. It already contains an empty `public` folder; that is expected.
3. Click **Upload** → choose `backend.zip` → wait for 100% → *Go Back*.
4. Right-click `backend.zip` → **Extract**. A folder `backend` appears inside `api.games.slowatcoding.com`.
5. Open `backend`, press **Select All**, click **Move**, and move everything up into `/api.games.slowatcoding.com`
   (type that as the destination). If asked about overwriting `public`, say yes. Then delete the empty `backend`
   folder and `backend.zip`.
6. Check that `/api.games.slowatcoding.com` directly contains `public`, `src`, `cron`, `storage`, `schema.sql`,
   `config.sample.php`. If you see an extra `backend` layer, you moved at the wrong level. Fix it now.

### Option B: FTP (FileZilla)

Connect with your FTP details (cPanel → **FTP Accounts**), open `api.games.slowatcoding.com` and upload the
*contents* of the `backend/` folder into it.

**Hidden files:** the files named `.htaccess` are hidden by default. In File Manager click **Settings** (top right) →
tick **Show Hidden Files (dotfiles)** → Save. You must see `.htaccess` inside both `api.games.slowatcoding.com/` and
`api.games.slowatcoding.com/public/` (and `…/storage/`). If they are missing, the upload dropped them; upload them
again.

---

## 8. Turn on HTTPS (the padlock)

Passwords travel between the app and the API, so HTTPS is required (the backend also redirects to it).

1. cPanel → **SSL/TLS Status**.
2. Find `api.games.slowatcoding.com` in the list. If it has no certificate (red/no padlock), tick it and click **Run
   AutoSSL**. Wait 2–10 minutes and refresh until it shows a green padlock.
3. If AutoSSL isn't available on your plan, in the MilesWeb client area look for **Free SSL** / **Let's Encrypt**, or
   open a support chat: "Please install a free SSL certificate on api.games.slowatcoding.com".
4. Visit `https://api.games.slowatcoding.com/` in your browser. It should load without a warning. (A JSON "Not found"
   message is **correct**: it proves PHP runs.)

---

## 9. Fill in `config.php`

1. File Manager → open `api.games.slowatcoding.com`. Find `config.sample.php`, right-click → **Copy** → name the copy `config.php`.
2. Right-click `config.php` → **Edit** → *Edit* (the code editor).
3. Fill every value:

   | Setting | What to put |
   |---|---|
   | `db` → `name` | the full database name from step 3 (`slowatcod_games`) |
   | `db` → `user` | the full database user (`slowatcod_gamesapp`) |
   | `db` → `pass` | the database password |
   | `secret` | a long random string (see below) |
   | `pepper` | a **different** long random string |
   | `allowed_origins` | keep `https://games.slowatcoding.com`, `https://localhost` and `capacitor://localhost`. Remove the `//` development line |
   | `mail` → `host` | the SMTP host from step 5 (`mail.slowatcoding.com`) |
   | `mail` → `port` / `encryption` | `465` and `ssl` |
   | `mail` → `user` and `from` | `no-reply@slowatcoding.com` |
   | `mail` → `pass` | the mailbox password |
   | `debug` | `false` |

4. **Making the two random strings.** On your Mac, in Terminal run this twice and paste one result into each:

   ```bash
   openssl rand -hex 32
   ```

   (Or use any password generator to make 64 random characters.) Paste them between the quotes.

   > ⚠️ **Never change `secret` or `pepper` later.** They are mixed into every password and every code. Changing them
   > locks every user out. Keep a copy in your password manager.

5. **Save Changes**, then close the editor.
6. **Lock the file down:** right-click `config.php` → **Change Permissions** → set `600` (Owner: read+write, others:
   nothing) → *Change Permissions*. For the `storage` folder permissions should be `755`.

---

## 10. Test that it works

### 10.1 The health check

Open this in your browser:

```
https://api.games.slowatcoding.com/v1/health
```

You should see something like `{"ok":true,"db":true,"time":"2026-…"}`. 

- `"db":true` means the database connection works. 
- If you see `server_error` or a blank page, jump to **Troubleshooting** (section 15).

### 10.2 Create a test account

On your Mac:

```bash
curl -i -X POST https://api.games.slowatcoding.com/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR-REAL-EMAIL@gmail.com","password":"a-long-test-password","displayName":"Test"}'
```

Expected: `HTTP/2 200` and `{"ok":true,"next":"verify"}`. Within a minute an email with a 6-digit code arrives (check
**Spam** too). Then verify:

```bash
curl -i -X POST https://api.games.slowatcoding.com/v1/auth/verify-email \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR-REAL-EMAIL@gmail.com","code":"123456"}'
```

Expected: `200` and a JSON with `user`, `accessToken` and `refreshToken`. 🎉 The backend works.

If the email doesn't arrive: open `api.games.slowatcoding.com/storage/error.log` in File Manager. A line starting `Mail failed:` says why
(wrong password, wrong host, port blocked). To test everything *except* email, temporarily set `'driver' => 'log'` in
`config.php`; the code then appears in `api.games.slowatcoding.com/storage/mail.log` instead. **Set it back to `'smtp'` afterwards.**

### 10.3 Clean up the test

In phpMyAdmin → database → `users` table → delete the test row (it also removes its other data), or sign in to the app
and use **Delete account**.

---

## 11. Schedule the nightly cleanup (cron job)

Old codes and sessions are harmless but pile up. A nightly job tidies them.

1. cPanel → **Cron Jobs**.
2. **Common Settings** → *Once Per Day (0 0 * * *)*.
3. **Command** (replace `CPANELUSER`):

   ```
   /usr/local/bin/php /home/CPANELUSER/api.games.slowatcoding.com/cron/cleanup.php
   ```

   If it doesn't run, the PHP path may differ. Try `/usr/local/bin/ea-php82` instead of `/usr/local/bin/php` (the
   version number matches step 2). MilesWeb support can confirm the right path.
4. **Add New Cron Job.** Optional: put your email in *Cron Email* at the top of the page to get a daily result line.

---

## 12. Connect the website and the app

Nothing to configure: the app already points at `https://api.games.slowatcoding.com/v1`. Once the backend answers on
that address:

1. Merge this project's changes to `master`. Your existing GitHub deploy uploads the new pages (`/signin/`,
   `/signup/`, `/forgot/`, `/account/`).
2. Open `https://games.slowatcoding.com`, tap the **person icon** at the top right → **Create an account**.
3. Do the full journey once for real: sign up → get the code → verify → you land on **Your account** → play a game
   → on a second browser (or your phone) sign in and check the progress appears.

**Android app:** account sign-in only works in a newly built APK (`/release`), because the old APK doesn't contain
the new pages.

**Testing against a different API** (for example while developing): create a file `.env.development.local` in the
project root containing `VITE_API_BASE=https://your-test-api/v1`, then run `npm run dev`.

---

## 13. Backups and updates

- **Backups:** cPanel → **Backup** or **JetBackup** → download a **MySQL database** backup now and then (e.g.
  monthly). It contains everyone's accounts and progress. Keep it private. MilesWeb also takes automatic backups;
  ask support how far back they go.
- **Updating the backend later:** upload the changed files over the old ones in `api.games.slowatcoding.com` (File Manager → Upload,
  tick *Overwrite*). **Never overwrite `config.php`** (the zip leaves it out on purpose). If an update changes the
  database, its release notes will say which SQL to run in phpMyAdmin.
- **Seeing errors:** `api.games.slowatcoding.com/storage/error.log` lists server-side problems. Delete it when it gets big.

---

## 14. Safety checklist

- [ ] `https://api.games.slowatcoding.com/config.php` and `/src/Auth.php` both show **Not found** (code and
      passwords are not reachable).
- [ ] `config.php` permissions are `600`; `debug` is `false`.
- [ ] `allowed_origins` has no `http://localhost…` development line.
- [ ] The mailbox and database passwords exist only in your password manager and `config.php`.
- [ ] SPF and DKIM are green in **Email Deliverability**.
- [ ] You've added a short privacy note for users. The backend stores: email address, display name, a hashed password,
      device names, and the game progress they sync. Accounts can be deleted by the user from the account page,
      which erases it all.

How the backend protects people, for your own peace of mind: passwords are stored hashed (never readable); codes
expire in 10 minutes and lock after 5 wrong guesses; sign-in, sign-up and code requests are rate-limited; errors never
reveal whether an email has an account; only your website and app are allowed to call it from a browser.

---

## 15. Troubleshooting

| What you see | Likely cause and fix |
|---|---|
| **500 / `server_error`** on `/v1/health` | Open `api.games.slowatcoding.com/storage/error.log`. Usually `config.php` is missing, or a database value is wrong. |
| `config.php is missing…` in the log | You didn't create `config.php` (step 9), or it's in the wrong folder (must be directly in `api.games.slowatcoding.com`, next to `src`). |
| `Access denied for user` | Wrong DB user/password, or the user wasn't added to the database (step 3, part 3). Use the **full** prefixed names. |
| `Unknown database` | Wrong database name in `config.php` (include the `slowatcod_` prefix). |
| `Table '…users' doesn't exist` | `schema.sql` wasn't imported into the right database (step 4). |
| **404 on every URL**, even `/v1/health` | `.htaccess` is missing from `api.games.slowatcoding.com/public` (hidden file, step 7), or the domain's document root isn't `/api.games.slowatcoding.com/public`. |
| **403 Forbidden** | The document root points at `api.games.slowatcoding.com` instead of `api.games.slowatcoding.com/public` (the safety `.htaccess` there denies everything). Edit it in **Domains**. |
| "Not secure" or a certificate warning | AutoSSL hasn't finished (step 8). Wait and re-run it. |
| Page says the app "can't reach the server" | DNS hasn't spread yet, or the domain isn't created (step 6). Test `/v1/health` in a browser first. |
| Browser console: **CORS error** | The page's address isn't in `allowed_origins` (exact match, `https://`, no trailing slash). Edit `config.php`. |
| Email never arrives | Check Spam; look for `Mail failed:` in `error.log`; verify the SMTP host/port/password; confirm SPF/DKIM in **Email Deliverability**; try `'driver' => 'log'` to isolate. |
| `Mail failed: SMTP connect failed` | Wrong host or port; port 465 needs `'encryption' => 'ssl'`, 587 needs `'tls'`. Ask MilesWeb if outgoing SMTP is blocked on your plan. |
| `Mail failed: … unexpected 535` | Wrong mailbox username/password. The username is the **full address**. |
| Sign-in says "Too many attempts" | The rate limiter is doing its job. Wait 15 minutes. (To reset now: phpMyAdmin → `rate_limits` → **Empty**.) |
| Sign-in works but sync does nothing | Open the browser DevTools → Network; look at the `/v1/sync` calls. A 401 means the sign-in expired (sign in again); a CORS error means `allowed_origins`. |
| `Authorization` header seems ignored (everything is 401 after sign-in) | Some hosts strip it. The shipped `.htaccess` already passes it on; make sure it's the file in `api.games.slowatcoding.com/public`. If it persists, ask MilesWeb support to allow the `Authorization` header for PHP. |
| Cron job doesn't run | Wrong PHP path or username in the command (step 11). |

When asking MilesWeb support for help, tell them: "PHP 8.2 app, document root `/api.games.slowatcoding.com/public`, uses MySQL,
SMTP on port 465, needs the `Authorization` header and `mod_rewrite`." They'll know what that means.

---

## Appendix A. What the API offers (for reference)

Base address: `https://api.games.slowatcoding.com/v1`. Everything is JSON.

| Method and path | What it does |
|---|---|
| `GET /health` | Is it up? Is the database reachable? |
| `POST /auth/signup` | Create an account (email, password, optional name) and email a code |
| `POST /auth/verify-email` | Confirm the code; signs this device in |
| `POST /auth/resend-otp` | Send a new code (`purpose`: `verify` or `reset`) |
| `POST /auth/signin` | Email + password; signs this device in |
| `POST /auth/refresh` | Swap a refresh token for new tokens |
| `POST /auth/signout` | End this device's session |
| `POST /auth/forgot-password` | Email a reset code (always answers OK) |
| `POST /auth/reset-password` | Code + new password; signs out every device |
| `GET/PATCH/DELETE /account` | Profile, rename, delete the account |
| `POST /account/change-password` | Needs the current password; signs out other devices |
| `GET /account/sessions`, `DELETE /account/sessions/{id}` | List / sign out devices |
| `GET /sync?since=N`, `PUT /sync` | Pull and push saved progress |

## Appendix B. How syncing works (one paragraph)

Each saved item (for example `sudoku.history`) is stored as one row with a version number. A device downloads
everything newer than what it has seen, merges it with its own copy using rules in `src/shared/sync/merge.ts`
(histories are combined and de-duplicated, badges are added together, best times keep the lower value, and so on), saves
the result, and uploads anything that changed. If two devices upload at the same moment, the server rejects the second
one and hands it the newer copy; that device merges again and retries. Because the rules give the same answer
whichever order they run in, devices always end up identical. Nothing needs the internet to *play*; changes just wait
and sync later.

## Appendix C. Trying the backend on your own computer (optional)

This isn't needed for going live. If you want to: install PHP 8.2 and MySQL (for example with Homebrew:
`brew install php mysql`), create a database and import `schema.sql`, copy `config.sample.php` to `config.php` with
`'host' => '127.0.0.1'`, `'driver' => 'log'` (codes appear in `storage/mail.log`) and
`'http://localhost:5174'` in `allowed_origins`, then run:

```bash
php -S localhost:8000 -t backend/public backend/public/index.php
```

Point the app at it with `VITE_API_BASE=http://localhost:8000/v1` in `.env.development.local`. (The `.htaccess`
https redirect only applies on Apache, not in this built-in server.)
