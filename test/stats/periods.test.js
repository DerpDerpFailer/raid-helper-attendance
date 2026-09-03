import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

process.env.DISCORD_TOKEN = 'test';
process.env.DISCORD_CLIENT_ID = 'test';
process.env.DISCORD_GUILD_ID = 'test';
process.env.RAIDHELPER_API_KEY = 'test';
process.env.RAIDHELPER_SERVER_ID = 'test';
process.env.DB_PATH = ':memory:';

const { migrate } = require('../../src/db/migrate');
const settingsRepo = require('../../src/db/repositories/settingsRepo');
const periods = require('../../src/stats/periods');

describe('stats/periods', () => {
  beforeAll(() => {
    migrate();
  });

  beforeEach(() => {
    settingsRepo.setPeriodMode('week');
  });

  it('week mode: current period is Monday 00:00 UTC to next Monday, previous is the week before', () => {
    // Wednesday 2026-09-02T12:00:00Z
    const ref = new Date('2026-09-02T12:00:00Z');
    const current = periods.getCurrentPeriod(ref);
    expect(current.start.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(current.end.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(current.label).toBe('week-2026-W36');

    const previous = periods.getPreviousPeriod(current);
    expect(previous.start.toISOString()).toBe('2026-08-24T00:00:00.000Z');
    expect(previous.end.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(previous.label).toBe('week-2026-W35');
  });

  it('month mode: current period is the calendar month, previous is the month before', () => {
    settingsRepo.setPeriodMode('month');

    const ref = new Date('2026-09-02T12:00:00Z');
    const current = periods.getCurrentPeriod(ref);
    expect(current.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(current.end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(current.label).toBe('month-2026-09');

    const previous = periods.getPreviousPeriod(current);
    expect(previous.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(previous.end.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(previous.label).toBe('month-2026-08');
  });

  it('rolling mode: current period is the last N days through today, previous is the N days before that', () => {
    settingsRepo.setPeriodMode('rolling');
    settingsRepo.setPeriodRollingDays(30);

    const ref = new Date('2026-09-02T12:00:00Z');
    const current = periods.getCurrentPeriod(ref);
    expect(current.end.toISOString()).toBe('2026-09-03T00:00:00.000Z');
    expect(current.start.toISOString()).toBe('2026-08-04T00:00:00.000Z');
    expect(current.label).toBe('rolling30-2026-09-02');

    const previous = periods.getPreviousPeriod(current);
    expect(previous.end.toISOString()).toBe('2026-08-04T00:00:00.000Z');
    expect(previous.start.toISOString()).toBe('2026-07-05T00:00:00.000Z');
  });
});
