import type { Budget } from './entities';
import type { CategoryRef } from './ledger';
import { median } from './stats';

export type BudgetRef = Pick<Budget, 'id' | 'categoryIds'>;

/** Selected category ids plus the children of any selected parent. */
export function expandCategoryIds(
  categoryIds: readonly string[],
  categories: readonly CategoryRef[],
): Set<string> {
  const expanded = new Set(categoryIds);
  for (const category of categories) {
    if (category.parentId !== null && expanded.has(category.parentId)) expanded.add(category.id);
  }
  return expanded;
}

function sumFor(ids: ReadonlySet<string>, amounts: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const id of ids) total += amounts.get(id) ?? 0;
  return total;
}

export interface BudgetProgress {
  spent: number;
  limit: number;
  ratio: number;
  overPace: boolean;
  overLimit: boolean;
  alertReached: boolean;
}

/**
 * @param spending leaf-level amounts from `spendingByCategory` for the budget range
 * @param pace elapsed / length of the budget range
 */
export function budgetProgress(
  budget: Pick<Budget, 'categoryIds' | 'amount' | 'alertThreshold'>,
  spending: ReadonlyMap<string, number>,
  categories: readonly CategoryRef[],
  pace: number,
): BudgetProgress {
  const spent = sumFor(expandCategoryIds(budget.categoryIds, categories), spending);
  const ratio = budget.amount > 0 ? spent / budget.amount : 0;
  return {
    spent,
    limit: budget.amount,
    ratio,
    overPace: ratio > pace,
    overLimit: ratio > 1,
    alertReached: budget.alertThreshold !== null && ratio * 100 >= budget.alertThreshold,
  };
}

/** Median of past per-cycle spend for the selected categories, rounded to cents. */
export function suggestBudgetAmount(
  history: readonly ReadonlyMap<string, number>[],
  categoryIds: readonly string[],
  categories: readonly CategoryRef[],
): number | null {
  if (history.length === 0 || categoryIds.length === 0) return null;
  const ids = expandCategoryIds(categoryIds, categories);
  const value = median(history.map((amounts) => sumFor(ids, amounts)));
  return value === null ? null : Math.round(value);
}

/** Category ids already covered by budgets (optionally ignoring the one being edited). */
export function takenCategoryIds(
  budgets: readonly BudgetRef[],
  categories: readonly CategoryRef[],
  exceptBudgetId: string | null = null,
): Set<string> {
  const selected = budgets
    .filter((budget) => budget.id !== exceptBudgetId)
    .flatMap((budget) => budget.categoryIds);
  return expandCategoryIds(selected, categories);
}

/**
 * D6 (web Home, 2026-10-11): the counted spend in categories that no budget covers — «Non a
 * budget». `spending` is `spendingByCategory` for the period, leaf ids; a child of a budgeted
 * parent is covered. Uncategorised spend is never covered.
 */
export function unbudgetedSpend(
  budgets: readonly BudgetRef[],
  spending: ReadonlyMap<string, number>,
  categories: readonly CategoryRef[],
): number {
  const covered = takenCategoryIds(budgets, categories);
  let total = 0;
  for (const [id, amount] of spending) if (!covered.has(id)) total += amount;
  return total;
}

/** Default budget name from category names: "A", "A e B", "A +2". */
export function autoBudgetName(names: readonly string[], conjunction: string): string {
  const [first, second] = names;
  if (first === undefined) return '';
  if (second === undefined) return first;
  if (names.length === 2) return `${first} ${conjunction} ${second}`;
  return `${first} +${names.length - 1}`;
}
