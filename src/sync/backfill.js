const client = require('../raidhelper/client');
const config = require('../config');
const eventSync = require('./eventSync');
const { mapServerEventsList } = require('../raidhelper/mapper');
const syncStateRepo = require('../db/repositories/syncStateRepo');
const logger = require('../utils/logger');

const BACKFILL_DONE_KEY = 'backfill_done';

function isBackfillDone() {
  return syncStateRepo.get(BACKFILL_DONE_KEY) === 'true';
}

/** Walks every event ever posted on the server and syncs its full detail. Runs once, at first boot. */
async function runBackfill() {
  if (isBackfillDone()) {
    logger.info('Backfill already completed, skipping');
    return;
  }

  logger.info('Starting backfill of full event history');
  const raw = await client.getServerEvents(config.raidHelper.serverId);

  // NOTE: the response reports `pages`/`currentPage`, implying pagination exists, but the query
  // param to request further pages isn't documented and hasn't been observed (single-page so far
  // for this server). If this ever fires, only page 1 was backfilled — investigate before trusting
  // the count.
  if (raw.pages && raw.pages > 1) {
    logger.warn({ pages: raw.pages }, 'Server events response is paginated but pagination is not implemented — only the first page was backfilled');
  }

  const eventIds = mapServerEventsList(raw).map((e) => e.id);

  logger.info({ count: eventIds.length }, 'Backfilling events');
  const failures = await eventSync.syncEvents(eventIds);

  syncStateRepo.set('last_poll_at', new Date().toISOString());

  if (failures > 0) {
    // Don't mark backfill done: some events (transient API errors, rate limiting, ...) never
    // synced. Idempotent upserts mean it's safe to retry the whole batch again next boot.
    logger.warn({ failures, total: eventIds.length }, 'Backfill finished with failures, will retry on next boot');
    return;
  }

  syncStateRepo.set(BACKFILL_DONE_KEY, 'true');
  logger.info('Backfill complete');
}

module.exports = { runBackfill, isBackfillDone };
