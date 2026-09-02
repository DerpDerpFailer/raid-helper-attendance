CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Discord guild members
CREATE TABLE IF NOT EXISTS members (
  id            TEXT PRIMARY KEY,               -- Discord snowflake
  display_name  TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,      -- 0/1
  joined_at     TEXT NOT NULL,                   -- ISO8601, most recent (re)join, sourced from GuildMember.joinedAt
  left_at       TEXT,                            -- NULL while active; approximate departure date otherwise
  first_seen_at TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_is_active ON members(is_active);

-- Raid-Helper events
CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,               -- Raid-Helper event id
  title          TEXT,
  channel_id     TEXT,
  start_time     TEXT NOT NULL,                  -- ISO8601 UTC
  status         TEXT,                           -- raw status string from the API
  raw_json       TEXT,                           -- full API payload (debugging / future fields)
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);

-- One row per (event, member) sign-up
CREATE TABLE IF NOT EXISTS signups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id     TEXT NOT NULL REFERENCES members(id),
  status        TEXT NOT NULL,                   -- normalized: Accepted/Tentative/Late/Bench/Absence/Declined/...
  role_or_class TEXT,                            -- role/class when Accepted
  is_present    INTEGER GENERATED ALWAYS AS (CASE WHEN status = 'Absence' THEN 0 ELSE 1 END) STORED,
  signed_at     TEXT,                            -- sign-up timestamp if provided by the API
  raw_json      TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_signups_member_id ON signups(member_id);
CREATE INDEX IF NOT EXISTS idx_signups_event_id ON signups(event_id);

-- One row per computed period (deterministic label, e.g. 'week-2026-W36')
CREATE TABLE IF NOT EXISTS stats_periods (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  label        TEXT NOT NULL UNIQUE,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  computed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-member stats for a given period
CREATE TABLE IF NOT EXISTS stats_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id        INTEGER NOT NULL REFERENCES stats_periods(id) ON DELETE CASCADE,
  member_id        TEXT NOT NULL REFERENCES members(id),
  member_joined_at TEXT NOT NULL,                -- joined_at value used as the rate denominator's floor
  total_events     INTEGER NOT NULL,
  responses        INTEGER NOT NULL,
  presences        INTEGER NOT NULL,
  response_rate    REAL NOT NULL,
  presence_rate    REAL NOT NULL,
  score_global     REAL NOT NULL,
  eligible         INTEGER NOT NULL,             -- active AND tenure >= ELIGIBILITY_MIN_DAYS at period_end
  global_rank      INTEGER,                      -- NULL when not eligible
  presence_rank    INTEGER,
  response_rank    INTEGER,
  UNIQUE(period_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_stats_snapshots_period ON stats_snapshots(period_id);
