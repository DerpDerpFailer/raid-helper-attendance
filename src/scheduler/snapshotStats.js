const engine = require('../stats/engine');

/** Recomputes the current period's stats (and the previous one, if never computed before). */
function snapshotStats() {
  return engine.ensureCurrentAndPreviousSnapshots();
}

module.exports = { snapshotStats };
