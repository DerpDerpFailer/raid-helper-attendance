const { getDb } = require('../connection');

const MONITORED_ROLE_ID_KEY = 'monitored_role_id';

function get(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function set(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, new Date().toISOString());
}

/**
 * The role that marks a "real" tracked member (set via /setup role). When unset, the bot falls
 * back to tracking every non-bot guild member — see scheduler/reconcileMembers.js and
 * discord/memberEvents.js.
 */
function getMonitoredRoleId() {
  return get(MONITORED_ROLE_ID_KEY);
}

function setMonitoredRoleId(roleId) {
  set(MONITORED_ROLE_ID_KEY, roleId);
}

module.exports = { get, set, getMonitoredRoleId, setMonitoredRoleId };
