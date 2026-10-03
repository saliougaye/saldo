import { z } from 'zod';
import { accountBalances, netWorth } from '../../accounts';
import { forecastPeriods, MIN_FORECAST_HISTORY } from '../../forecast';
import { periodContaining } from '../../period';
import { moneySchema } from '../money';
import { toolDateSchema } from '../schemas';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

const input = z.object({});

const output = z.object({
  available: z
    .boolean()
    .describe('False while the history holds fewer than `minHistoryPeriods` used periods.'),
  minHistoryPeriods: z.number().int(),
  periods: z.array(
    z.object({
      start: toolDateSchema,
      end: toolDateSchema,
      income: moneySchema,
      expenses: moneySchema,
      expensesMin: moneySchema.describe(
        'Expenses with the lightest recent period instead of the usual.',
      ),
      expensesMax: moneySchema.describe(
        'Expenses with the heaviest recent period instead of the usual.',
      ),
      balance: moneySchema.describe('Projected net worth at the end of the period.'),
    }),
  ),
});

export type GetForecastInput = z.infer<typeof input>;
export type GetForecastOutput = z.infer<typeof output>;

export const getForecastTool: ReadTool<GetForecastInput, GetForecastOutput> = {
  name: 'get_forecast',
  title: 'Forecast',
  description:
    "The next three periods as the app's Statistics screen forecasts them: scheduled income and expenses plus the usual discretionary spending of recent periods, a min-max band for expenses, and net worth chained from today's. Not available until the user has three used periods of history.",
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx) {
    const user = toolUser(data);
    const txs = data.transactions;
    // `navigatorForecast` in apps/web, argument for argument; pinned by the parity test.
    const forecast = forecastPeriods({
      txs,
      recurrences: data.recurrences,
      def: user.def,
      period: periodContaining(user.def, ctx.today),
      today: ctx.today,
      balance: netWorth(data.accounts, accountBalances(data.accounts, txs, ctx.today)),
    });
    return {
      available: forecast !== null,
      minHistoryPeriods: MIN_FORECAST_HISTORY,
      periods: (forecast ?? []).map((period) => ({
        start: period.range.start,
        end: period.range.end,
        income: user.money(period.income),
        expenses: user.money(period.expenses),
        expensesMin: user.money(period.expensesMin),
        expensesMax: user.money(period.expensesMax),
        balance: user.money(period.balance),
      })),
    };
  },
};
