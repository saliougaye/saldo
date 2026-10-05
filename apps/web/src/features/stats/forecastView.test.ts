import type { DateRange, ForecastPeriod } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { RECURRENCE } from '../test/fixtures';
import { forecastView } from './forecastView';

const SELECTED_RANGE: DateRange = { start: '2026-10-01', end: '2026-10-31' };

function period(range: DateRange, over: Partial<ForecastPeriod> = {}): ForecastPeriod {
  return { range, income: 0, expenses: 0, expensesMin: 0, expensesMax: 0, balance: 0, ...over };
}

const SELECTED = period(SELECTED_RANGE, { expensesMax: 90000 });

describe('forecastView', () => {
  it('drops a recurrence that fires nowhere inside the selected period', () => {
    // Ends the month before the selected one: `occurrenceDates` still returns its last date, but
    // the `>= selected.range.start` filter leaves nothing, so it must not show as a zero row.
    const recurrence = { ...RECURRENCE, startDate: '2026-01-10', endDate: '2026-09-10' };
    const view = forecastView({ recurrences: [recurrence], periods: [], selected: SELECTED });
    expect(view.recurrences).toEqual([]);
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
});
