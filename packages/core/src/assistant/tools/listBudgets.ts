import { z } from 'zod';
import { budgetPeriodSchema } from '../../entities';
import { budgetViews } from '../../views/budgetViews';
import { moneySchema } from '../money';
import { resolveToolPeriod, toolPeriodShape } from '../period';
import { dateRangeSchema } from '../schemas';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

// `period` only: a budget is set per app period (or per week, month, year), and an arbitrary
// from/to range has no limit to measure against.
const input = z.object({ period: toolPeriodShape.period });

const output = z.object({
  period: dateRangeSchema,
  budgets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      categoryIds: z.array(z.string()),
      window: budgetPeriodSchema.describe(
        '"period" follows the app period; "week", "month" and "year" are calendar windows.',
      ),
      range: dateRangeSchema.describe('The window this budget is measured over.'),
      amount: moneySchema.describe('The limit the user set.'),
      limit: moneySchema.describe('The limit measured against: `amount` plus any rollover.'),
      spent: moneySchema,
      ratio: z.number().describe('Spent over limit; above 1 means over the limit.'),
      pace: z.number().describe('How much of the window has elapsed, 0 to 1.'),
      overPace: z.boolean(),
      overLimit: z.boolean(),
      alertThreshold: z.number().int().nullable(),
      alertReached: z.boolean(),
      rollover: z.boolean(),
      daysLeft: z.number().int(),
      open: z.boolean().describe('Whether the window still contains today.'),
    }),
  ),
});

export type ListBudgetsInput = z.infer<typeof input>;
export type ListBudgetsOutput = z.infer<typeof output>;

export const listBudgetsTool: ReadTool<ListBudgetsInput, ListBudgetsOutput> = {
  name: 'list_budgets',
  title: 'Budgets',
  description:
    "The budgets of a period (default: the current one) in the user's order, with what was spent against each limit, the share used, whether spending runs ahead of the time elapsed, and whether the user's alert threshold was reached. A budget covers its categories and their children.",
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx, input) {
    const user = toolUser(data);
    const range = resolveToolPeriod(input, data, ctx);
    // `budgetsView` in apps/web: the user's order, then core's `budgetViews`.
    const views = budgetViews({
      budgets: [...data.budgets].sort((a, b) => a.sortOrder - b.sortOrder),
      categories: data.categories,
      transactions: data.transactions,
      period: range,
      def: user.def,
      today: ctx.today,
    });
    return {
      period: range,
      budgets: views.map((view) => ({
        id: view.budget.id,
        name: view.budget.name,
        categoryIds: view.budget.categoryIds,
        window: view.budget.period,
        range: view.range,
        amount: user.money(view.budget.amount),
        limit: user.money(view.limit),
        spent: user.money(view.spent),
        ratio: view.ratio,
        pace: view.pace,
        overPace: view.overPace,
        overLimit: view.overLimit,
        alertThreshold: view.budget.alertThreshold,
        alertReached: view.alertReached,
        rollover: view.budget.rollover,
        daysLeft: view.daysLeft,
        open: view.open,
      })),
    };
  },
};
