import { describe, expect, it } from 'vitest';
import { tx } from './__tests__/fixtures';
import {
  EMPTY_FILTERS,
  type FilterLookup,
  filtersFromParams,
  filterTransactions,
  groupByDay,
  hasActiveFilters,
  normalizeText,
} from './filters';

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

describe('normalizeText', () => {
  it('strips accents, case and extra spaces', () => {
    expect(normalizeText('  Caffè   E Bar ')).toBe('caffe e bar');
  });
});

describe('hasActiveFilters', () => {
  it('detects any active filter', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, onlyExcluded: true })).toBe(true);
  });
});

describe('filterTransactions', () => {
  it('returns everything without filters', () => {
    expect(ids({})).toEqual(['coffee', 'market', 'salary', 'transfer', 'excluded']);
  });

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

  it('lists only transfers when the direction says so', () => {
    expect(ids({ direction: 'transfer' })).toEqual(['transfer']);
  });

  it('filters by account on either side of a transfer', () => {
    expect(ids({ accountId: 'acc-checking' })).toEqual(['salary', 'transfer']);
  });

  it('matches a parent category through its children', () => {
    expect(ids({ categoryId: 'cat-groceries' })).toEqual(['market', 'excluded']);
  });

  it('filters by tags and excluded flag', () => {
    expect(ids({ tagIds: ['tag-work', 'tag-other'] })).toEqual(['coffee']);
    expect(ids({ onlyExcluded: true })).toEqual(['excluded']);
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

describe('filtersFromParams', () => {
  it('opens the whole list when nothing was asked for', () => {
    expect(filtersFromParams({})).toEqual(EMPTY_FILTERS);
  });

  it('seeds the account, the direction and the excluded flag', () => {
    expect(
      filtersFromParams({ accountId: 'acc-1', direction: 'expense', onlyExcluded: '1' }),
    ).toEqual({ ...EMPTY_FILTERS, accountId: 'acc-1', direction: 'expense', onlyExcluded: true });
  });

  it('reads transfer out of a link, like the other two directions', () => {
    expect(filtersFromParams({ direction: 'transfer' }).direction).toBe('transfer');
  });

  it('drops a direction it does not recognise rather than guessing one', () => {
    expect(filtersFromParams({ direction: 'refund' }).direction).toBe('all');
    expect(filtersFromParams({ direction: '' }).direction).toBe('all');
  });

  it('reads a blank param as absent, which is how a spent one comes back', () => {
    expect(filtersFromParams({ accountId: '', direction: '', onlyExcluded: '' })).toEqual(
      EMPTY_FILTERS,
    );
  });

  it('treats any value other than the flag itself as not excluded', () => {
    expect(filtersFromParams({ onlyExcluded: '0' }).onlyExcluded).toBe(false);
    expect(filtersFromParams({}).onlyExcluded).toBe(false);
  });
});
