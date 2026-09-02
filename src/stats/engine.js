const { getDb } = require('../db/connection');
const config = require('../config');
const statsRepo = require('../db/repositories/statsRepo');
const periods = require('./periods');
const logger = require('../utils/logger');

const SNAPSHOT_QUERY = `
WITH base AS (
  SELECT m.id AS member_id, m.joined_at, m.is_active, COUNT(e.id) AS total_events
  FROM members m
  JOIN events e
    ON e.start_time >= @periodStart AND e.start_time < @periodEnd
   AND e.start_time >= m.joined_at
   AND (m.is_active = 1 OR m.left_at IS NULL OR e.start_time <= m.left_at)
  GROUP BY m.id
),
signed AS (
  SELECT s.member_id, COUNT(*) AS responses, SUM(s.is_present) AS presences
  FROM signups s JOIN events e ON e.id = s.event_id
  WHERE e.start_time >= @periodStart AND e.start_time < @periodEnd
  GROUP BY s.member_id
),
computed AS (
  SELECT b.member_id, b.joined_at, b.total_events,
    COALESCE(sg.responses, 0) AS responses,
    COALESCE(sg.presences, 0) AS presences,
    CASE WHEN b.total_events > 0 THEN CAST(COALESCE(sg.responses, 0) AS REAL) / b.total_events ELSE 0 END AS response_rate,
    CASE WHEN b.total_events > 0 THEN CAST(COALESCE(sg.presences, 0) AS REAL) / b.total_events ELSE 0 END AS presence_rate,
    CASE WHEN b.is_active = 1 AND (julianday(@periodEnd) - julianday(b.joined_at)) >= @eligibilityMinDays
         THEN 1 ELSE 0 END AS eligible
  FROM base b LEFT JOIN signed sg ON sg.member_id = b.member_id
),
scored AS (
  SELECT *, (0.7 * presence_rate + 0.3 * response_rate) AS score_global FROM computed
)
SELECT
  member_id, joined_at, total_events, responses, presences,
  response_rate, presence_rate, score_global, eligible,
  CASE WHEN eligible = 1 THEN RANK() OVER (ORDER BY CASE WHEN eligible = 1 THEN score_global END DESC) END AS global_rank,
  CASE WHEN eligible = 1 THEN RANK() OVER (ORDER BY CASE WHEN eligible = 1 THEN presence_rate END DESC) END AS presence_rank,
  CASE WHEN eligible = 1 THEN RANK() OVER (ORDER BY CASE WHEN eligible = 1 THEN response_rate END DESC) END AS response_rank
FROM scored;
`;

/** Computes per-member stats rows for [periodStart, periodEnd). Pure read, no writes. */
function computeSnapshotRows(periodStart, periodEnd) {
  const db = getDb();
  const rows = db.prepare(SNAPSHOT_QUERY).all({
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    eligibilityMinDays: config.stats.eligibilityMinDays,
  });

  return rows.map((r) => ({
    memberId: r.member_id,
    joinedAt: r.joined_at,
    totalEvents: r.total_events,
    responses: r.responses,
    presences: r.presences,
    responseRate: r.response_rate,
    presenceRate: r.presence_rate,
    scoreGlobal: r.score_global,
    eligible: r.eligible,
    globalRank: r.global_rank,
    presenceRank: r.presence_rank,
    responseRank: r.response_rank,
  }));
}

/** Recomputes and persists the snapshot for a given period, returns its period_id. */
function computeAndStorePeriod(period) {
  const periodId = statsRepo.upsertPeriod(period.label, period.start.toISOString(), period.end.toISOString());
  const rows = computeSnapshotRows(period.start, period.end);
  statsRepo.replaceSnapshots(periodId, rows);
  return periodId;
}

/**
 * Ensures both the current (live, always refreshed) and previous (frozen once complete)
 * period snapshots exist. Safe to call as often as needed (e.g. daily cron, or on demand).
 */
function ensureCurrentAndPreviousSnapshots() {
  const current = periods.getCurrentPeriod();
  const previous = periods.getPreviousPeriod(current);

  const currentPeriodId = computeAndStorePeriod(current);
  logger.info({ label: current.label }, 'Recomputed current period snapshot');

  let previousPeriodId;
  const existingPrevious = statsRepo.getPeriodByLabel(previous.label);
  if (existingPrevious) {
    previousPeriodId = existingPrevious.id;
  } else {
    previousPeriodId = computeAndStorePeriod(previous);
    logger.info({ label: previous.label }, 'Computed previous period snapshot (first time seen)');
  }

  return { current, previous, currentPeriodId, previousPeriodId };
}

module.exports = { computeSnapshotRows, computeAndStorePeriod, ensureCurrentAndPreviousSnapshots };
