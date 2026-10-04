import { z } from 'zod';
import { type Budget, type BudgetPeriod, budgetPeriodSchema, type Category } from '../../entities';
import { type MinorDigits, minorToAmountBuffer } from '../../money';
import { budgetFormFrom, emptyBudgetForm } from '../../views/budgetForm';
import type { WriteToolSpec } from '../types';
import {
  idField,
  positiveMinorField,
  provided,
  type RemovedOutput,
  type ResolveResult,
  removedOutput,
  type SavedOutput,
  savedOutput,
  updatedAtField,
  versionPairing,
  writeAnnotations,
} from './shared';

export const saveBudgetInput = z.object({
  id: idField.optional().describe('Omit to create. To change a budget, its id from list_budgets.'),
  updatedAt: updatedAtField.optional(),
  name: z.string().trim().min(1).max(40).optional().describe('Required to create.'),
  categoryIds: z
    .array(idField)
    .min(1)
    .max(50)
    .optional()
    .describe('Expense category ids from list_categories. Required to create.'),
  amountMinor: positiveMinorField
    .optional()
    .describe('The limit, in minor units of the user\'s currency. Required to create.'),
  period: budgetPeriodSchema
    .optional()
    .describe('"period" (the user\'s own period, the default), "week", "month" or "year".'),
  alertThreshold: z
    .union([z.literal(75), z.literal(90), z.literal(100)])
    .nullable()
    .optional()
    .describe('Alert at 75, 90 (the default) or 100 percent; null for no alert.'),
  rollover: z
    .boolean()
    .optional()
    .describe('Carry what is left or overspent into the next period. Only for period "period".'),
});
export type SaveBudgetInput = z.infer<typeof saveBudgetInput>;

/** What `saveBudget` (apps/web `src/server/write/budgets.ts`) takes; equal to its `BudgetInput`. */
export interface BudgetWriteValues {
  id: string | null;
  name: string;
  categoryIds: string[];
  buffer: string;
  period: BudgetPeriod;
  alertThreshold: number | null;
  rollover: boolean;
  icon: string;
  expectedUpdatedAt?: string;
}

/**
 * The model's input as the budget form (§6.18). The name is required to create: the form's
 * automatic name joins categories with a word of the user's language, which core does not hold.
 */
export function resolveBudgetInput(
  input: SaveBudgetInput,
  existing: Budget | null,
  categories: readonly Category[],
  minorDigits: MinorDigits,
): ResolveResult<BudgetWriteValues> {
  const pairing = versionPairing(input);
  if (pairing !== null) return { ok: false, message: pairing };
  if (existing === null && input.name === undefined) {
    return { ok: false, message: 'To create a budget, pass name.' };
  }
  const base = existing === null ? emptyBudgetForm() : budgetFormFrom(existing, minorDigits);
  const categoryIds = input.categoryIds ?? base.categoryIds;
  // A new budget takes its first category's icon, as on the phone (§6.18).
  const icon =
    base.icon ?? categories.find((category) => category.id === categoryIds[0])?.icon ?? 'tag';
  return {
    ok: true,
    value: {
      id: existing?.id ?? null,
      name: input.name ?? base.name,
      categoryIds,
      buffer:
        input.amountMinor === undefined
          ? base.buffer
          : minorToAmountBuffer(input.amountMinor, minorDigits),
      period: input.period ?? base.period,
      alertThreshold: provided(input.alertThreshold, base.alertThreshold),
      rollover: input.rollover ?? base.rollover,
      icon,
      expectedUpdatedAt: input.updatedAt,
    },
  };
}

export const saveBudgetTool: WriteToolSpec<SaveBudgetInput, SavedOutput> = {
  name: 'save_budget',
  title: 'Save a budget',
  description:
    'Create a budget, or change one. To create: omit id and updatedAt and pass name, categoryIds and amountMinor. categoryIds are expense categories from list_categories (a parent covers its subcategories); a category can be in one budget only. amountMinor is the limit, a positive integer in minor units of the user\'s currency. period is "period" — the user\'s own period, see get_preferences — or a calendar "week", "month" or "year"; it defaults to "period". alertThreshold is 75, 90 (the default) or 100 percent, or null for no alert. rollover carries what is left (or overspent) into the next period, for period "period" only. To change one: pass its id and updatedAt exactly as list_budgets returned them, plus only the fields to change. Returns the id and the new updatedAt.',
  scope: 'write',
  input: saveBudgetInput,
  output: savedOutput,
  annotations: writeAnnotations(false, false),
};

export const deleteBudgetInput = z.object({
  id: idField.describe('The budget id from list_budgets.'),
  updatedAt: updatedAtField,
});
export type DeleteBudgetInput = z.infer<typeof deleteBudgetInput>;

export const deleteBudgetTool: WriteToolSpec<DeleteBudgetInput, RemovedOutput> = {
  name: 'delete_budget',
  title: 'Delete a budget',
  description:
    'Delete a budget. Pass its id and updatedAt exactly as list_budgets returned them. Transactions and categories are not touched. It cannot be undone.',
  scope: 'write',
  input: deleteBudgetInput,
  output: removedOutput,
  annotations: writeAnnotations(true, true),
};
