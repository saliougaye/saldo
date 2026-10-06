import { describe, expect, it } from 'vitest';
import { monthEndBalances, openingBalanceForCurrent } from './accountSeries';
import type { LedgerTx } from './ledger';

function tx(overrides: Partial<LedgerTx> & Pick<LedgerTx, 'date' | 'amount'>): LedgerTx {
  return {
    id: `${overrides.date}-${overrides.amount}`,
    kind: 'expense',
    accountId: 'acc-1',
    toAccountId: null,
    categoryId: 'cat-1',
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    description: '',
    ...overrides,
  };
}

describe('monthEndBalances', () => {
  it('returns one point per month, ending with the balance today', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 100000,
      txs: [tx({ date: '2026-02-10', amount: 20000 })],
      today: '2026-04-18',
      months: 3,
    });
    // Feb, Mar, Apr: the February expense lands in the first point and stays.
    expect(series).toEqual([80000, 80000, 80000]);
  });

  it('accumulates month by month', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 0,
      txs: [
        tx({ date: '2026-02-05', amount: 1000 }),
        tx({ date: '2026-03-05', amount: 2000 }),
        tx({ date: '2026-04-05', amount: 3000 }),
      ],
      today: '2026-04-18',
      months: 3,
    });
    expect(series).toEqual([-1000, -3000, -6000]);
  });

  it('counts both legs of a transfer', () => {
    const out = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 50000,
      txs: [
        tx({
          date: '2026-03-10',
          amount: 10000,
          kind: 'transfer',
          categoryId: null,
          toAccountId: 'acc-2',
        }),
      ],
      today: '2026-04-18',
      months: 2,
    });
    expect(out).toEqual([40000, 40000]);

    const incoming = monthEndBalances({
      accountId: 'acc-2',
      openingBalance: 0,
      txs: [
        tx({
          date: '2026-03-10',
          amount: 10000,
          kind: 'transfer',
          categoryId: null,
          accountId: 'acc-1',
          toAccountId: 'acc-2',
        }),
      ],
      today: '2026-04-18',
      months: 2,
    });
    expect(incoming).toEqual([10000, 10000]);
  });

  it('counts excluded transactions, like every balance does', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 0,
      txs: [tx({ date: '2026-04-01', amount: 5000, excludeFromTotals: true })],
      today: '2026-04-18',
      months: 1,
    });
    expect(series).toEqual([-5000]);
  });

  it('ignores rows dated after today', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 0,
      txs: [tx({ date: '2026-04-30', amount: 5000 })],
      today: '2026-04-18',
      months: 1,
    });
    expect(series).toEqual([0]);
  });
});

describe('openingBalanceForCurrent', () => {
  it('inverts the balance formula, so editing the current balance is exact', () => {
    const txs = [
      tx({ date: '2026-04-01', amount: 3000 }),
      tx({ date: '2026-04-02', amount: 1000, kind: 'income', categoryId: 'cat-salary' }),
    ];
    const opening = openingBalanceForCurrent({
      accountId: 'acc-1',
      currentBalance: 98000,
      txs,
      today: '2026-04-18',
    });
    expect(opening).toBe(100000);
  });
});
