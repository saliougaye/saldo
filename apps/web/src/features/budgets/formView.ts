import {
  type BudgetFormValues,
  type BudgetRef,
  budgetFormFrom,
  type CategoryRef,
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

/** A top-level expense category, as a tile of the form. */
export interface BudgetCategoryTile {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
  /** Another budget already covers it. */
  taken: boolean;
  archived: boolean;
}

/**
 * What every budget form of a page shares: the page gives it once (`sharedProps`), so a page with a
 * form for each budget does not send these lists once for each budget.
 */
export interface BudgetFormShared {
  /** Every top-level expense category, live and archived, in the order the form shows them. */
  categories: Omit<BudgetCategoryTile, 'taken'>[];
  /** Every budget's categories, for core's `takenCategoryIds`. */
  budgets: BudgetRef[];
  /** The six periods before this one, spend per category id, for `suggestBudgetAmount`. */
  history: Record<string, number>[];
  /** Every category, for `suggestBudgetAmount`'s expansion of a parent into its children. */
  categoryRefs: CategoryRef[];
}

/** One form: what is its own. */
export interface BudgetFormView {
  mode: 'new' | 'edit';
  id: string | null;
  /**
   * The edited row's version as the page loaded it, sent back as `expectedUpdatedAt`: a phone's edit
   * after the page loaded answers `conflict` instead of being overwritten (§17.4.2). Null for a new one.
   */
  updatedAt: string | null;
  initial: BudgetFormValues;
  /** The categories the budget holds as saved: an edit keeps the archived ones among them. */
  heldIds: string[];
  minorDigits: MinorDigits;
}

export function budgetFormShared(input: {
  data: UserData;
  today: LocalDate;
  def: PeriodDef;
  period: PeriodView;
}): BudgetFormShared {
  const { data, today, def, period } = input;
  return {
    categories: data.categories
      .filter((category) => category.direction === 'expense' && category.parentId === null)
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        colorIndex: category.colorIndex,
        archived: category.archivedAt !== null,
      })),
    budgets: data.budgets.map((budget) => ({ id: budget.id, categoryIds: budget.categoryIds })),
    history: categorySpendHistory(
      periodHistory(data.transactions, def, period.range, HISTORY_CYCLES),
      data.categories,
      today,
    ).map((amounts) => Object.fromEntries(amounts)),
    categoryRefs: data.categories.map((category) => ({
      id: category.id,
      parentId: category.parentId,
    })),
  };
}

export function budgetFormView(input: {
  data: UserData;
  currency: CurrencyCode;
  mode: 'new' | 'edit';
  id: string | null;
}): BudgetFormView | null {
  const { data } = input;
  const { minorDigits } = getCurrency(input.currency);
  const editing =
    input.mode === 'edit' ? data.budgets.find((budget) => budget.id === input.id) : undefined;
  if (input.mode === 'edit' && editing === undefined) return null;
  return {
    mode: input.mode,
    id: editing?.id ?? null,
    updatedAt: editing?.updatedAt ?? null,
    initial: editing === undefined ? emptyBudgetForm() : budgetFormFrom(editing, minorDigits),
    heldIds: editing === undefined ? [] : [...editing.categoryIds],
    minorDigits,
  };
}

/**
 * The tiles of one form: the live top-level expense categories, plus the archived ones the budget
 * holds so they can be deselected; `taken` when another budget covers one.
 */
export function budgetCategoryTiles(
  shared: BudgetFormShared,
  view: Pick<BudgetFormView, 'id' | 'heldIds'>,
): BudgetCategoryTile[] {
  const taken = takenCategoryIds(shared.budgets, shared.categoryRefs, view.id);
  return shared.categories
    .filter((category) => !category.archived || view.heldIds.includes(category.id))
    .map((category) => ({ ...category, taken: taken.has(category.id) }));
}
