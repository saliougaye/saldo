import { type Budget, budgetSchema } from '@saldo/core';
import { makeTranslator } from '@saldo/i18n/translate';
import { describe, expect, it } from 'vitest';
import { dataWith, tx } from '../test/fixtures';
import { budgetsView } from './budgetsView';
import {
  budgetColour,
  budgetLabel,
  budgetMeta,
  budgetPace,
  budgetStatus,
  budgetTone,
} from './budgetText';

const DEF = { kind: 'month', startDay: 1 } as const;
const PERIOD = {
  range: { start: '2026-09-01', end: '2026-09-30' },
  isCurrent: true,
  elapsed: 15,
  length: 30,
};

const deps = {
  t: makeTranslator({
    targets: {
      overLimitMeta: 'over limit',
      left: '{{amount}} left',
      closedMeta: 'closed',
      overLimitBy: '{{amount}} over the limit',
      overPaceBy: '{{amount}} over pace',
      inLine: 'in line',
      itemLabel: '{{name}}, {{amount}} of {{limit}}, {{status}}',
    },
  }),
  money: (minor: number) => `€${minor / 100}`,
};

function budget(amount: number): Budget {
  return budgetSchema.parse({
    id: 'b1',
    name: 'Groceries',
    categoryIds: ['c1'],
    amount,
    period: 'period',
    alertThreshold: 80,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z-0000-web',
    deletedAt: null,
  });
}

function itemFor(amount: number, spent: number, today = '2026-09-15') {
  const data = dataWith([tx({ id: 't1', amount: spent, date: '2026-09-05' })], {
    budgets: [budget(amount)],
  });
  const item = budgetsView({
    data,
    today,
    def: DEF,
    period: { ...PERIOD, isCurrent: today <= PERIOD.range.end },
  }).items[0];
  if (item === undefined) throw new Error('no budget view');
  return item;
}

describe('budget row text', () => {
  it('says what is left while the period is open and in line', () => {
    const item = itemFor(10000, 1000);
    expect(budgetMeta(item, deps)).toBe('€90 left');
    expect(budgetStatus(item, deps)).toBe('in line');
    expect(budgetTone(item)).toBe('normal');
    expect(budgetPace(item)).toBe(item.pace);
  });

  it('turns over when the pace is passed and names the gap', () => {
    const item = itemFor(10000, 8000);
    expect(budgetTone(item)).toBe('over');
    expect(budgetStatus(item, deps)).toMatch(/over pace$/);
  });

  it('says how far over the limit', () => {
    const item = itemFor(10000, 12500);
    expect(budgetMeta(item, deps)).toBe('over limit');
    expect(budgetStatus(item, deps)).toBe('€25 over the limit');
  });

  it('draws no pace tick once the period has closed', () => {
    const item = itemFor(10000, 1000, '2026-10-05');
    expect(item.open).toBe(false);
    expect(budgetPace(item)).toBeNull();
    expect(budgetMeta(item, deps)).toBe('closed');
  });

  it('follows the first category colour, else the neutral one', () => {
    const item = itemFor(10000, 1000);
    expect(budgetColour(item, [{ id: 'c1', colorIndex: 4 }])).toBe(4);
    expect(budgetColour(item, [])).toBe(9);
  });

  it('reads as one sentence', () => {
    const item = itemFor(10000, 1000);
    expect(budgetLabel(item, deps)).toBe('Groceries, €10 of €100, in line');
  });
});
