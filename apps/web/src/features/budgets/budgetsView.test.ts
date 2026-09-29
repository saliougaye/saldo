import { type Budget, budgetSchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { homeView } from '../home/homeView';
import { dataWith, tx } from '../test/fixtures';
import { budgetsView } from './budgetsView';

const TODAY = '2026-09-20';
const DEF = { kind: 'month', startDay: 1 } as const;
const PERIOD = {
  range: { start: '2026-09-01', end: '2026-09-30' },
  isCurrent: true,
  elapsed: 20,
  length: 30,
};

function budget(id: string, categoryId: string, sortOrder: number): Budget {
  return budgetSchema.parse({
    id,
    name: id,
    categoryIds: [categoryId],
    amount: 10000,
    period: 'period',
    alertThreshold: 80,
    rollover: false,
    icon: 'cart',
    sortOrder,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
    deletedAt: null,
  });
}

describe('budgetsView', () => {
  const data = dataWith([tx({ id: 't1', amount: 2500, date: '2026-09-05' })], {
    budgets: [budget('b2', 'c2', 1), budget('b1', 'c1', 0)],
  });

  it('keeps the order the user set', () => {
    const { items } = budgetsView({ data, today: TODAY, def: DEF, period: PERIOD });
    expect(items.map((item) => item.budget.id)).toEqual(['b1', 'b2']);
  });

  it('spends the same as Home for the same data', () => {
    const { items } = budgetsView({ data, today: TODAY, def: DEF, period: PERIOD });
    const home = homeView({ data, today: TODAY, def: DEF, period: PERIOD });
    expect(items.find((i) => i.budget.id === 'b1')?.spent).toBe(2500);
    for (const item of items) {
      const same = home.budgets.items.find((h) => h.budget.id === item.budget.id);
      expect(same?.spent).toBe(item.spent);
    }
  });

  it('is empty without budgets', () => {
    const view = budgetsView({ data: dataWith([]), today: TODAY, def: DEF, period: PERIOD });
    expect(view.items).toEqual([]);
  });
});
