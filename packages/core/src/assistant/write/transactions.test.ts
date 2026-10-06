import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../entities';
import { resolveTransactionInput } from './transactions';

const TODAY = '2026-09-29';

const stored: Transaction = {
  id: 'tx-1',
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: 'hlc-tx-1',
  deletedAt: null,
  kind: 'expense',
  amount: 4820,
  date: '2026-09-28',
  accountId: 'acc-main',
  toAccountId: null,
  categoryId: 'cat-food',
  description: 'Esselunga',
  note: 'kept by the server, not here',
  tagIds: ['tag-1'],
  excludeFromTotals: false,
  recurrenceId: null,
};

describe('resolveTransactionInput — create', () => {
  it('needs a kind to create', () => {
    const result = resolveTransactionInput({ amountMinor: 100 }, null, TODAY, 2);
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/kind/) });
  });

  it('refuses a category on a transfer and a destination on an expense', () => {
    expect(
      resolveTransactionInput({ kind: 'transfer', categoryId: 'cat-food' }, null, TODAY, 2).ok,
    ).toBe(false);
    expect(
      resolveTransactionInput({ kind: 'expense', toAccountId: 'acc-savings' }, null, TODAY, 2).ok,
    ).toBe(false);
  });
});

describe('resolveTransactionInput — update', () => {
  it('changes only the given fields and carries the version read', () => {
    const result = resolveTransactionInput(
      { id: 'tx-1', updatedAt: 'hlc-tx-1', amountMinor: 5000 },
      stored,
      TODAY,
      2,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'tx-1',
        kind: 'expense',
        buffer: '50',
        date: '2026-09-28',
        accountId: 'acc-main',
        toAccountId: null,
        categoryId: 'cat-food',
        description: 'Esselunga',
        tagIds: ['tag-1'],
        excludeFromTotals: false,
        expectedUpdatedAt: 'hlc-tx-1',
      },
    });
  });

  it('switching to a transfer drops the category, as the form does', () => {
    const result = resolveTransactionInput(
      { id: 'tx-1', updatedAt: 'hlc-tx-1', kind: 'transfer', toAccountId: 'acc-savings' },
      stored,
      TODAY,
      2,
    );
    expect(result.ok && result.value).toMatchObject({
      kind: 'transfer',
      categoryId: null,
      toAccountId: 'acc-savings',
    });
  });
});
