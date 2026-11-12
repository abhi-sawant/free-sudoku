-- Games API database. Import this once with phpMyAdmin (see SETUP-GUIDE.md, step 6).
-- Safe to re-run: every table is created only if it is missing.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email             VARCHAR(190)    NOT NULL,
  password_hash     VARCHAR(255)    NOT NULL,
  display_name      VARCHAR(40)     NOT NULL DEFAULT '',
  email_verified_at DATETIME        NULL,
  sync_rev          BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- last revision number handed out to this user's synced items
  created_at        DATETIME        NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One-time codes sent by email: purpose 'verify' (new account) or 'reset' (forgot password).
CREATE TABLE IF NOT EXISTS email_otps (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  purpose    ENUM('verify','reset') NOT NULL,
  code_hash  CHAR(64)        NOT NULL,
  expires_at DATETIME        NOT NULL,
  attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME        NOT NULL,
  PRIMARY KEY (id),
  KEY idx_otps_user (user_id, purpose),
  CONSTRAINT fk_otps_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per signed-in device. Only hashes of the tokens are stored.
CREATE TABLE IF NOT EXISTS sessions (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id            BIGINT UNSIGNED NOT NULL,
  access_hash        CHAR(64)        NOT NULL,
  access_expires_at  DATETIME        NOT NULL,
  refresh_hash       CHAR(64)        NOT NULL,
  refresh_expires_at DATETIME        NOT NULL,
  device_id          VARCHAR(64)     NOT NULL DEFAULT '',
  device_label       VARCHAR(80)     NOT NULL DEFAULT '',
  created_at         DATETIME        NOT NULL,
  last_seen_at       DATETIME        NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_access (access_hash),
  UNIQUE KEY uq_sessions_refresh (refresh_hash),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The synced progress: one row per saved key (e.g. 'sudoku.history'), value kept exactly as the app stores it.
CREATE TABLE IF NOT EXISTS sync_items (
  user_id    BIGINT UNSIGNED NOT NULL,
  item_key   VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  value      MEDIUMTEXT      NULL,
  deleted    TINYINT(1)      NOT NULL DEFAULT 0,
  rev        BIGINT UNSIGNED NOT NULL,
  device_id  VARCHAR(64)     NOT NULL DEFAULT '',
  updated_at DATETIME        NOT NULL,
  PRIMARY KEY (user_id, item_key),
  KEY idx_sync_rev (user_id, rev),
  CONSTRAINT fk_sync_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Counters that slow down guessing and spamming (per IP / per email / per user).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       VARCHAR(120)     NOT NULL,
  hits         INT UNSIGNED     NOT NULL DEFAULT 0,
  window_start INT UNSIGNED     NOT NULL,
  PRIMARY KEY (bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
