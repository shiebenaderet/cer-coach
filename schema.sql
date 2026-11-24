-- CER Coach database (Cloudflare D1). Safe to run more than once.

CREATE TABLE IF NOT EXISTS teachers (
  email        TEXT PRIMARY KEY,
  name         TEXT,
  school       TEXT,
  note         TEXT,
  role         TEXT NOT NULL DEFAULT 'teacher',   -- teacher | admin
  status       TEXT NOT NULL DEFAULT 'new',       -- new | pending | approved | declined
  requested_at TEXT,
  decided_at   TEXT,
  decided_by   TEXT,
  last_login   TEXT
);

CREATE TABLE IF NOT EXISTS prompts (
  id         TEXT PRIMARY KEY,
  owner      TEXT NOT NULL,
  data       TEXT NOT NULL,                       -- the prompt JSON students load
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS prompts_owner ON prompts(owner);

CREATE TABLE IF NOT EXISTS files (
  key        TEXT PRIMARY KEY,                    -- R2 object key
  owner      TEXT NOT NULL,
  name       TEXT,
  type       TEXT,
  size       INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  tries      INTEGER NOT NULL DEFAULT 0,
  sent_at    INTEGER NOT NULL
);
