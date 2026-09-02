-- Generic runtime configuration store, set via the /setup command (e.g. which role marks a
-- tracked member) rather than baked into env vars at deploy time. Reused for future settings.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
