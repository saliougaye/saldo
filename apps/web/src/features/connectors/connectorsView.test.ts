import { describe, expect, it } from 'vitest';
import { lastUsed } from './connectorsView';

/** Noon in Rome (CEST, UTC+2) on 3 October 2026. */
const NOW = new Date('2026-10-03T10:00:00.000Z');
const ROME = 'Europe/Rome';

describe('lastUsed', () => {
  it('is never for a connector that has not called yet', () => {
    expect(lastUsed(null, NOW, ROME)).toEqual({ kind: 'never' });
  });

  it('says today and yesterday in the user’s zone, not the server’s', () => {
    expect(lastUsed(new Date('2026-10-03T06:00:00.000Z'), NOW, ROME)).toEqual({ kind: 'today' });
    // 23:00 on 2 October in Rome.
    expect(lastUsed(new Date('2026-10-02T21:00:00.000Z'), NOW, ROME)).toEqual({
      kind: 'yesterday',
    });
    // 00:30 on 3 October in Rome, still 2 October in UTC.
    expect(lastUsed(new Date('2026-10-02T22:30:00.000Z'), NOW, ROME)).toEqual({ kind: 'today' });
  });

  it('gives the instant itself for anything older, for the page to format', () => {
    expect(lastUsed(new Date('2026-09-28T19:14:00.000Z'), NOW, ROME)).toEqual({
      kind: 'on',
      iso: '2026-09-28T19:14:00.000Z',
    });
  });
});
