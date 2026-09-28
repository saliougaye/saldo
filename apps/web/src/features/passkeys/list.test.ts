import { describe, expect, it } from 'vitest';
import { canDeletePasskey, passkeyRows } from './list';

const row = (over: Partial<Parameters<typeof passkeyRows>[0][number]> = {}) => ({
  id: 'p1',
  name: null,
  credentialId: 'c1',
  aaguid: null,
  backedUp: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

describe('passkeyRows', () => {
  it('puts the newest first', () => {
    const rows = passkeyRows(
      [
        row({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
        row({ id: 'new', createdAt: '2026-09-01T00:00:00.000Z' }),
      ],
      null,
    );
    expect(rows.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('marks the one that signed this browser in, by its credential', () => {
    const rows = passkeyRows(
      [row({ id: 'p1', credentialId: 'c1' }), row({ id: 'p2', credentialId: 'c2' })],
      'c2',
    );
    expect(rows.find((entry) => entry.id === 'p2')?.inUse).toBe(true);
    expect(rows.find((entry) => entry.id === 'p1')?.inUse).toBe(false);
  });

  it('marks none when this browser has signed nothing in', () => {
    expect(passkeyRows([row()], null).every((entry) => !entry.inUse)).toBe(true);
  });

  it('keeps a row with no date at the end rather than dropping it', () => {
    const rows = passkeyRows([row({ id: 'undated', createdAt: null }), row({ id: 'dated' })], null);
    expect(rows.map((entry) => entry.id)).toEqual(['dated', 'undated']);
  });
});

describe('canDeletePasskey', () => {
  it('refuses the last one (§17.1.7)', () => {
    expect(canDeletePasskey(1)).toBe(false);
    expect(canDeletePasskey(0)).toBe(false);
  });

  it('allows one of several', () => {
    expect(canDeletePasskey(2)).toBe(true);
  });
});
