import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { spendingByCategoryTool } from './spendingByCategory';

describe('spending_by_category', () => {
  it('rolls children into their parent, largest first, with shares', () => {
    expect(spendingByCategoryTool.run(fixtureData(), CONTEXT, { direction: 'expense' })).toEqual({
      period: { start: '2026-09-01', end: '2026-09-30' },
      direction: 'expense',
      total: { minor: 87050, currency: 'EUR', amount: '870.50' },
      categories: [
        {
          categoryId: 'c-home',
          name: 'Casa',
          amount: { minor: 80000, currency: 'EUR', amount: '800.00' },
          sharePercent: 92,
        },
        {
          categoryId: 'c-food',
          name: 'Spesa',
          amount: { minor: 7050, currency: 'EUR', amount: '70.50' },
          sharePercent: 8,
        },
      ],
    });
  });

  it('splits income on request', () => {
    const result = spendingByCategoryTool.run(fixtureData(), CONTEXT, { direction: 'income' });
    expect(result.categories).toEqual([
      {
        categoryId: 'c-salary',
        name: 'Stipendio',
        amount: { minor: 250000, currency: 'EUR', amount: '2500.00' },
        sharePercent: 100,
      },
    ]);
  });

  it('names nothing for a category that no longer exists', () => {
    const data = fixtureData();
    data.categories = data.categories.filter((category) => category.id !== 'c-home');
    const result = spendingByCategoryTool.run(data, CONTEXT, { direction: 'expense' });
    expect(result.categories[0]).toMatchObject({ categoryId: 'c-home', name: null });
  });
});
