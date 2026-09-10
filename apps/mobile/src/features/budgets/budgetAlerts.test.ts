import { alertKey, pendingBudgetAlerts } from './budgetAlerts';
import type { BudgetView } from './useBudgetProgress';

function view(overrides: Partial<BudgetView> = {}): BudgetView {
  return {
    budget: {
      id: 'b1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '001775000000000-0000-dev',
      deletedAt: null,
      name: 'Spesa',
      categoryIds: ['cat-food'],
      amount: 40000,
      period: 'period',
      alertThreshold: 90,
      rollover: false,
      icon: 'cart',
      sortOrder: 0,
    },
    range: { start: '2026-03-27', end: '2026-04-26' },
    daysLeft: 8,
    open: true,
    limitWithCarry: 40000,
    spent: 38000,
    limit: 40000,
    ratio: 0.95,
    overPace: true,
    overLimit: false,
    alertReached: true,
    ...overrides,
  };
}

function store(entries: Record<string, string> = {}) {
  return { get: (key: string) => entries[key] ?? null };
}

describe('pendingBudgetAlerts', () => {
  it('reports a budget that just crossed its threshold', () => {
    expect(pendingBudgetAlerts([view()], store())).toEqual([
      { budgetId: 'b1', name: 'Spesa', percent: 95 },
    ]);
  });

  it('stays quiet when the threshold is not reached', () => {
    expect(pendingBudgetAlerts([view({ alertReached: false })], store())).toEqual([]);
  });

  it('stays quiet for a closed period', () => {
    expect(pendingBudgetAlerts([view({ open: false })], store())).toEqual([]);
  });

  it('notifies once per period', () => {
    const alerted = store({ [alertKey('b1')]: '2026-03-27' });
    expect(pendingBudgetAlerts([view()], alerted)).toEqual([]);
  });

  it('notifies again in the next period', () => {
    const alerted = store({ [alertKey('b1')]: '2026-02-27' });
    expect(pendingBudgetAlerts([view()], alerted)).toHaveLength(1);
  });
});
