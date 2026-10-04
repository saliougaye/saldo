import { z } from 'zod';
import { type Budget, type Category, categoryDirectionSchema } from '../../entities';
import { type MinorDigits, minorToAmountBuffer } from '../../money';
import { categoryFormFrom, emptyCategoryForm } from '../../views/categoryForm';
import type { WriteToolSpec } from '../types';
import {
  type ArchivedOutput,
  archivedOutput,
  idField,
  MAX_TOOL_MINOR,
  provided,
  type ResolveResult,
  type SavedOutput,
  savedOutput,
  updatedAtField,
  versionPairing,
  writeAnnotations,
} from './shared';

export const saveCategoryInput = z.object({
  id: idField
    .optional()
    .describe('Omit to create. To change a category, its id from list_categories.'),
  updatedAt: updatedAtField.optional(),
  name: z.string().trim().min(1).max(40).optional().describe('Required to create.'),
  direction: categoryDirectionSchema
    .optional()
    .describe('expense (the default) or income. Only when creating: it never changes.'),
  parentId: idField
    .nullable()
    .optional()
    .describe(
      'A live top-level category of the same direction from list_categories, or null for top level.',
    ),
  monthlyBudgetMinor: z
    .number()
    .int()
    .min(0)
    .max(MAX_TOOL_MINOR)
    .nullable()
    .optional()
    .describe(
      "Expense categories only: the category's own budget per period, in minor units. Positive creates or updates it, null or 0 removes it, left out keeps it.",
    ),
});
export type SaveCategoryInput = z.infer<typeof saveCategoryInput>;

/** What `saveCategory` (apps/web `src/server/write/categories.ts`) takes; equal to its `CategoryInput`. */
export interface CategoryWriteValues {
  id: string | null;
  name: string;
  direction: Category['direction'];
  parentId: string | null;
  icon: string;
  colorIndex: number;
  budgetEnabled: boolean;
  budgetBuffer: string;
  expectedUpdatedAt?: string;
}

/** «Budget mensile» (§6.19): the budget that covers exactly this one category, if any. */
export function singleCategoryBudget(
  budgets: readonly Budget[],
  categoryId: string,
): Budget | null {
  return (
    budgets.find(
      (budget) => budget.categoryIds.length === 1 && budget.categoryIds[0] === categoryId,
    ) ?? null
  );
}

/** The model's input as the category form (§6.19), from its defaults or from the stored row. */
export function resolveCategoryInput(
  input: SaveCategoryInput,
  existing: Category | null,
  budgets: readonly Budget[],
  minorDigits: MinorDigits,
): ResolveResult<CategoryWriteValues> {
  const pairing = versionPairing(input);
  if (pairing !== null) return { ok: false, message: pairing };
  if (existing === null && input.name === undefined) {
    return { ok: false, message: 'To create a category, pass name.' };
  }
  if (existing !== null && input.direction !== undefined && input.direction !== existing.direction) {
    return {
      ok: false,
      message: "A category's direction never changes. Create a new category instead.",
    };
  }
  const direction = existing?.direction ?? input.direction ?? 'expense';
  const budget = input.monthlyBudgetMinor;
  if (direction === 'income' && budget !== undefined && budget !== null && budget > 0) {
    return { ok: false, message: 'Only expense categories have a budget.' };
  }
  const own = existing === null ? null : singleCategoryBudget(budgets, existing.id);
  const base =
    existing === null
      ? emptyCategoryForm()
      : categoryFormFrom(existing, own?.amount ?? null, minorDigits);
  const budgetEnabled = budget === undefined ? base.budgetEnabled : budget !== null && budget > 0;
  let budgetBuffer = base.budgetBuffer;
  if (budget !== undefined) {
    budgetBuffer = budgetEnabled && budget !== null ? minorToAmountBuffer(budget, minorDigits) : '';
  }
  return {
    ok: true,
    value: {
      id: existing?.id ?? null,
      name: input.name ?? base.name,
      direction,
      parentId: provided(input.parentId, base.parentId),
      icon: base.icon,
      colorIndex: base.colorIndex,
      budgetEnabled,
      budgetBuffer,
      expectedUpdatedAt: input.updatedAt,
    },
  };
}

export const saveCategoryTool: WriteToolSpec<SaveCategoryInput, SavedOutput> = {
  name: 'save_category',
  title: 'Save a category',
  description:
    'Create a category, or change one. To create: omit id and updatedAt and pass name; direction is expense (the default) or income, and never changes later. parentId nests it under a live top-level category of the same direction from list_categories; null makes it top-level; there is one level of nesting only. To change one: pass its id and updatedAt exactly as list_categories returned them, plus only the fields to change. monthlyBudgetMinor (expense categories only) gives the category its own budget for each of the user\'s periods, an integer in minor units of the user\'s currency: a positive amount creates or updates it, null or 0 removes it, leaving it out keeps it. Returns the id and the new updatedAt.',
  scope: 'write',
  input: saveCategoryInput,
  output: savedOutput,
  annotations: writeAnnotations(false, false),
};

export const archiveCategoryInput = z.object({
  id: idField.describe('The category id from list_categories.'),
  updatedAt: updatedAtField,
  action: z.enum(['archive', 'restore']),
  moveToId: idField
    .optional()
    .describe(
      'Archive only: a live category of the same direction from list_categories that takes over its transactions, recurring templates and budgets.',
    ),
});
export type ArchiveCategoryInput = z.infer<typeof archiveCategoryInput>;

export type CategoryArchiveRequest =
  | { action: 'archive'; moveToId: string | null }
  | { action: 'restore' };

/** `moveToId` belongs to archiving (§5.11): restoring moves nothing back. */
export function categoryArchiveRequest(
  input: ArchiveCategoryInput,
): ResolveResult<CategoryArchiveRequest> {
  if (input.action === 'restore') {
    return input.moveToId === undefined
      ? { ok: true, value: { action: 'restore' } }
      : {
          ok: false,
          message: 'moveToId only goes with action "archive": restoring a category moves nothing back.',
        };
  }
  return { ok: true, value: { action: 'archive', moveToId: input.moveToId ?? null } };
}

export const archiveCategoryTool: WriteToolSpec<ArchiveCategoryInput, ArchivedOutput> = {
  name: 'archive_category',
  title: 'Archive or restore a category',
  description:
    'Archive a category (action "archive") or bring an archived one back (action "restore"). Pass its id and updatedAt exactly as list_categories returned them. Archiving a parent archives its subcategories too. With moveToId (a live category of the same direction from list_categories, not one of its own subcategories), every transaction, recurring template and budget that uses the category moves to that one, in the same write; without it, transactions keep the archived category. A subcategory cannot be restored while its parent is archived. Restoring moves nothing back.',
  scope: 'write',
  input: archiveCategoryInput,
  output: archivedOutput,
  annotations: writeAnnotations(true, true),
};
