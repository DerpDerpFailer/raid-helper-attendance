const config = require('../config');
const {
  addDays, mondayOfWeekContaining, isoWeekInfo, firstOfMonth, startOfUTCDate,
} = require('../utils/dates');

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

function dateStr(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Computes the {label, start, end} of the period (per PERIOD_MODE) containing `referenceDate`. */
function computePeriod(mode, referenceDate) {
  if (mode === 'week') {
    const start = mondayOfWeekContaining(referenceDate);
    const end = addDays(start, 7);
    const { isoYear, isoWeek } = isoWeekInfo(start);
    return { label: `week-${isoYear}-W${pad(isoWeek)}`, start, end };
  }

  if (mode === 'month') {
    const start = firstOfMonth(referenceDate);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { label: `month-${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`, start, end };
  }

  if (mode === 'rolling') {
    const days = config.stats.periodRollingDays;
    const end = addDays(startOfUTCDate(referenceDate), 1); // through the end of today
    const start = addDays(end, -days);
    return { label: `rolling${days}-${dateStr(startOfUTCDate(referenceDate))}`, start, end };
  }

  throw new Error(`Unknown period mode: ${mode}`);
}

/** The period containing "today" — live, recomputed daily, may be partial (e.g. mid-week). */
function getCurrentPeriod(referenceDate = new Date()) {
  return computePeriod(config.stats.periodMode, referenceDate);
}

/**
 * The period immediately preceding `currentPeriod` — always fully elapsed by construction,
 * since it ends exactly where the current period starts.
 */
function getPreviousPeriod(currentPeriod) {
  const prevReferenceDate = addDays(currentPeriod.start, -1);
  return computePeriod(config.stats.periodMode, prevReferenceDate);
}

module.exports = { getCurrentPeriod, getPreviousPeriod };
