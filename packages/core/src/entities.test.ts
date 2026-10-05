import { describe, expect, it } from 'vitest';
import { type Transaction, transactionSchema } from './entities';

const meta = {
  id: '0191e0b2-0000-7000-8000-000000000001',
  createdAt: '2026-04-18T10:00:00.000Z',
  updatedAt: '001776506400000-0000-device1',
  deletedAt: null,
};

const expense: Transaction = {
  ...meta,
  kind: 'expense',
  amount: 4500,
  date: '2026-04-18',
  accountId: 'acc-card',
  toAccountId: null,
  categoryId: 'cat-fuel',
  description: 'Benzina Q8',
  note: null,
  tagIds: [],
  excludeFromTotals: false,
  recurrenceId: null,
};

function issuePaths(input: unknown): string[] {
  const result = transactionSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join('.'));
}

describe('transactionSchema', () => {
  it('requires a different destination and no category for transfers', () => {
    const transfer = { ...expense, kind: 'transfer', categoryId: null, toAccountId: 'acc-savings' };
    expect(transactionSchema.safeParse(transfer).success).toBe(true);
    expect(issuePaths({ ...transfer, toAccountId: 'acc-card' })).toContain('toAccountId');
    expect(issuePaths({ ...transfer, categoryId: 'cat-fuel' })).toContain('categoryId');
  });

  it('requires sync timestamps to be ISO-8601 instants in UTC', () => {
    expect(
      transactionSchema.safeParse({ ...expense, createdAt: '2026-04-18T10:00:00Z' }).success,
    ).toBe(true);
    for (const createdAt of [
      '2026-04-18T10:00:00+02:00',
      '2026-04-18T10:00:00',
      '2026-04-18T10:00',
      '2026-02-30T10:00:00.000Z',
      '2026-04-18',
    ]) {
      expect(transactionSchema.safeParse({ ...expense, createdAt }).success).toBe(false);
    }
  });
});
