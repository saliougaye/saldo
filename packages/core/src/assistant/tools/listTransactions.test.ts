import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { type ListTransactionsInput, listTransactionsTool } from './listTransactions';

function run(over: Partial<ListTransactionsInput> = {}) {
  return listTransactionsTool.run(fixtureData(), CONTEXT, { limit: 50, offset: 0, ...over });
}

describe('list_transactions', () => {
  it('lists the current period newest first, scheduled rows included and marked', () => {
    const result = run();
    expect(result.period).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(result.total).toBe(7);
    expect(result.transactions.map((tx) => tx.id)).toEqual([
      'tx-sep-dinner',
      'tx-sep-food',
      'tx-sep-excluded',
      'tx-sep-super',
      'r-rent:2026-09-05',
      'tx-sep-pocket',
      'r-salary:2026-09-01',
    ]);
    expect(result.transactions[0]?.upcoming).toBe(true);
    expect(result.transactions[1]?.upcoming).toBe(false);
  });

  it('adds up the rows up to today as the list does: excluded included, transfers apart', () => {
    expect(run().totals).toEqual({
      expense: { minor: 96950, currency: 'EUR', amount: '969.50' },
      income: { minor: 250000, currency: 'EUR', amount: '2500.00' },
      count: 6,
    });
  });

  it('names the account, the category and the tags the user typed', () => {
    const row = run().transactions.find((tx) => tx.id === 'tx-sep-super');
    expect(row).toMatchObject({
      date: '2026-09-08',
      kind: 'expense',
      amount: { minor: 4550, currency: 'EUR', amount: '45.50' },
      description: 'Esselunga',
      accountId: 'a-main',
      accountName: 'Conto corrente',
      categoryId: 'c-super',
      categoryName: 'Supermercato',
      tagIds: ['g-trip'],
      tagNames: ['Viaggio'],
      recurring: false,
      excludeFromTotals: false,
    });
    const transfer = run().transactions.find((tx) => tx.id === 'tx-sep-pocket');
    expect(transfer).toMatchObject({ toAccountId: 'a-pocket', toAccountName: 'Vacanze' });
  });

  it('filters by category, children included', () => {
    expect(run({ categoryId: 'c-food' }).transactions.map((tx) => tx.id)).toEqual([
      'tx-sep-dinner',
      'tx-sep-food',
      'tx-sep-super',
    ]);
  });

  it('filters by kind, tag, account and text', () => {
    expect(run({ kind: 'transfer' }).transactions.map((tx) => tx.id)).toEqual(['tx-sep-pocket']);
    expect(run({ tagId: 'g-trip' }).transactions.map((tx) => tx.id)).toEqual(['tx-sep-super']);
    expect(run({ accountId: 'a-pocket' }).transactions.map((tx) => tx.id)).toEqual([
      'tx-sep-pocket',
    ]);
    expect(run({ text: 'ESSELÜNGA' }).transactions.map((tx) => tx.id)).toEqual(['tx-sep-super']);
  });

  it('pages with limit and offset, the total counting every match', () => {
    const result = run({ limit: 2, offset: 1 });
    expect(result.transactions.map((tx) => tx.id)).toEqual(['tx-sep-food', 'tx-sep-excluded']);
    expect(result.total).toBe(7);
    expect(result.offset).toBe(1);
    expect(result.limit).toBe(2);
  });

  it('reads another period, or an explicit range', () => {
    expect(run({ period: 'previous' }).total).toBe(4);
    expect(run({ from: '2026-09-05', to: '2026-09-08' }).transactions.map((tx) => tx.id)).toEqual([
      'tx-sep-super',
      'r-rent:2026-09-05',
    ]);
  });
});
