const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUTCDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Monday 00:00 UTC of the week containing `date`. */
function mondayOfWeekContaining(date) {
  const d = startOfUTCDate(date);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  return addDays(d, -daysSinceMonday);
}

/** ISO-8601 week-year and week number for `date` (year can differ from getUTCFullYear() near Jan 1 / Dec 31). */
function isoWeekInfo(date) {
  const d = startOfUTCDate(date);
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  const thursday = addDays(d, 3 - dayNum); // nearest Thursday, same ISO week
  const firstThursdayYear = thursday.getUTCFullYear();
  const firstThursday = addDays(
    new Date(Date.UTC(firstThursdayYear, 0, 1)),
    (11 - new Date(Date.UTC(firstThursdayYear, 0, 1)).getUTCDay()) % 7 - 3
  );
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { isoYear: firstThursdayYear, isoWeek: week };
}

/** First day of the UTC month containing `date`. */
function firstOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

module.exports = { DAY_MS, startOfUTCDate, addDays, mondayOfWeekContaining, isoWeekInfo, firstOfMonth };
