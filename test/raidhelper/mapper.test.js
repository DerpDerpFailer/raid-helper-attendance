import { describe, it, expect } from 'vitest';
const fs = require('node:fs');
const path = require('node:path');
const { mapEventWithSignups, mapServerEventsList } = require('../../src/raidhelper/mapper');

const sampleEvent = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'sample-event.json'), 'utf8')
);
const sampleServerEvents = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'sample-server-events.json'), 'utf8')
);

describe('raidhelper/mapper against real API fixtures', () => {
  it('maps event fields correctly', () => {
    const { event } = mapEventWithSignups(sampleEvent);
    expect(event.id).toBe(sampleEvent.id);
    expect(event.title).toBe(sampleEvent.title);
    expect(event.channelId).toBe(sampleEvent.channelId);
    expect(event.startTime).toBe(new Date(sampleEvent.startTime * 1000).toISOString());
  });

  it('derives sign-up status from className, not the always-"primary" status field', () => {
    const { signups } = mapEventWithSignups(sampleEvent);
    expect(signups.length).toBe(sampleEvent.signUps.length);

    const absenceSignup = signups.find((s) => s.status === 'Absence');
    expect(absenceSignup).toBeDefined();
    expect(absenceSignup.roleOrClass).toBeNull();

    const acceptedSignup = signups.find((s) => s.status === 'Accepted');
    expect(acceptedSignup).toBeDefined();
    expect(['Dps', 'Healer', 'Tank']).toContain(acceptedSignup.roleOrClass);

    const tentativeSignup = signups.find((s) => s.status === 'Tentative');
    expect(tentativeSignup).toBeDefined();
    expect(tentativeSignup.roleOrClass).toBeNull();
  });

  it('every signup gets a stable memberId and a parsed signedAt', () => {
    const { signups } = mapEventWithSignups(sampleEvent);
    for (const s of signups) {
      expect(typeof s.memberId).toBe('string');
      expect(s.memberId.length).toBeGreaterThan(0);
      expect(s.signedAt).not.toBeNull();
      expect(() => new Date(s.signedAt).toISOString()).not.toThrow();
    }
  });

  it('parses the server events list from the postedEvents wrapper', () => {
    const list = mapServerEventsList(sampleServerEvents);
    expect(list.length).toBe(sampleServerEvents.postedEvents.length);
    for (const item of list) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.startTimeMs).toBe('number');
    }
  });
});
