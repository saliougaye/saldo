import type { Budget } from '@saldo/core';
import { budgetFormFrom, emptyBudgetForm } from './budgetFormValues';

const budget: Budget = {
  id: 'b1',
  createdAt: '2026-09-19T10:00:00.000Z',
  updatedAt: '0000000000000-0000-a',
  deletedAt: null,
  name: 'Food',
  categoryIds: ['c1'],
  amount: 30000,
  period: 'period',
  alertThreshold: 90,
  rollover: false,
  icon: 'pizza',
  sortOrder: 0,
};

describe('budget form icon', () => {
  it('starts unchosen for a new budget, so it can follow the category', () => {
    expect(emptyBudgetForm().icon).toBeNull();
  });

  it('starts from the stored icon when editing', () => {
    expect(budgetFormFrom(budget, 2).icon).toBe('pizza');
  });
});
