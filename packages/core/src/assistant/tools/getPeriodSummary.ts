import { z } from 'zod';
import { type PeriodSummary, summarizePeriod } from '../../ledger';
import { describePeriod, shiftPeriod } from '../../period';
import { committedSpend, sharePercent } from '../../stats';
import { moneySchema } from '../money';
import { checkToolPeriod, isWholePeriod, resolveToolPeriod, toolPeriodShape } from '../period';
import { toolDateSchema } from '../schemas';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

const input = z.object(toolPeriodShape).superRefine(checkToolPeriod);

const figures = {
  income: moneySchema,
  expenses: moneySchema,
  balance: moneySchema.describe('Income less expenses.'),
};

const output = z.object({
  period: z.object({
    start: toolDateSchema,
    end: toolDateSchema,
    isCurrent: z.boolean(),
    elapsedDays: z.number().int(),
    lengthDays: z.number().int(),
  }),
  ...figures,
  committed: z
    .object({
      amount: moneySchema,
      sharePercent: z.number().int(),
      discretionary: moneySchema,
    })
    .describe(
      '«Quota impegnata»: the expenses that came from recurring transactions, their share of the expenses, and the rest.',
    ),
  previous: z
    .object({ start: toolDateSchema, end: toolDateSchema, ...figures })
    .nullable()
    .describe('The period before, for comparison; null for an explicit from/to range.'),
});

export type GetPeriodSummaryInput = z.infer<typeof input>;
export type GetPeriodSummaryOutput = z.infer<typeof output>;

export const getPeriodSummaryTool: ReadTool<GetPeriodSummaryInput, GetPeriodSummaryOutput> = {
  name: 'get_period_summary',
  title: 'Period summary',
  description:
    "Income, expenses and balance of a period (default: the current one) as the app's Statistics screen shows them, the «Quota impegnata» (expenses from recurring transactions), and the previous period beside it. Transfers, excluded transactions and rows dated after today do not count.",
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx, input) {
    const user = toolUser(data);
    const range = resolveToolPeriod(input, data, ctx);
    const txs = data.transactions;
    const view = describePeriod(range, ctx.today);
    const summary = summarizePeriod(txs, range, ctx.today);
    const committed = committedSpend(txs, range, ctx.today);
    const figuresOf = (of: PeriodSummary) => ({
      income: user.money(of.income),
      expenses: user.money(of.spent),
      balance: user.money(of.remaining),
    });
    const previous = isWholePeriod(user.def, range) ? shiftPeriod(user.def, range, -1) : null;
    return {
      period: {
        start: range.start,
        end: range.end,
        isCurrent: view.isCurrent,
        elapsedDays: view.elapsed,
        lengthDays: view.length,
      },
      ...figuresOf(summary),
      committed: {
        amount: user.money(committed),
        sharePercent: sharePercent(committed, summary.spent),
        // The Statistics card's own expression (`statsView` in apps/web), pinned by the parity test.
        discretionary: user.money(Math.max(0, summary.spent - committed)),
      },
      previous:
        previous === null
          ? null
          : { ...previous, ...figuresOf(summarizePeriod(txs, previous, ctx.today)) },
    };
  },
};
