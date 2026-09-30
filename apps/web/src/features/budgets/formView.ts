import {
  type BudgetFormValues,
  budgetFormFrom,
  type CurrencyCode,
  categorySpendHistory,
  emptyBudgetForm,
  getCurrency,
  type LocalDate,
  type MinorDigits,
  type PeriodDef,
  type PeriodView,
  periodHistory,
  takenCategoryIds,
  type UserData,
} from '@saldo/core';

/** The phone's `BudgetForm`: six past periods feed the suggested amount (§5.5). */
export const HISTORY_CYCLES = 6;

export interface BudgetFormView {
  mode: 'new' | 'edit';
  id: string | null;
  initial: BudgetFormValues;
  /**
   * Top-level live expense categories; `taken` when another budget already covers one. An edited
   * budget keeps the archived categories it already holds, `archived`, so they can be deselected.
   */
  categories: {
    id: string;
    name: string;
    icon: string;
    colorIndex: number;
    taken: boolean;
    archived: boolean;
  }[];
  /** The six periods before this one, spend per category id, for `suggestBudgetAmount`. */
  history: Record<string, number>[];
  /** Every category, for `suggestBudgetAmount`'s expansion of a parent into its children. */
  categoryRefs: { id: string; parentId: string | null }[];
  minorDigits: MinorDigits;
}

export function budgetFormView(input: {
  data: UserData;
  today: LocalDate;
  def: PeriodDef;
  period: PeriodView;
  currency: CurrencyCode;
  mode: 'new' | 'edit';
  id: string | null;
}): BudgetFormView | null {
  const { data, today, def, period } = input;
  const { minorDigits } = getCurrency(input.currency);
  const editing =
    input.mode === 'edit' ? data.budgets.find((budget) => budget.id === input.id) : undefined;
  if (input.mode === 'edit' && editing === undefined) return null;

  const taken = takenCategoryIds(data.budgets, data.categories, editing?.id ?? null);
  const history = categorySpendHistory(
    periodHistory(data.transactions, def, period.range, HISTORY_CYCLES),
    data.categories,
    today,
  ).map((amounts) => Object.fromEntries(amounts));

  return {
    mode: input.mode,
    id: editing?.id ?? null,
    initial: editing === undefined ? emptyBudgetForm() : budgetFormFrom(editing, minorDigits),
    categories: data.categories
      .filter(
        (category) =>
          category.direction === 'expense' &&
          category.parentId === null &&
          (category.archivedAt === null || editing?.categoryIds.includes(category.id) === true),
      )
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        colorIndex: category.colorIndex,
        taken: taken.has(category.id),
        archived: category.archivedAt !== null,
      })),
    history,
    categoryRefs: data.categories.map((category) => ({
      id: category.id,
      parentId: category.parentId,
    })),
    minorDigits,
  };
}
