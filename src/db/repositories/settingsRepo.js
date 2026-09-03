const { getDb } = require('../connection');

const MONITORED_ROLE_ID_KEY = 'monitored_role_id';
const SCORE_WEIGHT_PRESENCE_KEY = 'score_weight_presence';
const DEFAULT_PRESENCE_WEIGHT = 0.7;

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

/**
 * Global score weighting (set via /setup score-weight), as a fraction 0..1 for presence — the
 * sign-up weight is always its complement, so the two always sum to 1. Defaults to the original
 * 0.7 presence / 0.3 sign-up split carried over from the old Excel model.
 */
function getScoreWeights() {
  const raw = get(SCORE_WEIGHT_PRESENCE_KEY);
  const presenceWeight = raw === null ? DEFAULT_PRESENCE_WEIGHT : Number(raw);
  return { presenceWeight, responseWeight: 1 - presenceWeight };
}

/** @param presenceWeight fraction 0..1 (e.g. 0.7 for 70%) */
function setScoreWeights(presenceWeight) {
  set(SCORE_WEIGHT_PRESENCE_KEY, String(presenceWeight));
}

module.exports = {
  get, set, getMonitoredRoleId, setMonitoredRoleId, getScoreWeights, setScoreWeights,
};
