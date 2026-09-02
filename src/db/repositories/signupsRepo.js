const { getDb } = require('../connection');
const membersRepo = require('./membersRepo');

/**
 * Replaces every sign-up for an event with the given list (delete + insert in one transaction).
 * Simpler and safer than diffing: a sign-up withdrawn on Raid-Helper's side must disappear here too.
 */
function replaceForEvent(eventId, signups) {
  const db = getDb();
  const now = new Date().toISOString();

  const run = db.transaction(() => {
    db.prepare('DELETE FROM signups WHERE event_id = ?').run(eventId);

    const insert = db.prepare(`
      INSERT INTO signups (event_id, member_id, status, role_or_class, signed_at, raw_json, updated_at)
      VALUES (@eventId, @memberId, @status, @roleOrClass, @signedAt, @rawJson, @now)
    `);

    for (const signup of signups) {
      membersRepo.ensureExists(signup.memberId, signup.displayName);
      insert.run({ ...signup, eventId, now });
    }
  });

  run();
}

function getForEvent(eventId) {
  const db = getDb();
  return db.prepare('SELECT * FROM signups WHERE event_id = ?').all(eventId);
}

module.exports = { replaceForEvent, getForEvent };
