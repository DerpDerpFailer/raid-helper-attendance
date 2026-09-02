import { describe, it, expect, beforeEach } from 'vitest';

process.env.DISCORD_TOKEN = 'test';
process.env.DISCORD_CLIENT_ID = 'test';
process.env.DISCORD_GUILD_ID = 'test';
process.env.RAIDHELPER_API_KEY = 'test';
process.env.RAIDHELPER_SERVER_ID = 'test';

const config = require('../../src/config');

describe('stats/periods', () => {
  beforeEach(() => {
    config.stats.periodMode = 'week';
  });

  it('week mode: current period is Monday 00:00 UTC to next Monday, previous is the week before', () => {
    delete require.cache[require.resolve('../../src/stats/periods')];
    const periods = require('../../src/stats/periods');

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
    config.stats.periodMode = 'month';
    delete require.cache[require.resolve('../../src/stats/periods')];
    const periods = require('../../src/stats/periods');

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
    config.stats.periodMode = 'rolling';
    config.stats.periodRollingDays = 30;
    delete require.cache[require.resolve('../../src/stats/periods')];
    const periods = require('../../src/stats/periods');

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
