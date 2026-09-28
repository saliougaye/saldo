import { accountBalances, emptyUserData, forecastPeriods, netWorth } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { dataWith, RECURRENCE, tx } from '../test/fixtures';
import { navigatorView, WEB_CLOSED_COLUMNS } from './navigatorView';

const DEF = { kind: 'month', startDay: 1 } as const;
const TODAY = '2026-09-15';
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };

/** Three used periods before September: enough history for `forecastPeriods` to answer. */
const HISTORY = [
  tx({ id: 'jun-in', amount: 200000, date: '2026-06-01', kind: 'income' }),
  tx({ id: 'jun', amount: 40000, date: '2026-06-05' }),
  tx({ id: 'jul-in', amount: 200000, date: '2026-07-01', kind: 'income' }),
  tx({ id: 'jul', amount: 60000, date: '2026-07-05' }),
  tx({ id: 'aug-in', amount: 200000, date: '2026-08-01', kind: 'income' }),
  tx({ id: 'aug', amount: 50000, date: '2026-08-05' }),
  tx({ id: 'sep', amount: 12000, date: '2026-09-03' }),
];

describe('navigatorView', () => {
  it('shows six closed periods, the running one and the three forecast ones', () => {
    const view = navigatorView({
      data: dataWith(HISTORY),
      def: DEF,
      today: TODAY,
      selected: SEPTEMBER,
    });
    expect(WEB_CLOSED_COLUMNS).toBe(6);
    expect(view.columns).toHaveLength(10);
    expect(view.columns.filter((column) => column.kind === 'closed')).toHaveLength(6);
    expect(view.columns.filter((column) => column.kind === 'current')).toHaveLength(1);
    expect(view.columns.filter((column) => column.kind === 'forecast')).toHaveLength(3);
  });

  it('ends the closed run at the period before the current one, in order', () => {
    const view = navigatorView({
      data: dataWith(HISTORY),
      def: DEF,
      today: TODAY,
      selected: SEPTEMBER,
    });
    expect(view.columns[0]?.range.start).toBe('2026-03-01');
    expect(view.columns[5]?.range.start).toBe('2026-08-01');
    expect(view.columns[6]?.range.start).toBe('2026-09-01');
    expect(view.columns[7]?.range.start).toBe('2026-10-01');
    expect(view.columns[9]?.range.start).toBe('2026-12-01');
  });

  it('marks the selected column, and only it', () => {
    const view = navigatorView({
      data: emptyUserData(),
      def: DEF,
      today: TODAY,
      selected: { start: '2026-07-01', end: '2026-07-31' },
    });
    expect(view.columns.filter((column) => column.selected)).toHaveLength(1);
    expect(view.selected?.range.start).toBe('2026-07-01');
  });

  it('selects nothing when the period is further back than the columns reach', () => {
    const view = navigatorView({
      data: emptyUserData(),
      def: DEF,
      today: TODAY,
      selected: { start: '2025-01-01', end: '2025-01-31' },
    });
    expect(view.selected).toBeNull();
    expect(view.columns.some((column) => column.selected)).toBe(false);
  });

  it('gives each real column the income and spend of `summarizePeriod`', () => {
    const view = navigatorView({
      data: dataWith(HISTORY),
      def: DEF,
      today: TODAY,
      selected: SEPTEMBER,
    });
    expect(view.columns[3]?.values).toEqual({ income: 200000, expenses: 40000 });
    expect(view.columns[6]?.values).toEqual({ income: 0, expenses: 12000 });
  });

  it('drops the forecast columns when there is not enough history to forecast', () => {
    const view = navigatorView({
      data: emptyUserData(),
      def: DEF,
      today: TODAY,
      selected: SEPTEMBER,
    });
    // `forecastPeriods` returns null under three used periods, and §5.17 renders nothing of it: the
    // phone's `if (forecast === null) return past`. Seven columns, none of them selectable ahead.
    expect(view.forecast).toBeNull();
    expect(view.columns).toHaveLength(7);
    expect(view.columns.some((column) => column.kind === 'forecast')).toBe(false);
    expect(view.columns.at(-1)?.range.start).toBe('2026-09-01');
  });

  it('selects nothing ahead when there is no forecast to select', () => {
    const view = navigatorView({
      data: emptyUserData(),
      def: DEF,
      today: TODAY,
      selected: { start: '2026-10-01', end: '2026-10-31' },
    });
    expect(view.selected).toBeNull();
  });

  it('forecasts from the current period whichever column is selected', () => {
    const data = dataWith(HISTORY, { recurrences: [RECURRENCE] });
    const expected = forecastPeriods({
      txs: data.transactions,
      recurrences: data.recurrences,
      def: DEF,
      period: SEPTEMBER,
      today: TODAY,
      balance: netWorth(data.accounts, accountBalances(data.accounts, data.transactions, TODAY)),
    });
    expect(expected).not.toBeNull();

    for (const selected of [SEPTEMBER, { start: '2026-07-01', end: '2026-07-31' }]) {
      const view = navigatorView({ data, def: DEF, today: TODAY, selected });
      expect(view.forecast).toEqual(expected);
      const ahead = view.columns.filter((column) => column.kind === 'forecast');
      expect(ahead.map((column) => column.forecast)).toEqual(expected);
      expect(ahead[0]?.values).toEqual({
        income: expected?.[0]?.income,
        expenses: expected?.[0]?.expenses,
        forecast: { min: expected?.[0]?.expensesMin, max: expected?.[0]?.expensesMax },
      });
    }
  });

  it('hatches only the running period, which is always the current column', () => {
    const view = navigatorView({
      data: emptyUserData(),
      def: DEF,
      today: TODAY,
      selected: { start: '2026-07-01', end: '2026-07-31' },
    });
    expect(
      view.columns.filter((column) => column.running).map((column) => column.range.start),
    ).toEqual(['2026-09-01']);
  });
});
