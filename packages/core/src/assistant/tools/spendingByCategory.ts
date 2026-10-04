import { z } from 'zod';
import { rollupToParents, spendingByCategory, UNCATEGORIZED } from '../../ledger';
import { sharePercent } from '../../stats';
import { moneySchema } from '../money';
import { checkToolPeriod, resolveToolPeriod, toolPeriodShape } from '../period';
import { dateRangeSchema } from '../schemas';
import { READ_ANNOTATIONS, type ReadTool } from '../types';
import { toolUser } from '../user';

const directionSchema = z.enum(['expense', 'income']);

const input = z
  .object({
    ...toolPeriodShape,
    direction: directionSchema.default('expense').describe('Expenses (default) or income.'),
  })
  .superRefine(checkToolPeriod);

const output = z.object({
  period: dateRangeSchema,
  direction: directionSchema,
  total: moneySchema,
  categories: z.array(
    z.object({
      categoryId: z.string().nullable(),
      name: z.string().nullable().describe('Null for a category that no longer exists.'),
      amount: moneySchema,
      sharePercent: z.number().int(),
    }),
  ),
});

export type SpendingByCategoryInput = z.infer<typeof input>;
export type SpendingByCategoryOutput = z.infer<typeof output>;

export const spendingByCategoryTool: ReadTool<SpendingByCategoryInput, SpendingByCategoryOutput> = {
  name: 'spending_by_category',
  title: 'Spending by category',
  description:
    "Totals per top-level category for a period (default: the current one), children rolled up into their parent, largest first, with each one's share of the total: the split of the app's Statistics screen. Expenses by default, or income.",
  scope: 'read',
  input,
  output,
  annotations: READ_ANNOTATIONS,
  run(data, ctx, input) {
    const user = toolUser(data);
    const range = resolveToolPeriod(input, data, ctx);
    const amounts = rollupToParents(
      spendingByCategory(data.transactions, range, ctx.today, input.direction),
      data.categories,
    );
    // `statsView`'s own total and order (apps/web), pinned by the parity test.
    const total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
    const names = new Map(data.categories.map((category) => [category.id, category.name]));
    return {
      period: range,
      direction: input.direction,
      total: user.money(total),
      categories: [...amounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([id, amount]) => ({
          categoryId: id === UNCATEGORIZED ? null : id,
          name: names.get(id) ?? null,
          amount: user.money(amount),
          sharePercent: sharePercent(amount, total),
        })),
    };
  },
};
