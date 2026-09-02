const { getDb } = require('../connection');

/** Upserts an event's own fields (not its signups). */
function upsert(event) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO events (id, title, channel_id, start_time, status, raw_json, last_synced_at)
    VALUES (@id, @title, @channelId, @startTime, @status, @rawJson, @now)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      channel_id = excluded.channel_id,
      start_time = excluded.start_time,
      status = excluded.status,
      raw_json = excluded.raw_json,
      last_synced_at = excluded.last_synced_at
  `).run({ ...event, now });
}

function getById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

function getAllIds() {
  const db = getDb();
  return db.prepare('SELECT id FROM events').all().map((r) => r.id);
}

module.exports = { upsert, getById, getAllIds };
