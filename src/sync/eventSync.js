const client = require('../raidhelper/client');
const { mapEventWithSignups } = require('../raidhelper/mapper');
const eventsRepo = require('../db/repositories/eventsRepo');
const signupsRepo = require('../db/repositories/signupsRepo');
const logger = require('../utils/logger');

/** Fetches one event's full detail and (re)persists its event row + sign-ups. Idempotent. */
async function syncEvent(eventId) {
  const raw = await client.getEvent(eventId);
  const { event, signups } = mapEventWithSignups(raw);

  eventsRepo.upsert(event);
  signupsRepo.replaceForEvent(event.id, signups);

  logger.debug({ eventId: event.id, signupCount: signups.length }, 'Synced event');
  return event;
}

/**
 * Syncs a batch of event ids sequentially (gentle on the API, simple to reason about).
 * Returns the number of events that failed, so callers can decide whether the batch was
 * "complete enough" to consider done (see sync/backfill.js).
 */
async function syncEvents(eventIds) {
  let failures = 0;
  for (const id of eventIds) {
    try {
      await syncEvent(id);
    } catch (err) {
      failures += 1;
      logger.error({ eventId: id, err: err.message }, 'Failed to sync event, skipping');
    }
  }
  return failures;
}

module.exports = { syncEvent, syncEvents };
