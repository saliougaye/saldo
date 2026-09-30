import { describe, expect, it } from 'vitest';
import { tombstoned, unstamped } from './rows';

describe('rows', () => {
  const row = { id: 'a', name: 'x', updatedAt: 'stamp', deletedAt: null };

  it('drops the stamp the clock will mint again', () => {
    expect(unstamped(row)).toEqual({ id: 'a', name: 'x', deletedAt: null });
  });

  it('makes a tombstone at the given instant', () => {
    expect(tombstoned(row, '2026-09-30T10:00:00.000Z')).toEqual({
      id: 'a',
      name: 'x',
      deletedAt: '2026-09-30T10:00:00.000Z',
    });
  });
});
