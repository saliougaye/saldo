import { describe, expect, it } from 'vitest';
import { tx } from './__tests__/fixtures';
import { EMPTY_FILTERS, type FilterLookup, filterTransactions, groupByDay } from './filters';

const lookup: FilterLookup = {
  accountName: (id) => ({ 'acc-card': 'Carta', 'acc-checking': 'Conto corrente' })[id] ?? '',
  categoryName: (id) =>
    ({ 'cat-groceries': 'Spesa', 'cat-supermarket': 'Supermercato', 'cat-bars': 'Caffè e bar' })[
      id
    ] ?? '',
  categoryParentId: (id) => (id === 'cat-supermarket' ? 'cat-groceries' : null),
};

const coffee = tx({
  id: 'coffee',
  date: '2026-04-18',
  amount: 260,
  categoryId: 'cat-bars',
  description: 'Bar Centrale',
  tagIds: ['tag-work'],
});
const market = tx({
  id: 'market',
  date: '2026-04-18',
  amount: 5630,
  categoryId: 'cat-supermarket',
  description: 'Esselunga',
});
const salary = tx({
  id: 'salary',
  date: '2026-04-17',
  amount: 231000,
  kind: 'income',
  categoryId: 'cat-salary',
  accountId: 'acc-checking',
});
const transfer = tx({
  id: 'transfer',
  date: '2026-04-17',
  amount: 50000,
  kind: 'transfer',
  categoryId: null,
  accountId: 'acc-checking',
  toAccountId: 'acc-card',
});
const excluded = tx({
  id: 'excluded',
  date: '2026-04-16',
  amount: 9000,
  categoryId: 'cat-groceries',
  excludeFromTotals: true,
});
const all = [coffee, market, salary, transfer, excluded];

function ids(filters: Partial<typeof EMPTY_FILTERS>): string[] {
  return filterTransactions(all, { ...EMPTY_FILTERS, ...filters }, lookup).map((t) => t.id);
}

describe('filterTransactions', () => {
  it('searches description, category and account names ignoring accents', () => {
    expect(ids({ query: 'caffe' })).toEqual(['coffee']);
    expect(ids({ query: 'SUPERMERCATO' })).toEqual(['market']);
    expect(ids({ query: 'conto corrente' })).toEqual(['salary', 'transfer']);
  });

  it('searches the destination account of a transfer', () => {
    // Without it a transfer is unreachable from the name of the account it landed in, which is
    // usually the account the user is thinking of.
    expect(ids({ query: 'carta' })).toEqual(['coffee', 'market', 'transfer', 'excluded']);
  });

  it('hides transfers from both directions, since they are neither', () => {
    expect(ids({ direction: 'income' })).toEqual(['salary']);
    expect(ids({ direction: 'expense' })).toEqual(['coffee', 'market', 'excluded']);
  });

  it('filters by account on either side of a transfer', () => {
    expect(ids({ accountId: 'acc-checking' })).toEqual(['salary', 'transfer']);
  });

  it('matches a parent category through its children', () => {
    expect(ids({ categoryId: 'cat-groceries' })).toEqual(['market', 'excluded']);
  });
});

describe('groupByDay', () => {
  it('groups newest first with counted expense totals', () => {
    const groups = groupByDay(all);
    expect(groups.map((g) => [g.date, g.items.map((t) => t.id), g.expenseTotal])).toEqual([
      ['2026-04-18', ['coffee', 'market'], 5890],
      ['2026-04-17', ['salary', 'transfer'], 0],
      ['2026-04-16', ['excluded'], 0],
    ]);
  });
});
