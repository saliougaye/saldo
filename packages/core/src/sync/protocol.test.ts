import { describe, expect, it } from 'vitest';
import { syncChangeSchema } from './protocol';

const change = {
  entity: 'transaction',
  id: '01920000-0000-7000-8000-000000000000',
  updatedAt: '001775000000000-0000-device-a',
  deletedAt: null,
  data: {
    id: '01920000-0000-7000-8000-000000000000',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '001775000000000-0000-device-a',
    deletedAt: null,
    kind: 'expense',
    amount: 1234,
    date: '2026-09-10',
    accountId: '01920000-0000-7000-8000-000000000001',
    toAccountId: null,
    categoryId: '01920000-0000-7000-8000-000000000002',
    description: 'Coffee',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  },
};

describe('syncChangeSchema', () => {
  it('rejects an envelope that disagrees with its data', () => {
    expect(syncChangeSchema.safeParse({ ...change, id: 'other' }).success).toBe(false);
    expect(
      syncChangeSchema.safeParse({ ...change, updatedAt: '001775000000001-0000-device-a' }).success,
    ).toBe(false);
    expect(
      syncChangeSchema.safeParse({ ...change, deletedAt: '2026-09-10T10:00:00.000Z' }).success,
    ).toBe(false);
  });
});
