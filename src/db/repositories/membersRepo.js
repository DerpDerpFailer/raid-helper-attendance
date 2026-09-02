const { getDb } = require('../connection');

/** Ensures a member row exists (placeholder if unknown yet), to satisfy the signups FK. */
function ensureExists(id, displayName) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM members WHERE id = ?').get(id);
  if (existing) return;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO members (id, display_name, is_active, joined_at, first_seen_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?)
  `).run(id, displayName || id, now, now, now);
}

/**
 * Called on guildMemberAdd (live) or reconciliation: (re)marks a member active with a fresh
 * joined_at. `isBot` tracks Discord bot accounts (Raid-Helper itself, music bots, etc.) so the
 * stats engine can exclude them entirely — they never sign up for raids, so they'd otherwise show
 * up as a giant 0%-everywhere tie block at the bottom of every ranking.
 */
function recordJoin(id, displayName, joinedAt, isBot = false) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM members WHERE id = ?').get(id);

  if (!existing) {
    db.prepare(`
      INSERT INTO members (id, display_name, is_active, joined_at, left_at, is_bot, first_seen_at, updated_at)
      VALUES (?, ?, 1, ?, NULL, ?, ?, ?)
    `).run(id, displayName, joinedAt, isBot ? 1 : 0, joinedAt, now);
    return;
  }

  db.prepare(`
    UPDATE members
    SET display_name = ?, is_active = 1, joined_at = ?, left_at = NULL, is_bot = ?, updated_at = ?
    WHERE id = ?
  `).run(displayName, joinedAt, isBot ? 1 : 0, now, id);
}

/** Called on guildMemberRemove (live) or reconciliation: marks a member as departed. */
function recordLeave(id, leftAt) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE members SET is_active = 0, left_at = ?, updated_at = ? WHERE id = ?
  `).run(leftAt, now, id);
}

function updateDisplayName(id, displayName) {
  const db = getDb();
  db.prepare('UPDATE members SET display_name = ?, updated_at = ? WHERE id = ?')
    .run(displayName, new Date().toISOString(), id);
}

function getActiveMemberIds() {
  const db = getDb();
  return db.prepare('SELECT id FROM members WHERE is_active = 1').all().map((r) => r.id);
}

function getAll() {
  const db = getDb();
  return db.prepare('SELECT * FROM members').all();
}

function getById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM members WHERE id = ?').get(id);
}

module.exports = {
  ensureExists,
  recordJoin,
  recordLeave,
  updateDisplayName,
  getActiveMemberIds,
  getAll,
  getById,
};
