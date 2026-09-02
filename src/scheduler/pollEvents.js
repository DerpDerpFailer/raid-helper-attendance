const client = require('../raidhelper/client');
const config = require('../config');
const { mapServerEventsList } = require('../raidhelper/mapper');
const eventSync = require('../sync/eventSync');
const eventsRepo = require('../db/repositories/eventsRepo');
const syncStateRepo = require('../db/repositories/syncStateRepo');
const logger = require('../utils/logger');

// Closed events older than this are considered final and skipped on incremental polls —
// keeps each poll cheap (one GET per event) instead of re-fetching the entire history every time.
const RECENT_WINDOW_DAYS = 3;

function needsRefresh(eventId, startTimeMs, knownIds) {
  if (!knownIds.has(eventId)) return true; // never synced before
  if (startTimeMs === null) return true; // unparsable timestamp: always refresh to be safe

  const ageMs = Date.now() - startTimeMs;
  const recentWindowMs = RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return ageMs < recentWindowMs || startTimeMs > Date.now(); // recent past or still upcoming
}

/** Incremental sync: re-fetches only new/recent/upcoming events, not the entire history. */
async function pollEvents() {
  const raw = await client.getServerEvents(config.raidHelper.serverId);
  const list = mapServerEventsList(raw);
  const knownIds = new Set(eventsRepo.getAllIds());

  const toRefresh = list
    .filter((e) => needsRefresh(e.id, e.startTimeMs, knownIds))
    .map((e) => e.id);

  if (toRefresh.length === 0) {
    logger.debug('No events need refreshing this poll cycle');
  } else {
    logger.info({ count: toRefresh.length }, 'Polling events');
    await eventSync.syncEvents(toRefresh);
  }

  syncStateRepo.set('last_poll_at', new Date().toISOString());
}

module.exports = { pollEvents };
