import { describe, it, expect, beforeAll } from 'vitest';

process.env.DISCORD_TOKEN = 'test';
process.env.DISCORD_CLIENT_ID = 'test';
process.env.DISCORD_GUILD_ID = 'test';
process.env.RAIDHELPER_API_KEY = 'test';
process.env.RAIDHELPER_SERVER_ID = 'test';
process.env.DB_PATH = ':memory:';
process.env.ELIGIBILITY_MIN_DAYS = '14';

const { migrate } = require('../../src/db/migrate');
const { getDb } = require('../../src/db/connection');
const engine = require('../../src/stats/engine');

const PERIOD_START = new Date('2026-08-31T00:00:00.000Z');
const PERIOD_END = new Date('2026-09-07T00:00:00.000Z');
// Fixed reference "now" for every existing assertion below, so they don't depend on the real
// wall clock (and don't silently start failing once real time passes PERIOD_END).
const NOW = PERIOD_END;

function seedMember(id, displayName, joinedAt, { isActive = 1, leftAt = null } = {}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO members (id, display_name, is_active, joined_at, left_at, first_seen_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, displayName, isActive, joinedAt, leftAt, joinedAt, joinedAt);
}

function seedEvent(id, startTime) {
  const db = getDb();
  db.prepare(`
    INSERT INTO events (id, title, start_time, last_synced_at) VALUES (?, ?, ?, ?)
  `).run(id, `Event ${id}`, startTime, startTime);
}

function seedSignup(eventId, memberId, status) {
  const db = getDb();
  db.prepare(`
    INSERT INTO signups (event_id, member_id, status, updated_at) VALUES (?, ?, ?, ?)
  `).run(eventId, memberId, status, new Date().toISOString());
}

