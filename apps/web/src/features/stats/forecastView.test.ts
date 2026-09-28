import type { DateRange, ForecastPeriod } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_2, RECURRENCE } from '../test/fixtures';
import { forecastView } from './forecastView';

const SELECTED_RANGE: DateRange = { start: '2026-10-01', end: '2026-10-31' };

function period(range: DateRange, over: Partial<ForecastPeriod> = {}): ForecastPeriod {
  return { range, income: 0, expenses: 0, expensesMin: 0, expensesMax: 0, balance: 0, ...over };
}

const SELECTED = period(SELECTED_RANGE, { expensesMax: 90000 });

describe('forecastView', () => {
  it('passes `periods` and `selected` through unchanged', () => {
    const periods = [
      period({ start: '2026-10-01', end: '2026-10-31' }),
      SELECTED,
      period({ start: '2026-12-01', end: '2026-12-31' }),
    ];
    const view = forecastView({ recurrences: [], periods, selected: SELECTED });
    expect(view.periods).toBe(periods);
    expect(view.selected).toBe(SELECTED);
  });

  it('skips a soft-deleted recurrence', () => {
    const recurrence = {
      ...RECURRENCE,
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      deletedAt: '2026-01-01T00:00:00.000Z',
    };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toEqual([]);
  });

  it('skips a transfer template, which counts in no total', () => {
    const recurrence = {
      ...RECURRENCE,
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      template: {
        ...RECURRENCE.template,
        kind: 'transfer' as const,
        toAccountId: ACCOUNT_2.id,
        categoryId: null,
      },
    };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toEqual([]);
  });

  it('skips a template excluded from totals', () => {
    const recurrence = {
      ...RECURRENCE,
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      template: { ...RECURRENCE.template, excludeFromTotals: true },
    };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toEqual([]);
  });

  it('drops a recurrence that fires nowhere inside the selected period', () => {
    // Ends the month before the selected one: `occurrenceDates` still returns its last date, but
    // the `>= selected.range.start` filter leaves nothing, so it must not show as a zero row.
    const recurrence = { ...RECURRENCE, startDate: '2026-01-10', endDate: '2026-09-10' };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toEqual([]);
  });

  it('counts one occurrence and totals its amount', () => {
    const recurrence = {
      ...RECURRENCE,
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      template: { ...RECURRENCE.template, amount: 500 },
    };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toEqual([
      {
        recurrenceId: recurrence.id,
        description: recurrence.template.description,
        categoryId: recurrence.template.categoryId,
        kind: 'expense',
        amount: 500,
        count: 1,
        total: 500,
      },
    ]);
  });

  it('counts every occurrence inside the period, not just the first', () => {
    // Weekly from Oct 1st: Oct 1, 8, 15, 22, 29 — five Wednesdays inside October, none past it.
    const recurrence = {
      ...RECURRENCE,
      frequency: 'weekly' as const,
      startDate: '2026-10-01',
      endDate: null,
      template: { ...RECURRENCE.template, amount: 500 },
    };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toEqual([
      expect.objectContaining({ recurrenceId: recurrence.id, count: 5, total: 2500 }),
    ]);
  });

  it('includes an occurrence on the very first day of the period, inclusive of the boundary', () => {
    const recurrence = { ...RECURRENCE, startDate: '2026-10-01', endDate: '2026-10-01' };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toHaveLength(1);
  });

  it(
    'counts an occurrence the materialiser would already have written, unlike the chart’s ' +
      'own totals — this view has no horizon to filter against',
    () => {
      // Anchored on the very start of the selected period: on the phone's forecast this date would
      // already sit behind `recurrenceHorizonEnd` and be dropped by `scheduledFlows`. This table
      // still shows it, on purpose (§17.1.7): it answers «what repeats», not «what is still owed».
      const recurrence = { ...RECURRENCE, startDate: '2026-10-01', endDate: '2026-10-01' };
      const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
      expect(view.recurrences[0]?.count).toBe(1);
    },
  );

  it('sorts by total descending, expenses before income on a tie, then by id', () => {
    const base = { startDate: '2026-10-05', endDate: '2026-10-05' };
    const recurrences = [
      {
        ...RECURRENCE,
        ...base,
        id: 'rB',
        template: { ...RECURRENCE.template, kind: 'income' as const, amount: 1000 },
      },
      { ...RECURRENCE, ...base, id: 'rC', template: { ...RECURRENCE.template, amount: 300 } },
      { ...RECURRENCE, ...base, id: 'rD', template: { ...RECURRENCE.template, amount: 1000 } },
      { ...RECURRENCE, ...base, id: 'rA', template: { ...RECURRENCE.template, amount: 1000 } },
    ];
    const view = forecastView({ recurrences, periods: [], selected: SELECTED });
    expect(view.recurrences.map((row) => row.recurrenceId)).toEqual(['rA', 'rD', 'rB', 'rC']);
  });
});
