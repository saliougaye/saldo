import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listBudgetsTool } from './listBudgets';

describe('list_budgets', () => {
  it('lists the budgets in the user’s order with their progress', () => {
    const result = listBudgetsTool.run(fixtureData(), CONTEXT, {});
    expect(result.period).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(result.budgets.map((budget) => budget.id)).toEqual(['b-food', 'b-home']);
    expect(result.budgets[0]).toEqual({
      id: 'b-food',
      name: 'Spesa',
      categoryIds: ['c-food'],
      window: 'period',
      range: { start: '2026-09-01', end: '2026-09-30' },
      amount: { minor: 20000, currency: 'EUR', amount: '200.00' },
      limit: { minor: 20000, currency: 'EUR', amount: '200.00' },
      // The supermarket child and the market; the dinner ahead does not count yet.
      spent: { minor: 7050, currency: 'EUR', amount: '70.50' },
      ratio: 7050 / 20000,
      pace: 0.5,
      overPace: false,
      overLimit: false,
      alertThreshold: 80,
      alertReached: false,
      rollover: false,
      daysLeft: 15,
      open: true,
      updatedAt: expect.any(String),
    });
  });

  it('says when a budget is over its limit and its alert fired', () => {
    const home = listBudgetsTool
      .run(fixtureData(), CONTEXT, {})
      .budgets.find((budget) => budget.id === 'b-home');
    expect(home).toMatchObject({
      window: 'month',
      spent: { minor: 80000 },
      limit: { minor: 75000 },
      overLimit: true,
      alertReached: true,
    });
  });

  it('reads a past period', () => {
    const result = listBudgetsTool.run(fixtureData(), CONTEXT, { period: 'previous' });
    expect(result.budgets[0]).toMatchObject({ spent: { minor: 15000 }, open: false });
  });
});
