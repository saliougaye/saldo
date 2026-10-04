import { describe, expect, it } from 'vitest';
import { accountBalances, netWorth } from '../../accounts';
import { forecastPeriods } from '../../forecast';
import { periodContaining } from '../../period';
import { emptyUserData } from '../../userData';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { getForecastTool } from './getForecast';

const MONTH = { kind: 'month', startDay: 27 } as const;

describe('get_forecast', () => {
  it('gives the next three periods exactly as forecastPeriods does', () => {
    const data = fixtureData();
    const expected = forecastPeriods({
      txs: data.transactions,
      recurrences: data.recurrences,
      def: MONTH,
      period: periodContaining(MONTH, CONTEXT.today),
      today: CONTEXT.today,
      balance: netWorth(
        data.accounts,
        accountBalances(data.accounts, data.transactions, CONTEXT.today),
      ),
    });
    const result = getForecastTool.run(data, CONTEXT, {});
    expect(result.available).toBe(true);
    expect(result.periods.map((period) => period.start)).toEqual([
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ]);
    expect(
      result.periods.map((period) => [
        period.income.minor,
        period.expenses.minor,
        period.expensesMin.minor,
        period.expensesMax.minor,
        period.balance.minor,
      ]),
    ).toEqual(
      (expected ?? []).map((period) => [
        period.income,
        period.expenses,
        period.expensesMin,
        period.expensesMax,
        period.balance,
      ]),
    );
  });

  it('is not available without three used periods of history', () => {
    expect(getForecastTool.run(emptyUserData(), CONTEXT, {})).toEqual({
      available: false,
      minHistoryPeriods: 3,
      periods: [],
    });
  });
});
