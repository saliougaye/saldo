import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listUpcomingTool } from './listUpcoming';

describe('list_upcoming', () => {
  it('merges the one-off rows ahead of today with each live recurrence’s next date, soonest first', () => {
    const result = listUpcomingTool.run(fixtureData(), CONTEXT, {});
    // The dinner on the 25th is one-off; October's salary and rent are already materialised, but
    // they are the recurrences' own occurrences, so they come once, as the recurrence.
    expect(result.items.map((item) => [item.kind, item.id, item.date])).toEqual([
      ['transaction', 'tx-sep-dinner', '2026-09-25'],
      ['recurrence', 'r-salary', '2026-10-01'],
      ['recurrence', 'r-rent', '2026-10-05'],
    ]);
  });

  it('describes a one-off transaction as list_transactions does', () => {
    const result = listUpcomingTool.run(fixtureData(), CONTEXT, {});
    expect(result.items[0]).toEqual({
      kind: 'transaction',
      id: 'tx-sep-dinner',
      date: '2026-09-25',
      transactionKind: 'expense',
      amount: { minor: 1500, currency: 'EUR', amount: '15.00' },
      description: 'Cena',
      note: null,
      accountId: 'a-main',
      accountName: 'Conto corrente',
      toAccountId: null,
      toAccountName: null,
      categoryId: 'c-food',
      categoryName: 'Spesa',
      excludeFromTotals: false,
    });
  });

  it('describes a recurrence with its schedule, and the monthly totals', () => {
    const result = listUpcomingTool.run(fixtureData(), CONTEXT, {});
    expect(result.monthly).toEqual({
      expense: { minor: 80000, currency: 'EUR', amount: '800.00' },
      income: { minor: 250000, currency: 'EUR', amount: '2500.00' },
    });
    expect(result.items[2]).toEqual({
      kind: 'recurrence',
      id: 'r-rent',
      date: '2026-10-05',
      transactionKind: 'expense',
      amount: { minor: 80000, currency: 'EUR', amount: '800.00' },
      description: 'Affitto',
      accountId: 'a-main',
      accountName: 'Conto corrente',
      toAccountId: null,
      toAccountName: null,
      categoryId: 'c-home',
      categoryName: 'Casa',
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-01-05',
      endDate: null,
    });
  });

  it('leaves out a row dated today: it is no longer ahead', () => {
    const result = listUpcomingTool.run(fixtureData(), { ...CONTEXT, today: '2026-09-25' }, {});
    expect(result.items.map((item) => item.id)).toEqual(['r-salary', 'r-rent']);
  });

  it('leaves out a recurrence that has ended', () => {
    const data = fixtureData();
    data.recurrences = data.recurrences.map((recurrence) =>
      recurrence.id === 'r-rent' ? { ...recurrence, endDate: '2026-09-05' } : recurrence,
    );
    const result = listUpcomingTool.run(data, CONTEXT, {});
    expect(result.items.map((item) => item.id)).toEqual(['tx-sep-dinner', 'r-salary']);
    expect(result.monthly.expense.minor).toBe(0);
  });
});