describe('stats/engine computeSnapshotRows', () => {
  beforeAll(() => {
    migrate();

    // Long-tenured, eligible members (joined well before the period).
    seedMember('alice', 'Alice', '2026-01-01T00:00:00.000Z');
    seedMember('bob', 'Bob', '2026-01-01T00:00:00.000Z');
    seedMember('carol', 'Carol', '2026-01-01T00:00:00.000Z');
    // Departed member (left before the period started): history must remain untouched (his
    // evt1 sign-up below still exists), but he must not accrue phantom "missed" events for a
    // period he wasn't even a member for anymore.
    seedMember('dave', 'Dave', '2026-01-01T00:00:00.000Z', { isActive: 0, leftAt: '2026-08-15T00:00:00.000Z' });
    // Brand new member (joined 2 days before period end): not yet eligible (< 14 days tenure).
    seedMember('erin', 'Erin', '2026-09-05T00:00:00.000Z');
    // Long-tenured but has never signed up for anything — the "no sign-up" case.
    seedMember('frank', 'Frank', '2026-01-01T00:00:00.000Z');

    seedEvent('evt1', '2026-09-01T20:00:00.000Z');
    seedEvent('evt2', '2026-09-03T20:00:00.000Z');
    seedEvent('evt3', '2026-09-06T20:00:00.000Z');
    // Not yet happened as of NOW (2026-09-07) even though it's already posted with a sign-up —
    // must not count toward anyone's denominator or numerator yet.
    seedEvent('evt4_future', '2026-09-10T20:00:00.000Z');

    // Alice: perfect attendance across all 3 events.
    seedSignup('evt1', 'alice', 'Accepted');
    seedSignup('evt2', 'alice', 'Accepted');
    seedSignup('evt3', 'alice', 'Accepted');

    // Bob: ties Alice on presence rate via Tentative (still counts present), but responds less.
    seedSignup('evt1', 'bob', 'Tentative');
    seedSignup('evt2', 'bob', 'Accepted');
    seedSignup('evt3', 'bob', 'Accepted');

    // Carol: one explicit absence, one no-response.
    seedSignup('evt1', 'carol', 'Absence');
    seedSignup('evt2', 'carol', 'Accepted');

    // Dave (inactive) still has historical sign-ups that must not be deleted.
    seedSignup('evt1', 'dave', 'Accepted');

    // Erin signs everything she can but hasn't cleared the eligibility tenure yet.
    seedSignup('evt3', 'erin', 'Accepted');

    // Alice already signed up for the future event — shouldn't matter, it hasn't happened yet.
    seedSignup('evt4_future', 'alice', 'Accepted');
  });

  it('computes rates correctly and excludes ineligible members from ranks', () => {
    const rows = engine.computeSnapshotRows(PERIOD_START, PERIOD_END, NOW);
    const byId = Object.fromEntries(rows.map((r) => [r.memberId, r]));

    expect(byId.alice.totalEvents).toBe(3);
    expect(byId.alice.responses).toBe(3);
    expect(byId.alice.presences).toBe(3);
    expect(byId.alice.presenceRate).toBeCloseTo(1);
    expect(byId.alice.eligible).toBe(1);

    // Carol: responded to 1/3 as present (evt2), 1/3 responded-but-absent (evt1), 1/3 no response.
    expect(byId.carol.responses).toBe(2);
    expect(byId.carol.presences).toBe(1);
    expect(byId.carol.presenceRate).toBeCloseTo(1 / 3);

    // Dave left before this period even started: no events fall in his membership window, so he
    // produces no row at all (not a row with eligible=0) — his historical evt1 sign-up is untouched
    // in the `signups` table, just outside every period computed from now on.
    expect(byId.dave).toBeUndefined();
  });

  it('applies competition-style ranking (ties share a rank, next rank skips)', () => {
    const rows = engine.computeSnapshotRows(PERIOD_START, PERIOD_END, NOW);
    const byId = Object.fromEntries(rows.map((r) => [r.memberId, r]));

    // Alice and Bob both have presence_rate = 1 (3/3) -> tied for rank 1 on presence.
    expect(byId.alice.presenceRank).toBe(1);
    expect(byId.bob.presenceRank).toBe(1);
    // Carol is third-lowest presence among the 3 eligible members -> rank 3, not 2 (competition ranking).
    expect(byId.carol.presenceRank).toBe(3);
  });

  it('excludes members below the eligibility tenure threshold from ranks', () => {
    const rows = engine.computeSnapshotRows(PERIOD_START, PERIOD_END, NOW);
    const erin = rows.find((r) => r.memberId === 'erin');

    expect(erin.eligible).toBe(0);
    expect(erin.globalRank).toBeNull();
    expect(erin.presenceRank).toBeNull();
    expect(erin.responseRank).toBeNull();
  });

  it('applies the 0.7/0.3 global score weighting', () => {
    const rows = engine.computeSnapshotRows(PERIOD_START, PERIOD_END, NOW);
    const bob = rows.find((r) => r.memberId === 'bob');

    const expectedScore = 0.7 * bob.presenceRate + 0.3 * bob.responseRate;
    expect(bob.scoreGlobal).toBeCloseTo(expectedScore);
  });

  it('tracks explicit Absence marks as a distinct metric from a low presence rate', () => {
    const rows = engine.computeSnapshotRows(PERIOD_START, PERIOD_END, NOW);
    const byId = Object.fromEntries(rows.map((r) => [r.memberId, r]));

    expect(byId.carol.absences).toBe(1);
    expect(byId.carol.absenceRate).toBeCloseTo(1 / 3);
    expect(byId.alice.absences).toBe(0);
    expect(byId.bob.absences).toBe(0);

    // Rank 1 = best (fewest absences) on this axis too, like every other axis: Alice, Bob and
    // Frank (0 absences each) tie for rank 1 -> Carol is next, rank 4 (competition ranking skips
    // ranks 2-3 for the 3-way tie ahead of her).
    expect(byId.alice.absenceRank).toBe(1);
    expect(byId.bob.absenceRank).toBe(1);
    expect(byId.carol.absenceRank).toBe(4);
  });

  it('excludes events that have not happened yet, even if already posted with sign-ups', () => {
    // Widen the period to include evt4_future (2026-09-10), but keep NOW at the original 2026-09-07
    // — the event still hasn't happened as of NOW, so it must not count yet either way.
    const widePeriodEnd = new Date('2026-09-14T00:00:00.000Z');
    const rows = engine.computeSnapshotRows(PERIOD_START, widePeriodEnd, NOW);
    const alice = rows.find((r) => r.memberId === 'alice');

    expect(alice.totalEvents).toBe(3);
    expect(alice.responses).toBe(3);

    // Once NOW moves past the event, it counts normally.
    const laterRows = engine.computeSnapshotRows(PERIOD_START, widePeriodEnd, new Date('2026-09-11T00:00:00.000Z'));
    const aliceLater = laterRows.find((r) => r.memberId === 'alice');
    expect(aliceLater.totalEvents).toBe(4);
    expect(aliceLater.responses).toBe(4);
  });
});

describe('stats/engine getNoSignupMembers', () => {
  it('lists tracked members with zero sign-ups in the window, with last-signup context', () => {
    const { eventsInWindow, members } = engine.getNoSignupMembers(7, NOW);

    // evt1 (09-01), evt2 (09-03), evt3 (09-06) all fall in [NOW-7d, NOW] = [08-31, 09-07].
    expect(eventsInWindow).toBe(3);

    const ids = members.map((m) => m.member_id);
    expect(ids).toContain('frank'); // never signed up for anything
    expect(ids).not.toContain('alice'); // signed all 3
    expect(ids).not.toContain('carol'); // signed at least one (evt1, as Absence — still a sign-up)
    expect(ids).not.toContain('erin'); // not yet eligible, excluded from "tracked" entirely
    expect(ids).not.toContain('dave'); // inactive, excluded

    const frank = members.find((m) => m.member_id === 'frank');
    expect(frank.last_signed_event_at).toBeNull();
  });

  it('reports zero events rather than a misleading empty list when the window has no events', () => {
    const { eventsInWindow, members } = engine.getNoSignupMembers(7, new Date('2026-01-15T00:00:00.000Z'));
    expect(eventsInWindow).toBe(0);
    expect(members).toEqual([]);
  });
});
