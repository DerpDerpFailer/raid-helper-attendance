/**
 * Normalizes a raw Raid-Helper `GET /events/{id}` payload into {event, signups[]}.
 *
 * Field names below are verified against a real payload (see test/fixtures/sample-event.json,
 * captured 2026-09 from a live server). Two things this fixture revealed that were NOT what the
 * public docs/CSV export implied:
 *   - Each sign-up's `status` field is NOT the attendance status — it was "primary" for every
 *     single entry observed. The actual attendance status (a real class/role like "Healer"/"Tank"
 *     when Accepted, or a pseudo-status like "Absence"/"Tentative") lives in `className`.
 *   - The event payload has no top-level "status" field at all (open/closed isn't exposed
 *     directly); `closingTime` (single-event endpoint) / `closeTime` (server events list) are the
 *     closest signals, but aren't currently used.
 */

const SIGNUP_LIST_FIELDS = ['signUps', 'signups', 'SignUps'];

// Raid-Helper's built-in non-class response roles. Any other className value is treated as an
// actual class/role pick, implying an "Accepted" sign-up. Case-sensitive: matches observed data.
const PSEUDO_STATUS_CLASS_NAMES = new Set(['Absence', 'Tentative', 'Late', 'Bench', 'Declined']);

/**
 * Converts an unknown date representation (unix seconds, unix ms, or an ISO string) into an
 * ISO8601 string. Returns null instead of throwing on anything unparsable, so one unexpected
 * field never crashes the whole sync. Confirmed: the API uses unix seconds (e.g. startTime,
 * entryTime), handled by the "< 1e12 means seconds" branch below.
 */
function toIsoString(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value; // treat < 10^12 as seconds, else already ms
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) return toIsoString(asNumber);

  return null;
}

function pickSignupList(raw) {
  for (const field of SIGNUP_LIST_FIELDS) {
    if (Array.isArray(raw[field])) return raw[field];
  }
  return [];
}

/** True attendance status: className holds either a pseudo-status or a real class/role pick. */
function normalizeStatus(className) {
  if (!className) return 'Unknown';
  return PSEUDO_STATUS_CLASS_NAMES.has(className) ? className : 'Accepted';
}

function mapSignup(rawSignup) {
  const memberId = String(rawSignup.userId);
  const displayName = rawSignup.name ?? memberId;
  const status = normalizeStatus(rawSignup.className);
  const roleOrClass = status === 'Accepted' ? rawSignup.className : null;
  const signedAt = toIsoString(rawSignup.entryTime);

  return {
    memberId,
    displayName,
    status,
    roleOrClass,
    signedAt,
    rawJson: JSON.stringify(rawSignup),
  };
}

function mapEvent(raw) {
  const startTime = toIsoString(raw.startTime);
  if (!startTime) {
    throw new Error(`Unable to parse event start time from payload: ${JSON.stringify(raw.startTime)}`);
  }

  return {
    id: String(raw.id),
    title: raw.title ?? null,
    channelId: raw.channelId ? String(raw.channelId) : null,
    startTime,
    status: null, // the API exposes no open/closed flag; see file header
    rawJson: JSON.stringify(raw),
  };
}

function mapEventWithSignups(raw) {
  return {
    event: mapEvent(raw),
    signups: pickSignupList(raw).map(mapSignup),
  };
}

/**
 * Normalizes a `GET /servers/{id}/events` response into a flat list of {id, startTimeMs}.
 * Verified: the payload wraps its array in `postedEvents`, each item has `id` and `startTime`
 * (unix seconds) — see test/fixtures/sample-server-events.json.
 */
function mapServerEventsList(raw) {
  const list = Array.isArray(raw) ? raw : (raw.events ?? raw.postedEvents ?? []);
  return list.map((e) => {
    const iso = toIsoString(e.startTime);
    // Unparsable timestamp: report null rather than NaN, so callers can treat it as "always refresh"
    // instead of silently miscomparing NaN and never refreshing a stale/broken event.
    return { id: String(e.id), startTimeMs: iso ? new Date(iso).getTime() : null };
  });
}

module.exports = { mapEventWithSignups, mapServerEventsList, toIsoString };
