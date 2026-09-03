const { getDb } = require('../connection');
const settingsRepo = require('./settingsRepo');

const RANK_COLUMN = {
  global: 'global_rank',
  presence: 'presence_rank',
  response: 'response_rank',
  absence: 'absence_rank',
};

function assertAxis(axis) {
  if (!RANK_COLUMN[axis]) {
    throw new Error(`Unknown ranking axis: ${axis}`);
  }
}

/** Creates the period row if missing, returns its id either way. */
function upsertPeriod(label, periodStart, periodEnd) {
  const db = getDb();
  db.prepare(`
    INSERT INTO stats_periods (label, period_start, period_end, computed_at)
    VALUES (@label, @periodStart, @periodEnd, @now)
    ON CONFLICT(label) DO UPDATE SET
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      computed_at = excluded.computed_at
  `).run({ label, periodStart, periodEnd, now: new Date().toISOString() });

  return db.prepare('SELECT id FROM stats_periods WHERE label = ?').get(label).id;
}

function getPeriodByLabel(label) {
  const db = getDb();
  return db.prepare('SELECT * FROM stats_periods WHERE label = ?').get(label);
}

/** Replaces every snapshot row for a period (delete + insert in one transaction). */
function replaceSnapshots(periodId, rows) {
  const db = getDb();

  const run = db.transaction(() => {
    db.prepare('DELETE FROM stats_snapshots WHERE period_id = ?').run(periodId);

    const insert = db.prepare(`
      INSERT INTO stats_snapshots (
        period_id, member_id, member_joined_at, total_events, responses, presences, absences,
        response_rate, presence_rate, absence_rate, score_global, eligible,
        global_rank, presence_rank, response_rank, absence_rank
      ) VALUES (
        @periodId, @memberId, @joinedAt, @totalEvents, @responses, @presences, @absences,
        @responseRate, @presenceRate, @absenceRate, @scoreGlobal, @eligible,
        @globalRank, @presenceRank, @responseRank, @absenceRank
      )
    `);

    for (const row of rows) {
      insert.run({ ...row, periodId });
    }
  });

  run();
}

function getSnapshot(periodId, memberId) {
  const db = getDb();
  return db.prepare('SELECT * FROM stats_snapshots WHERE period_id = ? AND member_id = ?')
    .get(periodId, memberId);
}

/** Top N by rank on the given axis (may return slightly more than `size` rows on ties, by design). */
function getTop(periodId, axis, size) {
  assertAxis(axis);
  const db = getDb();
  const col = RANK_COLUMN[axis];
  return db.prepare(`
    SELECT s.*, m.display_name FROM stats_snapshots s
    JOIN members m ON m.id = s.member_id
    WHERE s.period_id = ? AND s.${col} IS NOT NULL AND s.${col} <= ?
    ORDER BY s.${col} ASC
  `).all(periodId, size);
}

/** Flop N by rank on the given axis (worst ranks, ties included by design). */
function getFlop(periodId, axis, size) {
  assertAxis(axis);
  const db = getDb();
  const col = RANK_COLUMN[axis];
  const maxRankRow = db.prepare(`
    SELECT MAX(${col}) AS maxRank FROM stats_snapshots WHERE period_id = ? AND ${col} IS NOT NULL
  `).get(periodId);

  if (!maxRankRow || maxRankRow.maxRank === null) return [];

  const threshold = maxRankRow.maxRank - (size - 1);
  return db.prepare(`
    SELECT s.*, m.display_name FROM stats_snapshots s
    JOIN members m ON m.id = s.member_id
    WHERE s.period_id = ? AND s.${col} IS NOT NULL AND s.${col} >= ?
    ORDER BY s.${col} ASC
  `).all(periodId, threshold);
}

/**
 * Current vs previous period comparison for one member (used by /stats) or every eligible member
 * (used by /dropouts). Alert/Critical thresholds are configurable via /setup dropout-thresholds
 * (settingsRepo.getDropoutThresholds()), defaulting to -15/-0.15 (Alert) and -30/-0.30 (Critical).
 */
function getEvolution(currentPeriodId, previousPeriodId, memberId = null) {
  const db = getDb();
  const t = settingsRepo.getDropoutThresholds();
  const sql = `
    SELECT
      cur.member_id,
      m.display_name,
      cur.global_rank AS current_rank,
      prev.global_rank AS previous_rank,
      cur.score_global AS current_score,
      prev.score_global AS previous_score,
      CASE WHEN prev.global_rank IS NULL THEN NULL ELSE (prev.global_rank - cur.global_rank) END AS rank_change,
      CASE WHEN prev.score_global IS NULL THEN NULL ELSE (cur.score_global - prev.score_global) END AS score_delta,
      CASE
        WHEN prev.global_rank IS NULL THEN NULL
        WHEN (prev.global_rank - cur.global_rank) <= -@criticalRank OR (cur.score_global - prev.score_global) <= -@criticalScore THEN 'Critical'
        WHEN (prev.global_rank - cur.global_rank) <= -@alertRank OR (cur.score_global - prev.score_global) <= -@alertScore THEN 'Alert'
        ELSE NULL
      END AS alert_level
    FROM stats_snapshots cur
    JOIN members m ON m.id = cur.member_id
    LEFT JOIN stats_snapshots prev
      ON prev.member_id = cur.member_id AND prev.period_id = @previousPeriodId
    WHERE cur.period_id = @currentPeriodId AND cur.eligible = 1
    ${memberId ? 'AND cur.member_id = @memberId' : ''}
  `;

  return db.prepare(sql).all({
    previousPeriodId,
    currentPeriodId,
    memberId,
    alertRank: t.alertRank,
    alertScore: t.alertScore,
    criticalRank: t.criticalRank,
    criticalScore: t.criticalScore,
  });
}

module.exports = {
  upsertPeriod,
  getPeriodByLabel,
  replaceSnapshots,
  getSnapshot,
  getTop,
  getFlop,
  getEvolution,
};
