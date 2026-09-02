const config = require('../config');
const logger = require('../utils/logger');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Raid-Helper's rate limit isn't documented; hitting it in practice (166-event backfill) showed
// firing requests back-to-back trips it almost immediately. This spaces out every request
// (not just retries) regardless of caller, so backfill/poll/manual sync all stay under it.
const MIN_REQUEST_INTERVAL_MS = 600;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

async function waitForSlot() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

/** Parses a Retry-After header (seconds, per HTTP spec) into milliseconds. Null if absent/invalid. */
function retryAfterMs(res) {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  return Number.isNaN(seconds) ? null : seconds * 1000;
}

async function request(path, { auth = false } = {}) {
  const url = `${config.raidHelper.baseUrl}${path}`;
  const headers = auth ? { Authorization: config.raidHelper.apiKey } : {};

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    await waitForSlot();

    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        const waitMs = retryAfterMs(res) ?? RETRY_DELAY_MS * 2 * attempt;
        logger.warn({ path, attempt, waitMs }, 'Raid-Helper API rate limit hit, backing off');
        if (attempt < MAX_RETRIES) await sleep(waitMs);
        lastError = new Error(`Raid-Helper API 429 Too Many Requests for ${path}`);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Raid-Helper API ${res.status} ${res.statusText} for ${path}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      logger.warn({ path, attempt, err: err.message }, 'Raid-Helper API request failed, retrying');
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

/** GET /events/{id} — full event data, including sign-ups. Public, no auth required. */
function getEvent(eventId) {
  return request(`/events/${eventId}`);
}

/** GET /servers/{id}/events — general data of every event on the server. Requires server API key. */
function getServerEvents(serverId) {
  return request(`/servers/${serverId}/events`, { auth: true });
}

/** GET /servers/{id}/scheduledevents — upcoming recurring events. Requires server API key. */
function getScheduledEvents(serverId) {
  return request(`/servers/${serverId}/scheduledevents`, { auth: true });
}

module.exports = { getEvent, getServerEvents, getScheduledEvents };
