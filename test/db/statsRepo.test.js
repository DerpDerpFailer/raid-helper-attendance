import { describe, it, expect, beforeAll } from 'vitest';

process.env.DISCORD_TOKEN = 'test';
process.env.DISCORD_CLIENT_ID = 'test';
process.env.DISCORD_GUILD_ID = 'test';
process.env.RAIDHELPER_API_KEY = 'test';
process.env.RAIDHELPER_SERVER_ID = 'test';
process.env.DB_PATH = ':memory:';

const { migrate } = require('../../src/db/migrate');
const { getDb } = require('../../src/db/connection');
const statsRepo = require('../../src/db/repositories/statsRepo');
const settingsRepo = require('../../src/db/repositories/settingsRepo');

function seedMember(id, displayName) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO members (id, display_name, is_active, joined_at, first_seen_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?)
  `).run(id, displayName, now, now, now);
}

function seedSnapshot(periodId, memberId, globalRank, scoreGlobal) {
  const db = getDb();
  db.prepare(`
    INSERT INTO stats_snapshots (
      period_id, member_id, member_joined_at, total_events, responses, presences, absences,
      response_rate, presence_rate, absence_rate, score_global, eligible, global_rank
    ) VALUES (?, ?, ?, 5, 5, 5, 0, 1, 1, 0, ?, 1, ?)
  `).run(periodId, memberId, new Date().toISOString(), scoreGlobal, globalRank);
}

describe('db/repositories/statsRepo getEvolution', () => {
  let currentPeriodId;
  let previousPeriodId;

  beforeAll(() => {
    migrate();
    seedMember('alice', 'Alice');
    seedMember('bob', 'Bob');

    previousPeriodId = statsRepo.upsertPeriod('week-2026-W01', '2026-01-05T00:00:00.000Z', '2026-01-12T00:00:00.000Z');
    currentPeriodId = statsRepo.upsertPeriod('week-2026-W02', '2026-01-12T00:00:00.000Z', '2026-01-19T00:00:00.000Z');

    // Alice: was rank 2, now rank 22 (a 20-rank drop) — a real dropout.
    seedSnapshot(previousPeriodId, 'alice', 2, 0.90);
    seedSnapshot(currentPeriodId, 'alice', 22, 0.70);

    // Bob: barely moved (rank 5 -> 6), shouldn't trigger anything with default thresholds.
    seedSnapshot(previousPeriodId, 'bob', 5, 0.80);
    seedSnapshot(currentPeriodId, 'bob', 6, 0.78);
  });

  it('flags Alert (not Critical) for Alice under the default thresholds (15/0.15, 30/0.30)', () => {
    const rows = statsRepo.getEvolution(currentPeriodId, previousPeriodId);
    const alice = rows.find((r) => r.member_id === 'alice');
    const bob = rows.find((r) => r.member_id === 'bob');

    expect(alice.rank_change).toBe(-20);
    expect(alice.alert_level).toBe('Alert'); // -20 <= -15 but not <= -30
    expect(bob.alert_level).toBeNull();
  });

  it('respects custom thresholds set via /setup dropout-thresholds', () => {
    // Alice: rank_change -20, score_delta -0.20. Raise BOTH the rank and score thresholds so
    // neither the "OR" condition fires — isolates that the rank threshold is actually read from
    // settings rather than still being the hardcoded default.
    settingsRepo.setDropoutThresholds({ alertRank: 25, alertScore: 0.5 });
    try {
      const rows = statsRepo.getEvolution(currentPeriodId, previousPeriodId);
      expect(rows.find((r) => r.member_id === 'alice').alert_level).toBeNull();
    } finally {
      settingsRepo.setDropoutThresholds({ alertRank: 15, alertScore: 0.15 }); // restore defaults
    }

    // Now lower the critical rank threshold below 20 so Alice's -20 crosses into Critical.
    settingsRepo.setDropoutThresholds({ criticalRank: 20, criticalScore: 0.5 });
    try {
      const rows = statsRepo.getEvolution(currentPeriodId, previousPeriodId);
      expect(rows.find((r) => r.member_id === 'alice').alert_level).toBe('Critical');
    } finally {
      settingsRepo.setDropoutThresholds({ criticalRank: 30, criticalScore: 0.30 }); // restore defaults
    }
  });
});
