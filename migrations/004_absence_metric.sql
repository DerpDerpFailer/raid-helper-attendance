-- Dedicated "marks themselves absent" metric, distinct from a low presence rate: someone who
-- never signs up at all is a different problem from someone who dutifully signs up but often
-- flags Absence. Powers /flop axis:absence.
ALTER TABLE stats_snapshots ADD COLUMN absences INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stats_snapshots ADD COLUMN absence_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE stats_snapshots ADD COLUMN absence_rank INTEGER;
